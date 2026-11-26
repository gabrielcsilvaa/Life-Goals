from datetime import date
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from audit.models import AuditEvent
from finance.models import CashMovement, Entry
from finance.services import execute
from identity.models import User
from planning.models import GoalAllocation


def test_authentication_is_required():
    assert APIClient().get("/api/v1/snapshot/?month=2026-11").status_code == 401


def test_registration_login_and_refresh_revocation(db):
    client = APIClient()
    response = client.post(
        "/api/v1/auth/register/",
        {
            "email": "pessoa@example.com",
            "username": "new-user",
            "display_name": "Pessoa",
            "password": "Strong-user-password-91!",
        },
        format="json",
    )
    assert response.status_code == 201
    assert User.objects.get(username="new-user").email == "pessoa@example.com"
    refresh = response.data["refresh"]
    logged_in = client.post(
        "/api/v1/auth/token/", {"username": "new-user", "password": "Strong-user-password-91!"}, format="json"
    )
    assert logged_in.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {logged_in.data['access']}")
    assert client.get("/api/v1/snapshot/?month=2026-11").data["accounts"] == []
    assert client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json").status_code == 204
    assert client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json").status_code == 401


def test_api_write_list_and_tenant_isolation(api, user, other, account, category):
    payload = {
        "kind": "expense",
        "description": "Almoço",
        "amount": "25.00",
        "category_id": str(category.pk),
        "account_id": str(account.pk),
        "due_date": "2026-11-01",
        "paid_on": "2026-11-01",
    }
    url = "/api/v1/commands/create_transaction/"
    assert api.post(url, payload, format="json").status_code == 400
    first = api.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="api-retry-same-key")
    repeated = api.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="api-retry-same-key")
    assert first.status_code == repeated.status_code == 200 and first.data == repeated.data
    assert api.get("/api/v1/transactions/?month=2026-11&limit=1").data["count"] == 1
    api.force_authenticate(other)
    assert api.get("/api/v1/transactions/?month=2026-11").data["count"] == 0
    assert api.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4())).status_code == 404


def test_bad_month_is_a_validation_error(api):
    assert api.get("/api/v1/snapshot/?month=2026-13").status_code == 400
    assert api.get("/api/v1/snapshot/?month=2026-1").status_code == 400


def test_browser_preflight_allows_idempotency_header():
    response = APIClient().options(
        "/api/v1/commands/create_transaction/",
        HTTP_ORIGIN="http://127.0.0.1:8081",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type,idempotency-key",
    )
    assert response.status_code == 200
    assert "idempotency-key" in response["Access-Control-Allow-Headers"]


def test_connection_secret_is_only_returned_once(api, other):
    response = api.post("/api/v1/connections/", {"name": "Claude", "scopes": ["finance:read"]}, format="json")
    assert response.status_code == 201 and response.data["token"].startswith("lg_")
    listing = api.get("/api/v1/connections/").data
    assert "token" not in listing[0] and "token_hash" not in listing[0]
    pk = response.data["id"]
    api.force_authenticate(other)
    assert api.post(f"/api/v1/connections/{pk}/revoke/").status_code == 404


def test_example_is_opt_in_and_contains_no_realized_money(user, api):
    response = api.post(
        "/api/v1/commands/load_example/", {}, format="json", HTTP_IDEMPOTENCY_KEY="load-example-once"
    )
    assert response.status_code == 200
    assert CashMovement.objects.count() == GoalAllocation.objects.count() == 0
    assert (
        api.post(
            "/api/v1/commands/load_example/", {}, format="json", HTTP_IDEMPOTENCY_KEY="different-example-key"
        ).status_code
        == 400
    )
    data = api.get("/api/v1/snapshot/?month=2027-01").data
    assert data["summary"]["income_expected"] == "2000.00"
    assert data["summary"]["reserved"] == data["summary"]["income_received"] == "0.00"


def test_invoice_payment_is_atomic_and_not_another_expense(user, account, category):
    def call(op, payload):
        return execute(user, op, payload, str(uuid4()))

    card = call("create_card", {"name": "MP", "closing_day": 3, "due_day": 10})
    call(
        "register_opening_invoice",
        {"card_id": card["id"], "category_id": str(category.pk), "amount": "200", "due_date": "2026-11-10"},
    )
    before = Entry.objects.count()
    result = call(
        "pay_card_invoice",
        {
            "card_id": card["id"],
            "account_id": str(account.pk),
            "month": "2026-11-01",
            "amount": "50",
            "paid_on": "2026-11-10",
        },
    )
    assert result["remaining"] == "150.00" and Entry.objects.count() == before
    assert CashMovement.objects.count() == 1
    assert AuditEvent.objects.get(action="pay_card_invoice").details["input"]["amount"] == "50"


def test_recurring_update_preserves_generated_history(user, account, category):
    from finance.models import RecurringRule
    from finance.queries import snapshot

    def call(op, payload):
        return execute(user, op, payload, str(uuid4()))

    payload = {
        "name": "Academia",
        "amount": "140",
        "category_id": str(category.pk),
        "account_id": str(account.pk),
        "day": 10,
        "start_month": "2026-10-01",
    }
    rule = call("create_recurring_expense", payload)
    call("generate_recurring_expenses", {"month": "2026-10-01"})
    call("update_recurring_expense", {**payload, "recurring_id": rule["id"], "amount": "150"})
    call("generate_recurring_expenses", {"month": "2026-11-01"})
    assert Entry.objects.get(occurrence_month=date(2026, 10, 1)).amount == 140
    assert Entry.objects.get(occurrence_month=date(2026, 11, 1)).amount == 150
    assert snapshot(user, date(2026, 11, 1))["recurring"][0]["active"] is True
    assert RecurringRule.objects.count() == 1


@pytest.mark.parametrize("email", [None, "", "invalido", "a" * 250 + "@example.com"])
def test_registration_requires_valid_email(db, email):
    payload = {"username": "email-user", "display_name": "Pessoa", "password": "Strong-user-password-91!"}
    if email is not None:
        payload["email"] = email
    response = APIClient().post("/api/v1/auth/register/", payload, format="json")
    assert response.status_code == 400
    assert not User.objects.filter(username="email-user").exists()
