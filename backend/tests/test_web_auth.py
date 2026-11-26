from urllib.parse import parse_qs, urlsplit

from django.core import mail
from django.test import override_settings
from rest_framework.test import APIClient

from audit.models import AuditEvent
from finance.models import Entry
from identity.models import User


def browser():
    client = APIClient(enforce_csrf_checks=True)
    token = client.get("/api/v1/web/csrf/", secure=True).json()["csrfToken"]
    client.credentials(HTTP_X_CSRFTOKEN=token, HTTP_REFERER="https://testserver/")
    return client


def refresh_csrf(client):
    token = client.get("/api/v1/web/csrf/", secure=True).json()["csrfToken"]
    client.credentials(HTTP_X_CSRFTOKEN=token, HTTP_REFERER="https://testserver/")


def create(client, email=" Person@Example.COM "):
    return client.post(
        "/api/v1/web/register/",
        {
            "email": email,
            "display_name": "Pessoa teste",
            "password": "Strong-test-password-83!",
        },
        format="json",
        secure=True,
    )


def emailed_token():
    url = next(line for line in mail.outbox[-1].body.splitlines() if line.startswith("http"))
    return {key: values[0] for key, values in parse_qs(urlsplit(url).fragment).items()}


def test_email_persists_and_session_survives_browser_restart(db):
    client = browser()
    response = create(client)
    assert response.status_code == 201, response.data
    user = User.objects.get()
    assert user.email == "person@example.com"
    assert user.check_password("Strong-test-password-83!")
    assert user.password != "Strong-test-password-83!"
    assert "access" not in response.data and "refresh" not in response.data
    reopened = APIClient(enforce_csrf_checks=True)
    reopened.cookies = client.cookies.copy()
    assert reopened.get("/api/v1/web/session/", secure=True).json()["email"] == user.email
    assert response.cookies["sessionid"]["httponly"]
    assert not Entry.objects.filter(user=user).exists()


def test_email_login_other_device_and_logout_invalidate_cookie(db):
    first = browser()
    create(first)
    second = browser()
    assert (
        second.post(
            "/api/v1/web/login/",
            {"email": "PERSON@example.com", "password": "Strong-test-password-83!"},
            format="json",
            secure=True,
        ).status_code
        == 200
    )
    cookie = second.cookies.copy()
    refresh_csrf(second)
    assert second.post("/api/v1/web/logout/", {}, format="json", secure=True).status_code == 204
    replay = APIClient()
    replay.cookies = cookie
    assert replay.get("/api/v1/web/session/", secure=True).status_code == 401
    assert first.get("/api/v1/web/session/", secure=True).status_code == 200


def test_web_auth_and_financial_writes_require_csrf(db):
    anonymous = APIClient(enforce_csrf_checks=True)
    assert (
        anonymous.post(
            "/api/v1/web/login/",
            {"email": "person@example.com", "password": "invalid"},
            format="json",
            secure=True,
        ).status_code
        == 403
    )
    client = browser()
    create(client)
    client.credentials()
    assert (
        client.patch("/api/v1/web/session/", {"hide_amounts": True}, format="json", secure=True).status_code
        == 403
    )
    refresh_csrf(client)
    assert (
        client.patch("/api/v1/web/session/", {"hide_amounts": True}, format="json", secure=True).status_code
        == 200
    )
    assert User.objects.get().preferences == {"hide_amounts": True}
    assert (
        client.post(
            "/api/v1/commands/create_account/",
            {"name": "Minha conta", "opening_date": "2026-01-01", "opening_balance": "100"},
            format="json",
            secure=True,
            HTTP_IDEMPOTENCY_KEY="web-session-account-key",
        ).status_code
        == 200
    )
    assert "no-store" in client.get("/api/v1/snapshot/?month=2026-11", secure=True)["Cache-Control"]


def test_duplicate_email_is_rejected_case_insensitively(db):
    assert create(browser()).status_code == 201
    assert create(browser(), "PERSON@example.com").status_code == 400
    assert User.objects.count() == 1


@override_settings(REQUIRE_EMAIL_VERIFICATION=True)
def test_verification_is_required_and_link_is_single_use(db):
    client = browser()
    assert create(client).status_code == 202
    user = User.objects.get()
    assert user.email_verified_at is None
    assert client.get("/api/v1/web/session/", secure=True).status_code == 401
    token = emailed_token()
    assert client.post("/api/v1/web/verify/", token, format="json", secure=True).status_code == 200
    assert client.post("/api/v1/web/verify/", token, format="json", secure=True).status_code == 400
    user.refresh_from_db()
    assert user.email_verified_at is not None


def test_password_reset_is_single_use_and_revokes_old_session(db):
    signed_in = browser()
    create(signed_in)
    visitor = browser()
    unknown = visitor.post(
        "/api/v1/web/recover/", {"email": "missing@example.com"}, format="json", secure=True
    )
    known = visitor.post("/api/v1/web/recover/", {"email": "person@example.com"}, format="json", secure=True)
    assert unknown.data == known.data
    payload = {
        **emailed_token(),
        "password": "New-strong-password-88!",
        "password_confirm": "New-strong-password-88!",
    }
    assert visitor.post("/api/v1/web/reset/", payload, format="json", secure=True).status_code == 200
    assert visitor.post("/api/v1/web/reset/", payload, format="json", secure=True).status_code == 400
    assert signed_in.get("/api/v1/web/session/", secure=True).status_code == 401
    assert User.objects.get().check_password("New-strong-password-88!")
    assert AuditEvent.objects.get(action="password_reset").details == {}


@override_settings(AUTH_ATTEMPTS_PER_WINDOW=2)
def test_auth_limits_are_shared_by_clients(db):
    for _ in range(2):
        client = browser()
        assert (
            client.post(
                "/api/v1/web/login/",
                {"email": "none@example.com", "password": "wrong"},
                format="json",
                secure=True,
            ).status_code
            == 401
        )
    client = browser()
    assert (
        client.post(
            "/api/v1/web/login/",
            {"email": "none@example.com", "password": "wrong"},
            format="json",
            secure=True,
        ).status_code
        == 429
    )


def test_session_user_cannot_reference_another_users_account(db, other, account, category):
    client = browser()
    create(client)
    refresh_csrf(client)
    result = client.post(
        "/api/v1/commands/create_transaction/",
        {
            "kind": "expense",
            "amount": "10",
            "due_date": "2026-11-01",
            "account_id": str(account.pk),
            "category_id": str(category.pk),
        },
        format="json",
        secure=True,
        HTTP_IDEMPOTENCY_KEY="other-owner-test-key",
    )
    assert result.status_code == 404
    assert not Entry.objects.exists()
