from datetime import date
from uuid import uuid4

import pytest

from finance.errors import DomainError
from finance.queries import snapshot
from finance.services import execute
from planning.models import Goal, GoalPlan


def test_goal_with_initial_plan_is_atomic_idempotent_and_not_reserved(user):
    payload = {
        "name": "Viagem para o Japão",
        "target": "12000.00",
        "initial_plan_month": "2026-11-01",
        "initial_plan_amount": "300.00",
    }
    key = str(uuid4())
    result = execute(user, "create_goal", payload, key)
    assert execute(user, "create_goal", payload, key) == result
    assert Goal.objects.filter(user=user).count() == 1
    assert GoalPlan.objects.filter(user=user).count() == 1
    goal = snapshot(user, date(2026, 11, 1))["goals"][0]
    assert goal["planned"] == "300.00"
    assert goal["accumulated"] == "0.00"


@pytest.mark.parametrize(
    "fields",
    [
        {"initial_plan_amount": "300"},
        {"initial_plan_month": "2026-11-01"},
        {"initial_plan_amount": "300", "initial_plan_month": "2026-11-05"},
    ],
)
def test_incomplete_plan_does_not_leave_a_partial_goal(user, fields):
    with pytest.raises(DomainError):
        execute(user, "create_goal", {"name": "Viagem", "target": "1000", **fields}, str(uuid4()))
    assert not Goal.objects.filter(user=user).exists()
