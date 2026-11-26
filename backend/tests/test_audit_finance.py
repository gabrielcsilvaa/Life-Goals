from datetime import date, datetime
from datetime import timezone as dt_timezone
from uuid import uuid4

import pytest

from finance.errors import DomainError
from finance.models import Card, CardInvoice, CashMovement, Entry, RecurringRule
from finance.queries import snapshot
from finance.services import execute


def test_future_summary_includes_intermediate_recurring_commitments(user, account, category, monkeypatch):
    monkeypatch.setattr(
        "finance.services.timezone.now", lambda: datetime(2026, 11, 26, 12, tzinfo=dt_timezone.utc)
    )
    RecurringRule.objects.create(
        user=user,
        name="Fixed expense",
        amount="140",
        category=category,
        account=account,
        day=10,
        start_month=date(2026, 12, 1),
    )
    first = snapshot(user, date(2027, 2, 1))
    assert first["summary"]["unpaid"] == "420.00"
    assert first["summary"]["available"] == "1580.00"
    assert Entry.objects.filter(user=user).count() == 3
    snapshot(user, date(2026, 12, 1))
    snapshot(user, date(2027, 2, 1))
    assert Entry.objects.filter(user=user).count() == 3
    assert not CashMovement.objects.exists()


def test_generic_edit_cannot_detach_card_entry_from_its_invoice(user, category):
    card = Card.objects.create(user=user, name="Test card", closing_day=5, due_day=12)
    entry = execute(
        user,
        "register_opening_invoice",
        {"card_id": str(card.pk), "category_id": str(category.pk), "amount": "100", "due_date": "2026-11-12"},
        str(uuid4()),
    )
    with pytest.raises(DomainError):
        execute(
            user,
            "update_transaction",
            {
                "entry_id": entry["id"],
                "version": 1,
                "category_id": str(category.pk),
                "amount": "100",
                "due_date": "2026-12-12",
            },
            str(uuid4()),
        )
    stored = Entry.objects.get(pk=entry["id"])
    assert stored.due_date == stored.invoice.due_date == date(2026, 11, 12)
    assert CardInvoice.objects.count() == 1


def test_partial_advance_receipt_separates_real_balance_from_projection(user, account, category):
    result = execute(
        user,
        "create_transaction",
        {
            "kind": "income",
            "amount": "2000",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-12-05",
        },
        str(uuid4()),
    )
    execute(
        user,
        "settle_transaction",
        {
            "entry_id": result["id"],
            "version": 1,
            "account_id": str(account.pk),
            "amount": "500",
            "paid_on": "2026-11-01",
        },
        str(uuid4()),
    )
    nov = snapshot(user, date(2026, 11, 1))["summary"]
    dec = snapshot(user, date(2026, 12, 1))["summary"]
    assert nov["balance"] == dec["balance"] == "2500.00"
    assert dec["income_received"] == "500.00"
    assert dec["available"] == "2500.00"
    assert dec["projected_available"] == "4000.00"
    assert CashMovement.objects.count() == 1


def test_partial_advance_expense_is_not_deducted_twice(user, account, category):
    entry = execute(
        user,
        "create_transaction",
        {
            "kind": "expense",
            "amount": "140",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-12-12",
        },
        str(uuid4()),
    )
    execute(
        user,
        "settle_transaction",
        {
            "entry_id": entry["id"],
            "version": 1,
            "account_id": str(account.pk),
            "amount": "70",
            "paid_on": "2026-11-01",
        },
        str(uuid4()),
    )
    dec = snapshot(user, date(2026, 12, 1))["summary"]
    assert dec["balance"] == "1930.00"
    assert dec["unpaid"] == dec["expense_paid"] == "70.00"
    assert dec["available"] == "1860.00"
    assert Entry.objects.get(pk=entry["id"]).settled_amount == 70
    assert CashMovement.objects.count() == 1
