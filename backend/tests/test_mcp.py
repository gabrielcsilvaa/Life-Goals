from datetime import timedelta

import pytest
from django.utils import timezone
from starlette.testclient import TestClient

from finance.models import Entry
from integrations.models import Connection


@pytest.fixture(scope="module")
def mcp_client():
    from config.asgi import application

    with TestClient(application) as client:
        yield client
        # MCP uses a database connection in the thread-sensitive async worker.
        # Close it in that same worker before PostgreSQL test database teardown.
        from asgiref.sync import sync_to_async
        from django.db import connections

        client.portal.call(sync_to_async(connections.close_all))


@pytest.fixture
def token(api):
    data = api.post(
        "/api/v1/connections/",
        {"name": "Test client", "scopes": ["finance:read", "finance:write"]},
        format="json",
    ).data
    return data


def rpc(client, token, method, params=None, request_id=1):
    return client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-11-25",
        },
    )


@pytest.mark.django_db(transaction=True)
def test_http_mcp_discovery_real_write_idempotency_and_revocation(user, account, category, token, mcp_client):
    client = mcp_client
    unauthenticated = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={"Accept": "application/json, text/event-stream"},
    )
    assert unauthenticated.status_code == 401
    initialization = rpc(
        client,
        token["token"],
        "initialize",
        {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}},
    )
    assert initialization.status_code == 200, initialization.text
    listing = rpc(client, token["token"], "tools/list")
    assert listing.status_code == 200, listing.text
    names = {t["name"] for t in listing.json()["result"]["tools"]}
    assert {"create_transaction", "get_financial_summary", "get_financial_goals"} <= names
    args = {
        "payload": {
            "kind": "expense",
            "description": "Uber via MCP",
            "amount": "32.00",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-01",
            "paid_on": "2026-11-01",
        },
        "idempotency_key": "mcp-real-retry-key",
    }
    response = rpc(client, token["token"], "tools/call", {"name": "create_transaction", "arguments": args})
    assert response.status_code == 200 and not response.json()["result"].get("isError"), response.text
    repeated = rpc(client, token["token"], "tools/call", {"name": "create_transaction", "arguments": args})
    assert not repeated.json()["result"].get("isError"), repeated.text
    assert Entry.objects.count() == 1
    summary = rpc(
        client,
        token["token"],
        "tools/call",
        {"name": "get_financial_summary", "arguments": {"month": "2026-11"}},
    )
    assert summary.json()["result"]["structuredContent"]["summary"]["balance"] == "1968.00", summary.text
    Connection.objects.filter(pk=token["id"]).update(revoked_at=timezone.now())
    assert rpc(client, token["token"], "tools/list").status_code == 401


@pytest.mark.django_db(transaction=True)
def test_read_only_token_cannot_write_or_access_other_user(user, other, account, category, api, mcp_client):
    read_token = api.post(
        "/api/v1/connections/", {"name": "Readonly", "scopes": ["finance:read"]}, format="json"
    ).data
    api.force_authenticate(other)
    other_token = api.post(
        "/api/v1/connections/", {"name": "Other", "scopes": ["finance:read", "finance:write"]}, format="json"
    ).data
    args = {
        "payload": {
            "kind": "expense",
            "description": "Invalid",
            "amount": "1.00",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-01",
        },
        "idempotency_key": "mcp-cross-user-key",
    }
    client = mcp_client
    response = rpc(
        client, read_token["token"], "tools/call", {"name": "create_transaction", "arguments": args}
    )
    assert response.json()["result"]["isError"] is True
    response = rpc(
        client, other_token["token"], "tools/call", {"name": "create_transaction", "arguments": args}
    )
    assert response.json()["result"]["isError"] is True
    assert Entry.objects.count() == 0
    Connection.objects.filter(pk=other_token["id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert rpc(client, other_token["token"], "tools/list").status_code == 401


@pytest.mark.django_db(transaction=True)
def test_oauth_access_token_calls_real_mcp_tools_and_enforces_read_scope(user, account, category, mcp_client):
    from django.test import Client

    from .test_oauth import authorize, exchange, register

    c = Client()
    client_id = register(c)
    code = authorize(c, user, client_id)["code"][0]
    oauth_token = exchange(c, client_id, code).json()["access_token"]
    result = rpc(
        mcp_client,
        oauth_token,
        "tools/call",
        {"name": "get_financial_summary", "arguments": {"month": "2026-11"}},
    )
    assert result.status_code == 200, result.text
    assert result.json()["result"]["structuredContent"]["summary"]["balance"] == "2000.00"
    denied = rpc(
        mcp_client,
        oauth_token,
        "tools/call",
        {
            "name": "create_transaction",
            "arguments": {
                "payload": {
                    "kind": "expense",
                    "description": "Denied",
                    "amount": "1.00",
                    "account_id": str(account.pk),
                    "category_id": str(category.pk),
                    "due_date": "2026-11-01",
                },
                "idempotency_key": "readonly-oauth-test-key",
            },
        },
    )
    assert denied.json()["result"]["isError"]
    assert not Entry.objects.filter(user=user).exists()


@pytest.mark.django_db(transaction=True)
def test_mcp_monthly_queries_preserve_paid_invoice_and_exclude_canceled_duplicate(
    user, account, category, token, mcp_client
):
    from uuid import uuid4

    from finance.models import Card, CardInvoice, CashMovement
    from finance.services import execute

    card = Card.objects.create(user=user, name="Test card", closing_day=5, due_day=12, blocked=True)
    invoice = CardInvoice.objects.create(user=user, card=card, month="2026-11-01", due_date="2026-11-12")
    paid = Entry.objects.create(
        user=user,
        card=card,
        invoice=invoice,
        category=category,
        kind="expense",
        amount="660.00",
        due_date="2026-11-12",
        description="Opening balance",
    )
    execute(
        user,
        "pay_card_invoice",
        {
            "card_id": str(card.pk),
            "account_id": str(account.pk),
            "month": "2026-11-01",
            "amount": "660.00",
            "paid_on": "2026-11-12",
        },
        str(uuid4()),
    )
    duplicate_invoice = CardInvoice.objects.create(
        user=user, card=card, month="2026-12-01", due_date="2026-12-12"
    )
    duplicate = Entry.objects.create(
        user=user,
        card=card,
        invoice=duplicate_invoice,
        category=category,
        kind="expense",
        amount="660.00",
        due_date="2026-12-12",
        description="Opening balance",
    )
    execute(user, "cancel_transaction", {"entry_id": str(duplicate.pk), "version": 1}, str(uuid4()))
    for month, total, status in [("2026-11", "660.00", "paid"), ("2026-12", "0.00", "canceled")]:
        results = {}
        for name in ["list_transactions", "list_card_invoices", "get_financial_summary"]:
            response = rpc(
                mcp_client,
                token["token"],
                "tools/call",
                {
                    "name": name,
                    "arguments": {"month": month},
                },
            ).json()["result"]
            assert not response.get("isError"), response
            results[name] = response["structuredContent"]
        assert results["list_transactions"]["items"][0]["status"] == status
        assert results["list_card_invoices"]["cards"][0]["invoice_total"] == total
        assert results["list_card_invoices"]["cards"][0]["invoice_paid"] == total
        summary = results["get_financial_summary"]["summary"]
        assert summary["unpaid"] == "0.00"
        assert summary["balance"] == "1340.00"
    assert CashMovement.objects.filter(entry=paid).count() == 1
    assert not CashMovement.objects.filter(entry=duplicate).exists()
