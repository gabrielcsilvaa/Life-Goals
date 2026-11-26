from uuid import uuid4

import pytest

from finance.errors import DomainError
from finance.services import execute
from planning.models import Goal, GoalAllocation, GoalPlan


def test_delete_goal_removes_plan_and_is_idempotent(user):
    goal = Goal.objects.create(user=user, name="Viagem", target="1000")
    GoalPlan.objects.create(user=user, goal=goal, month="2026-11-01", amount="100")
    key = str(uuid4())
    payload = {"goal_id": str(goal.pk)}
    result = execute(user, "delete_goal", payload, key)
    assert execute(user, "delete_goal", payload, key) == result
    assert not Goal.objects.filter(pk=goal.pk).exists()
    assert not GoalPlan.objects.filter(user=user).exists()


def test_delete_goal_preserves_financial_history(user, account):
    goal = Goal.objects.create(user=user, name="Reserva", target="1000")
    GoalAllocation.objects.create(
        user=user, goal=goal, account=account, amount="100", occurred_on="2026-11-01"
    )
    with pytest.raises(DomainError):
        execute(user, "delete_goal", {"goal_id": str(goal.pk)}, str(uuid4()))
    assert Goal.objects.filter(pk=goal.pk).exists()
    assert GoalAllocation.objects.filter(goal=goal).count() == 1
