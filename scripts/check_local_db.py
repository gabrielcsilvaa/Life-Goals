"""Exercise the real PostgreSQL/API stack; all verification records roll back."""

import os
import secrets
import sys
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from django.db import connection, transaction
from django.utils import timezone
from identity.models import User
from rest_framework.test import APIClient


def main():
    assert connection.vendor == "postgresql"
    before = User.objects.count()
    with transaction.atomic():
        client = APIClient(HTTP_HOST="localhost")
        username = f"check-{uuid4().hex}"
        registered = client.post(
            "/api/v1/auth/register/",
            {
                "username": username,
                "display_name": "Verificação temporária",
                "password": secrets.token_urlsafe(25),
            },
            format="json",
        )
        assert registered.status_code == 201
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {registered.data['access']}")
        today = timezone.localdate().isoformat()
        month = today[:7]

        def command(operation, payload, key=None):
            response = client.post(
                f"/api/v1/commands/{operation}/",
                payload,
                format="json",
                HTTP_IDEMPOTENCY_KEY=key or str(uuid4()),
            )
            assert response.status_code == 200, (operation, response.status_code)
            return response.data

        account = command(
            "create_account",
            {
                "name": "Conta de verificação",
                "opening_balance": "1000",
                "opening_date": today,
            },
        )
        category = command("create_category", {"name": "Transporte"})
        goal = command(
            "create_goal",
            {
                "name": "Viagem para o Japão",
                "target": "12000",
                "initial_plan_amount": "300",
                "initial_plan_month": f"{month}-01",
            },
        )
        expense = {
            "kind": "expense",
            "description": "Verificação temporária",
            "amount": "32",
            "account_id": account["id"],
            "category_id": category["id"],
            "due_date": today,
            "paid_on": today,
        }
        key = str(uuid4())
        assert command("create_transaction", expense, key) == command(
            "create_transaction", expense, key
        )
        command(
            "allocate_goal_funds",
            {
                "goal_id": goal["id"],
                "account_id": account["id"],
                "amount": "200",
                "occurred_on": today,
            },
        )
        summary = client.get(f"/api/v1/snapshot/?month={month}")
        assert summary.status_code == 200
        assert summary.data["summary"]["balance"] == "968.00"
        assert summary.data["summary"]["reserved"] == "200.00"
        assert summary.data["summary"]["available"] == "668.00"
        assert summary.data["goals"][0]["history"][-1]["accumulated"] == "200.00"
        assert summary.data["entry_count"] == 1
        other = User.objects.create_user(
            username=f"other-{uuid4().hex}", password=secrets.token_urlsafe(25)
        )
        client.force_authenticate(other)
        isolated = client.get(f"/api/v1/snapshot/?month={month}")
        assert isolated.data["goals"] == [] and isolated.data["entries"] == []
        transaction.set_rollback(True)
    assert User.objects.count() == before
    print(
        "PostgreSQL verification passed: registration, account, expense, goal plan, reserve, idempotency, isolation and rollback. No verification records retained."
    )


if __name__ == "__main__":
    main()
