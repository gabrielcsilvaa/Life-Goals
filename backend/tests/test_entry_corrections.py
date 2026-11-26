from datetime import date
from uuid import uuid4

import pytest

from finance.errors import DomainError
from finance.models import CashMovement, Entry
from finance.queries import snapshot
from finance.services import execute


def call(user, op, payload, key=None):
    return execute(user, op, payload, key or str(uuid4()))


@pytest.mark.parametrize("kind", ["income", "expense"])
def test_realized_entry_correction_and_deletion_adjust_cash_once(user, account, category, kind):
    created = call(
        user,
        "create_transaction",
        {
            "kind": kind,
            "description": "Erro",
            "amount": "1000",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-01",
            "paid_on": "2026-11-01",
        },
    )
    corrected = call(
        user,
        "correct_transaction",
        {
            "entry_id": created["id"],
            "version": created["version"],
            "description": "Corrigido",
            "amount": "100",
            "category_id": str(category.pk),
            "due_date": "2026-11-01",
            "confirmed": True,
        },
    )
    assert corrected["settled_amount"] == "100.00"
    assert CashMovement.objects.count() == 2
    total = sum(m.amount for m in CashMovement.objects.all())
    assert total == (100 if kind == "income" else -100)
    key = str(uuid4())
    payload = {"entry_id": created["id"], "version": corrected["version"], "confirmed": True}
    assert call(user, "delete_transaction", payload, key) == call(user, "delete_transaction", payload, key)
    assert sum(m.amount for m in CashMovement.objects.all()) == 0
    assert Entry.objects.get().canceled
    assert snapshot(user, date(2026, 11, 1))["summary"]["balance"] == "2000.00"


def test_delete_needs_confirmation_and_rejects_other_owner(user, other, account, category):
    e = call(
        user,
        "create_transaction",
        {
            "kind": "income",
            "amount": "1000",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-01",
        },
    )
    with pytest.raises(DomainError):
        call(user, "delete_transaction", {"entry_id": e["id"], "version": e["version"]})
    from rest_framework.exceptions import NotFound

    with pytest.raises(NotFound):
        call(other, "delete_transaction", {"entry_id": e["id"], "version": e["version"], "confirmed": True})
    assert not Entry.objects.get().canceled


def test_receipt_can_be_reopened_as_planned_without_received_balance(user, account, category):
    e = call(
        user,
        "create_transaction",
        {
            "kind": "income",
            "amount": "1000",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-30",
            "paid_on": "2026-11-26",
        },
    )
    result = call(
        user,
        "correct_transaction",
        {
            "entry_id": e["id"],
            "version": e["version"],
            "amount": "1000",
            "category_id": str(category.pk),
            "due_date": "2026-11-30",
            "confirmed": True,
            "realized": False,
        },
    )
    assert result["status"] == "pending" and result["settled_amount"] == "0.00" and result["paid_on"] is None
    summary = snapshot(user, date(2026, 11, 1))["summary"]
    assert summary["balance"] == "2000.00" and summary["income_received"] == "0.00"
    assert sum(m.amount for m in CashMovement.objects.all()) == 0


def test_future_receipt_date_does_not_settle_income(user, account, category):
    result = call(
        user,
        "create_transaction",
        {
            "kind": "income",
            "amount": "1000",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2027-01-05",
        },
    )
    assert result["status"] == "pending" and result["paid_on"] is None
    assert not CashMovement.objects.exists()
