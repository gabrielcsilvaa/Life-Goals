from datetime import date

import pytest
from rest_framework.test import APIClient

from finance.models import Account, Category
from identity.models import User


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="gabriel", password="strong-password-123", display_name="Gabriel"
    )


@pytest.fixture
def other(db):
    return User.objects.create_user(username="other", password="another-password-123")


@pytest.fixture
def account(user):
    return Account.objects.create(
        user=user, name="Conta principal", opening_balance="2000.00", opening_date=date(2026, 1, 1)
    )


@pytest.fixture
def category(user):
    return Category.objects.create(user=user, name="Transporte")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client
