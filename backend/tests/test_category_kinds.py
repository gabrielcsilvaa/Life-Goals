from uuid import uuid4

import pytest

from finance.models import Category, Entry
from identity.defaults import ensure_default_categories


@pytest.mark.parametrize("entry_kind,category_kind", [("income", "expense"), ("expense", "income")])
def test_rejects_category_from_other_kind(api, user, account, entry_kind, category_kind):
    category = Category.objects.create(user=user, name="Categoria", kind=category_kind)
    response = api.post(
        "/api/v1/commands/create_transaction/",
        {
            "kind": entry_kind,
            "description": "Teste",
            "amount": "25.00",
            "category_id": str(category.pk),
            "account_id": str(account.pk),
            "due_date": "2026-11-25",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 400
    assert not Entry.objects.filter(user=user).exists()


def test_defaults_have_scoped_categories(user):
    ensure_default_categories(user)
    assert Category.objects.get(user=user, name="Salário").kind == "income"
    assert Category.objects.get(user=user, name="Alimentação").kind == "expense"


def test_legacy_category_edit_preserves_kind(api, user):
    category = Category.objects.create(user=user, name="Salário", kind="income")
    response = api.post(
        "/api/v1/commands/update_category/",
        {
            "category_id": str(category.pk),
            "name": "Salário mensal",
            "color": "#344A35",
            "archived": False,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 200, response.data
    category.refresh_from_db()
    assert category.kind == "income"
