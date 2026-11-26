"""MCP OAuth policy around the maintained Django OAuth Toolkit implementation."""

import hashlib
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from oauth2_provider.oauth2_validators import OAuth2Validator
from oauth2_provider.views import DynamicClientRegistrationView
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error

from audit.models import AuditEvent

from .models import Connection


class LifeGoalsOAuthValidator(OAuth2Validator):
    def _validate_resource_uris(self, request, resources):
        super()._validate_resource_uris(request, resources)
        if not resources or set(resources) != {settings.MCP_PUBLIC_URL}:
            raise CustomOAuth2Error(
                error="invalid_target",
                description="The token must target the Life Goals MCP resource.",
                request=request,
            )

    def _save_bearer_token(self, token, request, *args, **kwargs):
        super()._save_bearer_token(token, request, *args, **kwargs)
        scopes = sorted(set(token.get("scope", "").split()))
        if request.grant_type == "authorization_code":
            connection, _ = Connection.objects.update_or_create(
                user=request.user,
                oauth_application=request.client,
                defaults={
                    "name": request.client.name[:80] or "Cliente OAuth",
                    "token_hash": hashlib.sha256(secrets.token_bytes(48)).hexdigest(),
                    "scopes": scopes,
                    "expires_at": timezone.now() + timedelta(days=30),
                    "revoked_at": None,
                },
            )
            AuditEvent.objects.create(
                user=request.user,
                action="authorize_oauth_connection",
                resource_id=str(connection.pk),
                details={"client_id": request.client.client_id, "scopes": scopes},
            )

    def validate_refresh_token(self, refresh_token, client, request, *args, **kwargs):
        if not super().validate_refresh_token(refresh_token, client, request, *args, **kwargs):
            return False
        return Connection.objects.filter(
            user=request.user, oauth_application=client, revoked_at=None, expires_at__gt=timezone.now()
        ).exists()


class PublicRegistrationView(DynamicClientRegistrationView):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            if not isinstance(data, dict) or data.get("token_endpoint_auth_method", "none") != "none":
                raise ValueError()
            if set(data.get("grant_types", ["authorization_code"])) - {"authorization_code", "refresh_token"}:
                raise ValueError()
            if data.get("response_types", ["code"]) != ["code"]:
                raise ValueError()
            data["token_endpoint_auth_method"] = "none"
            request._body = json.dumps(data).encode()
        except (ValueError, TypeError):
            return JsonResponse(
                {
                    "error": "invalid_client_metadata",
                    "error_description": "Use authorization_code, PKCE S256 and public client authentication (none).",
                },
                status=400,
            )
        return super().post(request, *args, **kwargs)


class OAuthSafetyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/oauth/"):
            if request.method == "POST":
                limit = 12 if path == "/oauth/login/" else 30 if path == "/oauth/register/" else 120
                period = 3600 if path == "/oauth/register/" else 60
                bucket = int(timezone.now().timestamp()) // period
                identity = hashlib.sha256(request.META.get("REMOTE_ADDR", "unknown").encode()).hexdigest()
                key = f"oauth-limit:{path}:{identity}:{bucket}"
                if not cache.add(key, 1, period):
                    try:
                        count = cache.incr(key)
                    except ValueError:
                        count = 1
                    if count > limit:
                        return JsonResponse({"error": "temporarily_unavailable"}, status=429)
        response = self.get_response(request)
        if path.startswith(("/oauth/", "/.well-known/")):
            response["Cache-Control"] = "no-store"
            # Chromium sends Origin: null on form POSTs under no-referrer; same-origin
            # preserves CSRF origin checks while withholding referrers from OAuth callbacks.
            response["Referrer-Policy"] = "same-origin"
            response["Content-Security-Policy"] = (
                "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https:; base-uri 'none'; frame-ancestors 'none'"
            )
        return response
