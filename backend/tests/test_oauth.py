import base64
import hashlib
from urllib.parse import parse_qs, urlparse

import pytest
from django.conf import settings
from django.test import Client
from oauth2_provider.models import AccessToken

from integrations.models import Connection

REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect"
VERIFIER = "test-pkce-verifier-" + "a" * 64


def register(client):
    r = client.post(
        "/oauth/register/",
        data={
            "client_name": "ChatGPT test",
            "redirect_uris": [REDIRECT],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        },
        content_type="application/json",
    )
    assert r.status_code == 201, r.content
    return r.json()["client_id"]


def authorize(client, user, client_id, **overrides):
    client.force_login(user)
    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "scope": "finance:read offline_access",
        "state": "opaque-state",
        "resource": settings.MCP_PUBLIC_URL,
        "code_challenge": base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest())
        .rstrip(b"=")
        .decode(),
        "code_challenge_method": "S256",
        **overrides,
    }
    r = client.get("/oauth/authorize/", params)
    assert r.status_code == 200, r.content
    from html.parser import HTMLParser

    class HiddenFields(HTMLParser):
        def __init__(self):
            super().__init__()
            self.fields = {}

        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if tag == "input" and a.get("type") == "hidden":
                self.fields[a["name"]] = a.get("value", "")

    parser = HiddenFields()
    parser.feed(r.content.decode())
    from urllib.parse import urlencode

    r = client.post(
        "/oauth/authorize/",
        urlencode({**parser.fields, "allow": "Autorizar"}),
        content_type="application/x-www-form-urlencoded",
    )
    assert r.status_code == 302, r.content
    return parse_qs(urlparse(r["Location"]).query)


def exchange(client, client_id, code, verifier=VERIFIER, **extra):
    from urllib.parse import urlencode

    return client.post(
        "/oauth/token/",
        urlencode(
            {
                "grant_type": "authorization_code",
                "client_id": client_id,
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": REDIRECT,
                "resource": settings.MCP_PUBLIC_URL,
                **extra,
            }
        ),
        content_type="application/x-www-form-urlencoded",
    )


@pytest.mark.django_db
def test_oauth_pkce_discovery_rotation_and_revocation(user, api):
    c = Client()
    discovery = c.get("/.well-known/oauth-authorization-server").json()
    assert discovery["code_challenge_methods_supported"] == ["S256"]
    assert discovery["authorization_endpoint"].endswith("/oauth/authorize/")
    assert discovery["registration_endpoint"].endswith("/oauth/register/")
    resource = c.get("/.well-known/oauth-protected-resource/mcp").json()
    assert resource["resource"] == settings.MCP_PUBLIC_URL
    client_id = register(c)
    result = authorize(c, user, client_id)
    assert result["state"] == ["opaque-state"]
    assert result["iss"] == [settings.OAUTH_PUBLIC_ORIGIN]
    r = exchange(c, client_id, result["code"][0])
    assert r.status_code == 200, r.content
    tokens = r.json()
    assert exchange(c, client_id, result["code"][0]).status_code == 400
    obj = AccessToken.objects.get(user=user)
    assert obj.resource == [settings.MCP_PUBLIC_URL]
    assert obj.token != tokens["access_token"]
    connection = Connection.objects.get(user=user, oauth_application__client_id=client_id)
    from asgiref.sync import async_to_sync

    from integrations.mcp_server import verifier

    verified = async_to_sync(verifier.verify_token)(tokens["access_token"])
    assert verified and verified.subject == str(user.pk)
    assert "finance:write" not in verified.scopes
    from urllib.parse import urlencode

    r = c.post(
        "/oauth/token/",
        urlencode(
            {
                "grant_type": "refresh_token",
                "client_id": client_id,
                "refresh_token": tokens["refresh_token"],
                "resource": settings.MCP_PUBLIC_URL,
            }
        ),
        content_type="application/x-www-form-urlencoded",
    )
    assert r.status_code == 200, r.content
    refreshed = r.json()
    assert refreshed["refresh_token"] != tokens["refresh_token"]
    assert api.post(f"/api/v1/connections/{connection.pk}/revoke/").status_code == 200
    assert async_to_sync(verifier.verify_token)(refreshed["access_token"]) is None
    r = c.post(
        "/oauth/token/",
        urlencode(
            {
                "grant_type": "refresh_token",
                "client_id": client_id,
                "refresh_token": refreshed["refresh_token"],
                "resource": settings.MCP_PUBLIC_URL,
            }
        ),
        content_type="application/x-www-form-urlencoded",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_wrong_pkce_and_redirect_and_resource_are_rejected(user):
    c = Client()
    client_id = register(c)
    code = authorize(c, user, client_id)["code"][0]
    assert exchange(c, client_id, code, verifier="wrong-verifier").status_code == 400
    r = c.get(
        "/oauth/authorize/",
        {
            "client_id": client_id,
            "redirect_uri": "https://evil.example/callback",
            "response_type": "code",
            "code_challenge": "a" * 43,
            "code_challenge_method": "S256",
            "resource": settings.MCP_PUBLIC_URL,
        },
    )
    assert r.status_code == 400
    code = authorize(c, user, client_id)["code"][0]
    assert exchange(c, client_id, code, resource="https://other.example/mcp").status_code == 400


@pytest.mark.django_db
def test_login_and_consent_keep_csrf_and_scope_controls(user):
    secure = Client(enforce_csrf_checks=True)
    assert (
        secure.post(
            "/oauth/login/", {"username": user.username, "password": "strong-password-123"}
        ).status_code
        == 403
    )
    client = Client()
    client_id = register(client)
    result = authorize(client, user, client_id, scope="finance:write finance:read offline_access")
    tokens = exchange(client, client_id, result["code"][0]).json()
    from asgiref.sync import async_to_sync

    from integrations.mcp_server import verifier

    assert "finance:write" in async_to_sync(verifier.verify_token)(tokens["access_token"]).scopes
    assert (
        client.post(
            "/oauth/register/",
            {"redirect_uris": ["http://evil.example/callback"]},
            content_type="application/json",
        ).status_code
        == 400
    )


def test_public_boundary_does_not_expose_rest_or_debug():
    from starlette.responses import PlainTextResponse
    from starlette.testclient import TestClient

    from integrations.public_boundary import PublicBoundary

    async def app(scope, receive, send):
        await PlainTextResponse(scope["scheme"])(scope, receive, send)

    client = TestClient(PublicBoundary(app))
    for path in ["/api/v1/auth/register/", "/api/v1/snapshot/", "/health/", "/admin/", "/.env"]:
        assert client.get(path).status_code == 404
    assert client.get("/oauth/login/").text == "https"
    assert client.post("/oauth/token/", headers={"content-length": "70000"}).status_code == 413


@pytest.mark.django_db
def test_oauth_form_referrer_policy_preserves_csrf_origin_and_rejects_null(user):
    client = Client(enforce_csrf_checks=True)
    page = client.get("/oauth/login/")
    assert page["Referrer-Policy"] == "same-origin"
    csrf = client.cookies[settings.CSRF_COOKIE_NAME].value
    null = client.post(
        "/oauth/login/",
        {"username": user.username, "password": "strong-password-123", "csrfmiddlewaretoken": csrf},
        HTTP_ORIGIN="null",
    )
    assert null.status_code == 403
    own = client.post(
        "/oauth/login/",
        {
            "username": user.username,
            "password": "strong-password-123",
            "csrfmiddlewaretoken": csrf,
            "next": "/oauth/authorize/",
        },
        HTTP_ORIGIN="http://testserver",
    )
    assert own.status_code == 302
