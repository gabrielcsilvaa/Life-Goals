"""Opt-in browser → real Django API → ephemeral test database integration."""

import os
import subprocess
from datetime import date
from pathlib import Path

import pytest

from finance.models import Account, Category, Entry
from identity.models import User


@pytest.mark.skipif(
    os.getenv("LIFEGOALS_RUN_UI") != "1", reason="Run with LIFEGOALS_RUN_UI=1; requires Node and Edge."
)
@pytest.mark.django_db(transaction=True)
def test_browser_through_real_api(live_server):
    user = User.objects.create_user(
        username="browser-test", password="Browser-test-only-94!", display_name="Pessoa E2E"
    )
    Account.objects.create(
        user=user, name="Conta E2E", opening_balance="2000.00", opening_date=date(2026, 1, 1)
    )
    Category.objects.create(user=user, name="Transporte")
    mobile = Path(__file__).resolve().parents[2] / "mobile"
    result = subprocess.run(
        [
            "node",
            str(mobile / "node_modules/@playwright/test/cli.js"),
            "test",
            "app.spec.ts",
            "--grep",
            "live API",
        ],
        cwd=mobile,
        env={**os.environ, "LIFEGOALS_TEST_API": live_server.url},
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=160,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    entry = Entry.objects.get(user=user, description="Despesa real da integração")
    assert entry.description == "Despesa real da integração" and entry.settled_amount == 32

    assert Entry.objects.filter(user=user, description="Transporte", amount="18.50").exists()
    fixed = Entry.objects.get(user=user, description="Despesa fixa real")
    assert fixed.recurring_rule_id and fixed.settled_amount == 0 and not fixed.paid_on


@pytest.mark.skipif(os.getenv("LIFEGOALS_RUN_UI") != "1", reason="Requires Edge and Node")
@pytest.mark.django_db(transaction=True)
def test_first_use_creates_only_personal_records_without_importing_demo(live_server):
    from django.utils import timezone

    from finance.models import CashMovement
    from finance.queries import snapshot
    from planning.models import Goal, GoalAllocation

    mobile = Path(__file__).resolve().parents[2] / "mobile"
    result = subprocess.run(
        [
            "node",
            str(mobile / "node_modules/@playwright/test/cli.js"),
            "test",
            "usability.spec.ts",
            "--grep",
            "live API",
        ],
        cwd=mobile,
        env={**os.environ, "LIFEGOALS_TEST_API": live_server.url},
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=160,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    user = User.objects.get(username__startswith="first-use-")
    assert Account.objects.get(user=user).opening_balance == 500
    assert Entry.objects.filter(user=user).count() == 2
    assert CashMovement.objects.filter(user=user).count() == 2
    assert Goal.objects.filter(user=user).count() == 1
    assert not GoalAllocation.objects.filter(user=user).exists()
    values = snapshot(user, timezone.localdate().replace(day=1))["summary"]
    assert values["balance"] == "1475.00"
    assert values["reserved"] == "0.00"
    assert values["available"] == "1175.00"
