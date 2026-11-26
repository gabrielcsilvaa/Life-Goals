from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .defaults import ensure_default_categories
from .models import User


class RegistrationSerializer(serializers.Serializer):
    username = serializers.RegexField(r"^[a-zA-Z0-9_.@+-]+$", min_length=3, max_length=150)
    email = serializers.EmailField(max_length=254)
    display_name = serializers.CharField(max_length=80)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Este usuário já existe.")
        return value

    def validate(self, data):
        try:
            validate_password(data["password"], User(username=data["username"]))
        except ValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return data


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.create_user(**serializer.validated_data)
        ensure_default_categories(user)
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
