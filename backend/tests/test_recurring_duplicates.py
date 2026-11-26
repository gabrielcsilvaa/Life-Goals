from uuid import uuid4

import pytest

from finance.errors import Conflict
from finance.models import RecurringRule
from finance.services import execute


def test_duplicate_rule_is_rejected_even_with_another_request_key(user, account, category):
    payload = {
        "name": "TIM",
        "amount": "78",
        "day": 1,
        "account_id": str(account.pk),
        "category_id": str(category.pk),
        "start_month": "2026-12-01",
    }
    execute(user, "create_recurring_expense", payload, str(uuid4()))
    with pytest.raises(Conflict):
        execute(user, "create_recurring_expense", {**payload, "name": "tim", "amount": "80"}, str(uuid4()))
    assert RecurringRule.objects.filter(user=user).count() == 1


def test_non_overlapping_rules_are_allowed(user, account, category):
    payload = {
        "name": "TIM",
        "amount": "78",
        "day": 1,
        "account_id": str(account.pk),
        "category_id": str(category.pk),
        "start_month": "2026-11-01",
        "end_month": "2026-11-01",
    }
    execute(user, "create_recurring_expense", payload, str(uuid4()))
    execute(
        user,
        "create_recurring_expense",
        {**payload, "start_month": "2026-12-01", "end_month": None},
        str(uuid4()),
    )
    assert RecurringRule.objects.filter(user=user).count() == 2
