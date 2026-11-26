"""Django sessions for browsers; no authentication tokens are returned to JavaScript."""

import logging
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditEvent

from .defaults import ensure_default_categories
from .models import User
from .throttles import AuthThrottle
from .views import RegistrationSerializer


class VerificationToken(PasswordResetTokenGenerator):
    key_salt = "lifegoals.email.verification"

    def _make_hash_value(self, user, timestamp):
        return f"{super()._make_hash_value(user, timestamp)}:{user.pending_email}:{user.email_verified_at}"


verification_token = VerificationToken()


def profile(user):
    return {
        "id": str(user.pk),
        "name": user.display_name,
        "username": user.username,
        "email": user.email,
        "email_verified": user.email_verified_at is not None,
        "timezone": user.timezone,
        "preferences": user.preferences,
        "created_at": user.date_joined.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }


def send_link(user, kind, recipient=None):
    generator = verification_token if kind == "verify-email" else default_token_generator
    fragment = urlencode(
        {"uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": generator.make_token(user)}
    )
    # Fragments never reach HTTP access logs or referrer headers.
    url = f"{settings.FRONTEND_ORIGIN}/{kind}#{fragment}"
    send_mail(
        "Life Goals — confirme seu acesso",
        f"Abra este link para continuar:\n{url}\n\nSe não solicitou, ignore esta mensagem.",
        settings.DEFAULT_FROM_EMAIL,
        [recipient or user.email],
        fail_silently=False,
    )


def token_user(payload, generator):
    try:
        pk = urlsafe_base64_decode(payload.get("uid", "")).decode()
        user = User.objects.select_for_update().get(pk=pk, is_active=True)
        if generator.check_token(user, payload.get("token", "")):
            return user
    except (ValueError, TypeError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
        pass
    raise serializers.ValidationError("Link inválido, utilizado ou expirado.")


@method_decorator(csrf_protect, name="dispatch")
class PublicAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthThrottle]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not isinstance(request.data, dict):
            raise serializers.ValidationError("Envie os campos do formulário.")


class CsrfView(PublicAuthView):
    throttle_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class SessionView(APIView):
    def get(self, request):
        return Response(profile(request.user))

    def patch(self, request):
        user = request.user
        if "hide_amounts" in request.data:
            if not isinstance(request.data["hide_amounts"], bool):
                raise serializers.ValidationError("Preferência inválida.")
            user.preferences = {**user.preferences, "hide_amounts": request.data["hide_amounts"]}
        if "timezone" in request.data:
            try:
                ZoneInfo(request.data["timezone"])
            except (ZoneInfoNotFoundError, TypeError, ValueError):
                raise serializers.ValidationError("Fuso horário inválido.") from None
            user.timezone = request.data["timezone"]
        user.save(update_fields=["preferences", "timezone"])
        return Response(profile(user))


class WebRegisterView(PublicAuthView):
    @transaction.atomic
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = User.objects.create_user(**serializer.validated_data)
        except IntegrityError:
            raise serializers.ValidationError(
                "Não foi possível cadastrar estes dados. Tente entrar ou recuperar seu acesso."
            ) from None
        ensure_default_categories(user)
        if settings.REQUIRE_EMAIL_VERIFICATION:
            send_link(user, "verify-email")
            return Response(
                {
                    "verification_required": True,
                    "message": "Confira seu e-mail para confirmar a conta e depois entrar.",
                },
                status=202,
            )
        login(request, user, backend="identity.authentication.EmailOrUsernameBackend")
        request.session.set_expiry(settings.SESSION_COOKIE_AGE)
        return Response(profile(user), status=201)


class WebLoginView(PublicAuthView):
    def post(self, request):
        identifier = request.data.get("email") or request.data.get("username")
        user = authenticate(request, username=identifier, password=request.data.get("password"))
        if user is None:
            return Response({"detail": "Dados de acesso inválidos."}, status=401)
        if settings.REQUIRE_EMAIL_VERIFICATION and user.email and not user.email_verified_at:
            return Response({"detail": "Confirme seu e-mail antes de entrar."}, status=403)
        login(request, user)
        request.session.set_expiry(settings.SESSION_COOKIE_AGE)
        return Response(profile(user))


class WebLogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=204)


class RecoveryView(PublicAuthView):
    def post(self, request):
        field = serializers.EmailField()
        email = field.run_validation(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user and user.has_usable_password():
            try:
                send_link(user, "reset-password")
            except OSError:
                logging.getLogger(__name__).warning("Account recovery email temporarily unavailable.")
        return Response({"message": "Se houver uma conta para esse e-mail, enviaremos as instruções."})


class ResetView(PublicAuthView):
    @transaction.atomic
    def post(self, request):
        user = token_user(request.data, default_token_generator)
        form = SetPasswordForm(
            user,
            {
                "new_password1": request.data.get("password", ""),
                "new_password2": request.data.get("password_confirm", ""),
            },
        )
        if not form.is_valid():
            raise serializers.ValidationError(form.errors)
        form.save()
        if user.email:
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified_at"])
        # Django invalidates sessions via the password hash. Revoke other transports too.
        from oauth2_provider.models import AccessToken, RefreshToken
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        from integrations.models import Connection

        Connection.objects.filter(user=user, revoked_at=None).update(revoked_at=timezone.now())
        AccessToken.objects.filter(user=user).delete()
        RefreshToken.objects.filter(user=user).delete()
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        AuditEvent.objects.create(user=user, action="password_reset", resource_id=str(user.pk), source="web")
        return Response({"message": "Senha atualizada. Entre novamente."})


class VerifyView(PublicAuthView):
    @transaction.atomic
    def post(self, request):
        user = token_user(request.data, verification_token)
        if user.pending_email:
            user.email, user.pending_email = user.pending_email, ""
        user.email_verified_at = timezone.now()
        try:
            with transaction.atomic():
                user.save(update_fields=["email", "pending_email", "email_verified_at"])
        except IntegrityError:
            raise serializers.ValidationError("Não foi possível confirmar este endereço.") from None
        return Response({"message": "E-mail confirmado. Você já pode entrar."})


class BindEmailView(APIView):
    throttle_classes = [AuthThrottle]

    def post(self, request):
        if not request.user.check_password(request.data.get("password", "")):
            raise serializers.ValidationError("Confira seus dados de acesso.")
        email = serializers.EmailField().run_validation(request.data.get("email", "")).strip().lower()
        request.user.pending_email = email
        request.user.save(update_fields=["pending_email"])
        send_link(request.user, "verify-email", email)
        return Response({"message": "Confira o e-mail informado para confirmar o vínculo."})
