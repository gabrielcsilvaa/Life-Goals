from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from django.db import close_old_connections, connection

from audit.models import AuditEvent
from finance.errors import Conflict, DomainError
from finance.models import CashMovement, Entry
from finance.services import execute
from planning.models import Goal, GoalAllocation

pytestmark = pytest.mark.django_db(transaction=True)


def race(operation):
    if connection.vendor != "postgresql":
        pytest.skip("Requires isolated PostgreSQL: SQLite cannot verify row locks.")
    barrier = Barrier(2)

    def worker():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            try:
                return operation()
            except (Conflict, DomainError) as exc:
                return exc
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(lambda _: worker(), range(2)))


def test_concurrent_identical_requests_move_cash_once(user, account, category):
    payload = {
        "kind": "expense",
        "amount": "100",
        "account_id": str(account.pk),
        "category_id": str(category.pk),
        "due_date": "2026-11-01",
        "paid_on": "2026-11-01",
    }
    results = race(
        lambda: execute(user, "create_transaction", payload, "concurrent-identical-key", source="mcp:test")
    )
    assert results[0] == results[1]
    assert Entry.objects.count() == CashMovement.objects.count() == 1
    assert AuditEvent.objects.filter(action="create_transaction").count() == 1
    assert CashMovement.objects.get().amount == -100


def test_concurrent_settlements_reject_stale_versions(user, account, category):
    entry = Entry.objects.create(
        user=user, account=account, category=category, kind="expense", amount="100", due_date="2026-11-01"
    )
    payload = {
        "entry_id": str(entry.pk),
        "version": 1,
        "account_id": str(account.pk),
        "amount": "75",
        "paid_on": "2026-11-01",
    }
    results = race(lambda: execute(user, "settle_transaction", payload, str(uuid4())))
    assert sum(isinstance(result, Conflict) for result in results) == 1
    entry.refresh_from_db()
    assert entry.settled_amount == 75
    assert CashMovement.objects.count() == 1


def test_concurrent_reservations_cannot_overreserve(user, account):
    goal = Goal.objects.create(user=user, name="Test goal", target="5000")
    payload = {
        "goal_id": str(goal.pk),
        "account_id": str(account.pk),
        "amount": "1500",
        "occurred_on": "2026-11-01",
    }
    results = race(lambda: execute(user, "allocate_goal_funds", payload, str(uuid4())))
    assert sum(isinstance(result, DomainError) for result in results) == 1
    assert GoalAllocation.objects.count() == 1
    assert GoalAllocation.objects.get().amount == 1500
    assert not CashMovement.objects.exists()


def test_snapshot_keeps_owner_lock_until_all_totals_are_read(user, account, category, monkeypatch):
    if connection.vendor != "postgresql":
        pytest.skip("Requires isolated PostgreSQL row locks.")
    from datetime import date
    from threading import Event

    from django.db import DatabaseError, transaction

    from finance import services
    from finance.queries import snapshot
    from identity.models import User

    entry = Entry.objects.create(
        user=user, account=account, category=category, kind="expense", amount="100", due_date="2026-11-01"
    )
    original = services.ensure_recurring_month
    reading, checked = Event(), Event()

    def paused(owner, month):
        result = original(owner, month)
        reading.set()
        assert checked.wait(10)
        return result

    monkeypatch.setattr(services, "ensure_recurring_month", paused)

    def read():
        close_old_connections()
        try:
            return snapshot(user, date(2026, 11, 1))
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(read)
        assert reading.wait(10)
        try:
            with pytest.raises(DatabaseError), transaction.atomic():
                User.objects.select_for_update(nowait=True).get(pk=user.pk)
        finally:
            checked.set()
        before = future.result(timeout=10)["summary"]
    execute(
        user,
        "settle_transaction",
        {
            "entry_id": str(entry.pk),
            "version": 1,
            "account_id": str(account.pk),
            "amount": "100",
            "paid_on": "2026-11-01",
        },
        str(uuid4()),
    )
    assert before["balance"] == "2000.00" and before["unpaid"] == "100.00"
    after = snapshot(user, date(2026, 11, 1))["summary"]
    assert after["balance"] == "1900.00" and after["unpaid"] == "0.00"
