from uuid import uuid4

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .defaults import ensure_default_categories
from .models import User
from .throttles import AuthThrottle


class RegistrationSerializer(serializers.Serializer):
    username = serializers.RegexField(
        r"^[a-zA-Z0-9_.@+-]+$", min_length=3, max_length=150, default=lambda: f"lg_{uuid4().hex}"
    )
    email = serializers.EmailField(max_length=254)
    display_name = serializers.CharField(max_length=80)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Não foi possível cadastrar estes dados. Entre ou recupere seu acesso."
            )
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Este usuário já existe.")
        return value

    def validate(self, data):
        try:
            validate_password(
                data["password"],
                User(username=data["username"], email=data["email"], display_name=data["display_name"]),
            )
        except ValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return data


class RegisterView(APIView):
    throttle_classes = [AuthThrottle]
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = User.objects.create_user(**serializer.validated_data)
        except IntegrityError:
            raise serializers.ValidationError("Não foi possível cadastrar estes dados.") from None
        ensure_default_categories(user)
        if settings.REQUIRE_EMAIL_VERIFICATION:
            from .web import send_link

            send_link(user, "verify-email")
            return Response(
                {"verification_required": True, "message": "Confira seu e-mail para confirmar a conta."},
                status=202,
            )
        token = RefreshToken.for_user(user)
        return Response({"access": str(token.access_token), "refresh": str(token)}, status=201)


class LogoutView(APIView):
    def post(self, request):
        from rest_framework_simplejwt.exceptions import TokenError

        try:
            token = RefreshToken(request.data.get("refresh", ""))
            if str(token["user_id"]) != str(request.user.pk):
                raise TokenError("invalid owner")
            token.blacklist()
        except TokenError:
            raise serializers.ValidationError("Sessão inválida.") from None
        return Response(status=204)
