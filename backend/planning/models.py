from django.db import models

from finance.models import Account, Category, OwnedModel


class Goal(OwnedModel):
    name = models.CharField(max_length=80)
    target = models.DecimalField(max_digits=14, decimal_places=2)
    target_date = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(target__gt=0), name="positive_goal_target")]


class GoalPlan(OwnedModel):
    goal = models.ForeignKey(Goal, on_delete=models.PROTECT, related_name="plans")
    month = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["goal", "month"], name="unique_goal_month_plan"),
            models.CheckConstraint(condition=models.Q(amount__gte=0), name="nonnegative_goal_plan"),
        ]


class GoalAllocation(OwnedModel):
    goal = models.ForeignKey(Goal, on_delete=models.PROTECT, related_name="allocations")
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    occurred_on = models.DateField()


class Budget(OwnedModel):
    month = models.DateField()
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "category", "month"], name="unique_category_month_budget"
            ),
            models.CheckConstraint(condition=models.Q(amount__gte=0), name="nonnegative_budget"),
        ]
