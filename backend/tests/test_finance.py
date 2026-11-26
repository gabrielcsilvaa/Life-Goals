from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from rest_framework.exceptions import NotFound

from audit.models import AuditEvent
from finance.errors import Conflict, DomainError
from finance.models import CashMovement, Entry
from finance.queries import snapshot
from finance.services import execute
from planning.models import GoalAllocation


def call(user, op, payload, key=None):
    return execute(user, op, payload, key or str(uuid4()))


def expense(account, category, **changes):
    return {
        "kind": "expense",
        "description": "Uber",
        "amount": "32.00",
        "category_id": str(category.pk),
        "account_id": str(account.pk),
        "due_date": "2026-11-01",
        **changes,
    }


def test_planned_expense_does_not_move_cash(user, account, category):
    call(user, "create_transaction", expense(account, category))
    data = snapshot(user, date(2026, 11, 1))["summary"]
    assert data["balance"] == "2000.00"
    assert data["expense_paid"] == "0.00"
    assert data["available"] == "1968.00"
    assert CashMovement.objects.count() == 0


def test_paid_expense_not_deducted_twice(user, account, category):
    call(user, "create_transaction", expense(account, category, paid_on="2026-11-01"))
    data = snapshot(user, date(2026, 11, 1))["summary"]
    assert data["balance"] == data["available"] == "1968.00"
    assert data["unpaid"] == "0.00"


def test_retries_are_idempotent_and_payload_conflicts(user, account, category):
    payload = expense(account, category, paid_on="2026-11-01")
    a = call(user, "create_transaction", payload, "same-request-key")
    b = call(user, "create_transaction", payload, "same-request-key")
    assert a == b
    assert Entry.objects.count() == CashMovement.objects.count() == AuditEvent.objects.count() == 1
    with pytest.raises(Conflict):
        call(user, "create_transaction", {**payload, "amount": "33.00"}, "same-request-key")


def test_cross_account_reference_is_rejected_and_rolled_back(user, other, account, category):
    with pytest.raises(NotFound):
        call(other, "create_transaction", expense(account, category))
    assert Entry.objects.count() == CashMovement.objects.count() == 0
    assert snapshot(other, date(2026, 11, 1))["accounts"] == []


@pytest.mark.parametrize("amount", ["0", "-1", "1.001", "NaN", "Infinity"])
def test_invalid_money(user, account, category, amount):
    with pytest.raises(DomainError):
        call(user, "create_transaction", expense(account, category, amount=amount))
    assert Entry.objects.count() == 0


def test_partial_settlement_and_version_conflict(user, account, category):
    entry = call(user, "create_transaction", expense(account, category))
    updated = call(
        user,
        "settle_transaction",
        {
            "entry_id": entry["id"],
            "version": 1,
            "account_id": str(account.pk),
            "amount": "12.00",
            "paid_on": "2026-11-01",
        },
    )
    assert updated["status"] == "partial"
    data = snapshot(user, date(2026, 11, 1))["summary"]
    assert data["balance"] == "1988.00" and data["unpaid"] == "20.00" and data["available"] == "1968.00"
    with pytest.raises(Conflict):
        call(user, "cancel_transaction", {"entry_id": entry["id"], "version": 1})


def test_canceled_occurrence_is_not_regenerated(user, account, category):
    call(
        user,
        "create_recurring_expense",
        {
            "name": "Academia",
            "amount": "140.00",
            "day": 31,
            "account_id": str(account.pk),
            "category_id": str(category.pk),
            "start_month": "2027-01-01",
        },
    )
    assert call(user, "generate_recurring_expenses", {"month": "2027-02-01"})["created"] == 1
    obj = Entry.objects.get()
    assert obj.due_date == date(2027, 2, 28) and obj.settled_amount == 0
    call(user, "cancel_transaction", {"entry_id": str(obj.pk), "version": obj.version})
    assert call(user, "generate_recurring_expenses", {"month": "2027-02-01"})["created"] == 0


def test_card_installments_cents_year_boundary_and_payment(user, account, category):
    card = call(user, "create_card", {"name": "Mercado Pago", "closing_day": 25, "due_day": 5})
    purchase = call(
        user,
        "create_card_purchase",
        {
            "card_id": card["id"],
            "category_id": str(category.pk),
            "description": "Compra",
            "total": "100.00",
            "installments": 3,
            "purchased_on": "2026-10-01",
            "first_due_date": "2026-11-05",
        },
    )
    rows = purchase["installments"]
    assert [e["amount"] for e in rows] == ["33.34", "33.33", "33.33"]
    assert rows[-1]["due_date"] == "2027-01-05"
    call(
        user,
        "settle_transaction",
        {
            "entry_id": rows[0]["id"],
            "version": 1,
            "account_id": str(account.pk),
            "amount": "33.34",
            "paid_on": "2026-11-05",
        },
    )
    data = snapshot(user, date(2026, 11, 1))
    assert data["summary"]["expense_expected"] == "33.34"
    assert data["summary"]["balance"] == data["summary"]["available"] == "1966.66"
    assert data["category_expenses"][0]["amount"] == "33.34"


def test_blocked_card_rejects_purchase(user, category):
    card = call(user, "create_card", {"name": "Nubank", "closing_day": 20, "due_day": 2, "blocked": True})
    with pytest.raises(DomainError):
        call(
            user,
            "create_card_purchase",
            {
                "card_id": card["id"],
                "category_id": str(category.pk),
                "description": "Inválida",
                "total": "10",
                "installments": 1,
                "purchased_on": "2026-11-01",
                "first_due_date": "2026-12-02",
            },
        )


def test_goal_plan_is_not_real_money_and_reserving_does_not_double_subtract(user, account):
    goal = call(user, "create_goal", {"name": "Itália", "target": "8000"})
    call(user, "set_goal_plan", {"goal_id": goal["id"], "month": "2026-11-01", "amount": "600"})
    before = snapshot(user, date(2026, 11, 1))
    assert before["goals"][0]["accumulated"] == "0.00" and before["summary"]["available"] == "1400.00"
    call(
        user,
        "allocate_goal_funds",
        {"goal_id": goal["id"], "account_id": str(account.pk), "amount": "200", "occurred_on": "2026-11-01"},
    )
    after = snapshot(user, date(2026, 11, 1))
    assert after["summary"]["balance"] == "2000.00"
    assert after["summary"]["available"] == "1400.00"
    assert after["summary"]["reserved"] == "200.00" and after["summary"]["goal_plan_remaining"] == "400.00"
    assert CashMovement.objects.count() == 0


def test_goal_chart_uses_actual_reserves_with_withdrawals_cutoff_and_user_isolation(
    user, other, account, monkeypatch
):
    from datetime import datetime
    from datetime import timezone as dt_timezone

    from finance.models import Account
    from planning.models import Goal

    monkeypatch.setattr(
        "finance.queries.timezone.now", lambda: datetime(2026, 11, 25, 12, tzinfo=dt_timezone.utc)
    )
    goal = Goal.objects.create(user=user, name="Itália", target="8000")
    for occurred_on, amount in [
        ("2026-05-10", "50"),
        ("2026-09-03", "100"),
        ("2026-10-08", "-30"),
        ("2026-11-30", "999"),
    ]:
        GoalAllocation.objects.create(
            user=user, goal=goal, account=account, occurred_on=occurred_on, amount=amount
        )
    other_account = Account.objects.create(
        user=other, name="Outra conta", opening_balance="500", opening_date="2026-01-01"
    )
    other_goal = Goal.objects.create(user=other, name="Outra meta", target="500")
    GoalAllocation.objects.create(
        user=other, goal=other_goal, account=other_account, occurred_on="2026-10-01", amount="500"
    )
    call(user, "set_goal_plan", {"goal_id": str(goal.pk), "month": "2026-11-01", "amount": "600"})
    data = snapshot(user, date(2026, 11, 1))
    assert len(data["goals"]) == 1
    result = data["goals"][0]
    assert result["accumulated"] == "120.00"
    assert result["history"] == [
        {"month": f"2026-{month}", "accumulated": value}
        for month, value in [
            ("06", "50.00"),
            ("07", "50.00"),
            ("08", "50.00"),
            ("09", "150.00"),
            ("10", "120.00"),
            ("11", "120.00"),
        ]
    ]


def test_reserving_beyond_available_and_excess_withdrawal_rejected(user, account):
    goal = call(user, "create_goal", {"name": "Reserva", "target": "10000"})
    with pytest.raises(DomainError):
        call(
            user,
            "allocate_goal_funds",
            {
                "goal_id": goal["id"],
                "account_id": str(account.pk),
                "amount": "2001",
                "occurred_on": "2026-11-01",
            },
        )
    with pytest.raises(DomainError):
        call(
            user,
            "allocate_goal_funds",
            {
                "goal_id": goal["id"],
                "account_id": str(account.pk),
                "amount": "1",
                "occurred_on": "2026-11-01",
                "direction": "withdraw",
            },
        )
    assert GoalAllocation.objects.count() == 0


def test_budget_deducts_only_uncommitted_remainder(user, account, category):
    call(user, "set_budget", {"month": "2026-11-01", "category_id": str(category.pk), "amount": "200"})
    call(user, "create_transaction", expense(account, category, amount="50"))
    summary = snapshot(user, date(2026, 11, 1))["summary"]
    assert summary["budget_remaining"] == "150.00" and summary["available"] == "1800.00"


def test_goal_plan_transfer_preserves_total_and_audit(user, account):
    first = call(user, "create_goal", {"name": "Europa", "target": "8000"})
    second = call(user, "create_goal", {"name": "Reserva", "target": "4000"})
    call(user, "set_goal_plan", {"goal_id": first["id"], "month": "2026-11-01", "amount": "600"})
    call(
        user,
        "transfer_goal_plan",
        {"from_goal_id": first["id"], "to_goal_id": second["id"], "month": "2026-11-01", "amount": "100"},
    )
    data = snapshot(user, date(2026, 11, 1))
    assert sum(Decimal(g["planned"]) for g in data["goals"]) == 600
    assert AuditEvent.objects.filter(action="transfer_goal_plan").count() == 1


def test_future_realization_and_opening_date_guard(user, account, category):
    with pytest.raises(DomainError):
        call(user, "create_transaction", expense(account, category, paid_on="2099-01-01"))
    with pytest.raises(DomainError):
        call(user, "create_transaction", expense(account, category, paid_on="2025-12-31"))
    assert Entry.objects.count() == 0


def test_withdrawing_prior_month_reserve_with_zero_plan_releases_available_cash(user, account):
    goal = call(user, "create_goal", {"name": "Reserva", "target": "10000"})
    call(user, "set_goal_plan", {"goal_id": goal["id"], "month": "2026-11-01", "amount": "0"})
    call(
        user,
        "allocate_goal_funds",
        {"goal_id": goal["id"], "account_id": str(account.pk), "amount": "1000", "occurred_on": "2026-10-01"},
    )
    call(
        user,
        "allocate_goal_funds",
        {
            "goal_id": goal["id"],
            "account_id": str(account.pk),
            "amount": "100",
            "occurred_on": "2026-11-01",
            "direction": "withdraw",
        },
    )
    summary = snapshot(user, date(2026, 11, 1))["summary"]
    assert summary["reserved"] == "900.00"
    assert summary["goal_plan_remaining"] == "0.00"
    assert summary["available"] == "1100.00"
