from datetime import date
from decimal import Decimal
from uuid import uuid4

from finance.models import CashMovement, Entry, RecurringRule
from finance.queries import snapshot
from finance.services import execute


def test_salary_can_recur_and_never_invents_received_money(user, account, category):
    category.kind = "income"
    category.save()
    execute(
        user,
        "create_recurring_expense",
        {
            "kind": "income",
            "name": "Salário",
            "amount": "2000.00",
            "day": 5,
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "start_month": "2026-09-01",
        },
        str(uuid4()),
    )
    for _ in range(2):
        snapshot(user, date(2026, 11, 1))
    entries = Entry.objects.filter(user=user)
    assert entries.count() == 3
    assert all(e.kind == "income" and e.settled_amount == 0 and not e.paid_on for e in entries)
    assert not CashMovement.objects.filter(user=user).exists()
    assert entries.get(occurrence_month=date(2026, 11, 1)).amount == Decimal("2000")


def test_automatic_expense_clamps_day_and_preserves_cancellation(user, account, category):
    RecurringRule.objects.create(
        user=user,
        name="Academia",
        amount="140",
        category=category,
        account=account,
        day=31,
        start_month=date(2026, 2, 1),
        end_month=date(2026, 2, 1),
    )
    snapshot(user, date(2026, 2, 1))
    entry = Entry.objects.get(user=user)
    assert entry.due_date == date(2026, 2, 28)
    entry.canceled = True
    entry.save()
    snapshot(user, date(2026, 3, 1))
    assert Entry.objects.filter(user=user).count() == 1
    assert not CashMovement.objects.filter(user=user).exists()


def test_description_can_be_omitted(api, account, category):
    response = api.post(
        "/api/v1/commands/create_transaction/",
        {
            "kind": "expense",
            "amount": "12.50",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-25",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 200, response.data
    assert Entry.objects.get().description == category.name


def test_salary_policy_recalculates_each_month(user, account, category):
    category.kind = "income"
    category.save()
    execute(
        user,
        "create_recurring_expense",
        {
            "kind": "income",
            "name": "Salário",
            "amount": "2000",
            "day": 5,
            "due_rule": "salary_fifth_business_day",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "start_month": "2026-11-01",
        },
        str(uuid4()),
    )
    snapshot(user, date(2026, 11, 1))
    snapshot(user, date(2026, 12, 1))
    assert Entry.objects.get(user=user, occurrence_month=date(2026, 11, 1)).due_date == date(2026, 11, 7)
    assert Entry.objects.get(user=user, occurrence_month=date(2026, 12, 1)).due_date == date(2026, 12, 5)
    assert not CashMovement.objects.filter(user=user).exists()


def test_fixed_expense_can_be_saved_without_name_or_description(user, account, category):
    execute(
        user,
        "create_recurring_expense",
        {
            "amount": "140",
            "day": 10,
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "start_month": "2026-11-01",
        },
        str(uuid4()),
    )
    snapshot(user, date(2026, 11, 1))
    assert Entry.objects.get(user=user).description == category.name
    assert RecurringRule.objects.get(user=user).name == category.name
