import hashlib
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditEvent
from finance.services import owned

from .models import Connection


class ConnectionSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=["finance:read", "finance:write"]), allow_empty=False
    )
    expires_in_days = serializers.IntegerField(min_value=1, max_value=90, default=30)


class ConnectionsView(APIView):
    def get(self, request):
        return Response(
            list(
                Connection.objects.filter(user=request.user)
                .order_by("-created_at")
                .values("id", "name", "scopes", "created_at", "expires_at", "revoked_at", "last_used_at")
            )
        )

    @transaction.atomic
    def post(self, request):
        serializer = ConnectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        raw = "lg_" + secrets.token_urlsafe(40)
        connection = Connection.objects.create(
            user=request.user,
            name=data["name"],
            scopes=sorted(set(data["scopes"])),
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            expires_at=timezone.now() + timedelta(days=data["expires_in_days"]),
        )
        AuditEvent.objects.create(
            user=request.user, action="create_connection", resource_id=str(connection.pk)
        )
        return Response(
            {
                "id": str(connection.pk),
                "token": raw,
                "notice": "Copie agora. O segredo não poderá ser consultado novamente.",
            },
            status=201,
        )


class RevokeConnectionView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        obj = owned(Connection, request.user, pk)
        obj.revoked_at = timezone.now()
        obj.save(update_fields=["revoked_at"])
        if obj.oauth_application_id:
            from oauth2_provider.models import AccessToken, RefreshToken

            AccessToken.objects.filter(user=request.user, application_id=obj.oauth_application_id).delete()
            RefreshToken.objects.filter(user=request.user, application_id=obj.oauth_application_id).delete()
        AuditEvent.objects.create(user=request.user, action="revoke_connection", resource_id=str(obj.pk))
        return Response({"revoked": True})
