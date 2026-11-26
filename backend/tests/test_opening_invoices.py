from datetime import date
from uuid import uuid4

import pytest
from rest_framework.exceptions import NotFound

from audit.models import AuditEvent
from finance.errors import DomainError
from finance.models import Card, CardInvoice, CashMovement, Entry
from finance.queries import snapshot
from finance.services import execute


def call(user, operation, payload, key=None):
    return execute(user, operation, payload, key or str(uuid4()))


def opening(card, category, due="2026-11-12"):
    return {"card_id": str(card.pk), "category_id": str(category.pk), "amount": "660.00", "due_date": due}


@pytest.fixture
def card(user):
    return Card.objects.create(user=user, name="Test card", closing_day=5, due_day=12, blocked=True)


@pytest.mark.parametrize("paid", [False, True])
def test_opening_balance_cannot_be_repeated_in_another_month(user, account, category, card, paid):
    payload = opening(card, category)
    first = call(user, "register_opening_invoice", payload, "opening-retry-key")
    if paid:
        call(
            user,
            "pay_card_invoice",
            {
                "card_id": str(card.pk),
                "account_id": str(account.pk),
                "month": "2026-11-01",
                "amount": "660.00",
                "paid_on": "2026-11-12",
            },
        )
    # Exact retries return the original result, even after settlement.
    assert call(user, "register_opening_invoice", payload, "opening-retry-key") == first
    with pytest.raises(DomainError, match="inicial"):
        call(user, "register_opening_invoice", opening(card, category, "2026-12-12"))
    assert Entry.objects.filter(card=card).count() == 1
    assert CardInvoice.objects.filter(card=card).count() == 1
    assert CashMovement.objects.count() == int(paid)


def test_cancel_duplicate_preserves_paid_history_and_cash(user, account, category, card):
    first = call(user, "register_opening_invoice", opening(card, category))
    paid = call(
        user,
        "settle_transaction",
        {
            "entry_id": first["id"],
            "version": 1,
            "account_id": str(account.pk),
            "amount": "660.00",
            "paid_on": "2026-11-12",
        },
    )
    # Reproduce a legacy duplicate already persisted before the guard existed.
    invoice = CardInvoice.objects.create(user=user, card=card, month="2026-12-01", due_date="2026-12-12")
    duplicate = Entry.objects.create(
        user=user,
        card=card,
        invoice=invoice,
        category=category,
        kind="expense",
        amount="660.00",
        due_date="2026-12-12",
        description="Opening balance",
    )
    before_movements = list(CashMovement.objects.values())
    paid_before = Entry.objects.filter(pk=first["id"]).values().get()
    assert snapshot(user, date(2026, 12, 1))["summary"]["unpaid"] == "660.00"
    payload = {"entry_id": str(duplicate.pk), "version": 1}
    result = call(user, "cancel_transaction", payload, "cancel-duplicate-key")
    assert call(user, "cancel_transaction", payload, "cancel-duplicate-key") == result
    assert result["status"] == "canceled"
    assert Entry.objects.filter(pk=first["id"]).values().get() == paid_before
    assert list(CashMovement.objects.values()) == before_movements
    assert AuditEvent.objects.filter(action="cancel_transaction").count() == 1
    for _ in range(2):
        nov = snapshot(user, date(2026, 11, 1))
        dec = snapshot(user, date(2026, 12, 1))
        assert nov["cards"][0]["invoice_total"] == nov["cards"][0]["invoice_paid"] == "660.00"
        assert dec["cards"][0]["invoice_total"] == dec["cards"][0]["invoice_paid"] == "0.00"
        assert dec["summary"]["unpaid"] == dec["summary"]["expense_expected"] == "0.00"
        assert dec["summary"]["balance"] == dec["summary"]["available"] == "1340.00"
        assert dec["upcoming"] == []
        assert dec["entries"][0]["status"] == "canceled"
    with pytest.raises(DomainError):
        call(user, "cancel_transaction", {"entry_id": paid["id"], "version": paid["version"]})
    with pytest.raises(DomainError, match="excede"):
        call(
            user,
            "pay_card_invoice",
            {
                "card_id": str(card.pk),
                "account_id": str(account.pk),
                "month": "2026-12-01",
                "amount": "660.00",
                "paid_on": "2026-11-12",
            },
        )
    assert list(CashMovement.objects.values()) == before_movements


def test_canceled_opening_can_be_replaced_in_correct_month(user, category, card):
    wrong = call(user, "register_opening_invoice", opening(card, category, "2026-12-12"))
    call(user, "cancel_transaction", {"entry_id": wrong["id"], "version": 1})
    correct = call(user, "register_opening_invoice", opening(card, category))
    assert correct["due_date"] == "2026-11-12"
    assert Entry.objects.filter(card=card, canceled=False).count() == 1


def test_block_prevents_new_purchases_but_preserves_future_installments_and_payment(
    user, account, category, card
):
    call(user, "set_card_block", {"card_id": str(card.pk), "blocked": False})
    payload = {
        "card_id": str(card.pk),
        "category_id": str(category.pk),
        "description": "Test purchase",
        "total": "60.00",
        "installments": 2,
        "purchased_on": "2026-10-01",
        "first_due_date": "2026-11-12",
    }
    call(user, "create_card_purchase", payload)
    call(user, "set_card_block", {"card_id": str(card.pk), "blocked": True})
    with pytest.raises(DomainError, match="bloqueado"):
        call(user, "create_card_purchase", payload)
    call(
        user,
        "pay_card_invoice",
        {
            "card_id": str(card.pk),
            "account_id": str(account.pk),
            "month": "2026-11-01",
            "amount": "30.00",
            "paid_on": "2026-11-12",
        },
    )
    assert Entry.objects.count() == 2
    dec = snapshot(user, date(2026, 12, 1))
    assert dec["cards"][0]["blocked"] is True
    assert dec["cards"][0]["invoice_total"] == dec["summary"]["unpaid"] == "30.00"


def test_opening_validation_is_scoped_to_card_and_user(user, other, category, card):
    call(user, "register_opening_invoice", opening(card, category))
    second = Card.objects.create(user=user, name="Other card", closing_day=5, due_day=12)
    call(user, "register_opening_invoice", opening(second, category))
    with pytest.raises(NotFound):
        call(other, "register_opening_invoice", opening(card, category))
    assert Entry.objects.filter(user=user).count() == 2
    assert not Entry.objects.filter(user=other).exists()
