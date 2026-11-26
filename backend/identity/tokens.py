from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .throttles import AuthThrottle


class EmailTokenSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].required = False

    def validate(self, attrs):
        attrs["username"] = attrs.pop("email", None) or attrs.get("username", "")
        data = super().validate(attrs)
        if settings.REQUIRE_EMAIL_VERIFICATION and self.user.email and not self.user.email_verified_at:
            raise serializers.ValidationError("Confirme seu e-mail antes de entrar.")
        return data


class EmailTokenView(TokenObtainPairView):
    serializer_class = EmailTokenSerializer
    throttle_classes = [AuthThrottle]
