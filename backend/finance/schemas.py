from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Money = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]

NonnegativeMoney = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]

Name = Annotated[str, Field(min_length=1, max_length=120)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AccountInput(Input):
    name: Annotated[str, Field(min_length=1, max_length=80)]

    opening_balance: Annotated[Decimal, Field(max_digits=14, decimal_places=2)] = Decimal("0")

    opening_date: date


class CategoryInput(Input):
    kind: Literal["income", "expense", "both"] = "both"

    name: Annotated[str, Field(min_length=1, max_length=60)]

    color: Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")] = "#168477"


class CategoryUpdate(CategoryInput):
    kind: Literal["income", "expense", "both"] | None = None

    category_id: UUID

    archived: bool = False


class EntryInput(Input):
    kind: Literal["income", "expense"]

    description: Annotated[str, Field(max_length=120)] = ""

    amount: Money

    category_id: UUID

    account_id: UUID

    due_date: date

    paid_on: date | None = None


class EntryUpdate(Input):
    entry_id: UUID

    version: Annotated[int, Field(ge=1)]

    description: Annotated[str, Field(max_length=120)] = ""

    amount: Money

    category_id: UUID

    due_date: date


class EntryAction(Input):
    entry_id: UUID

    version: Annotated[int, Field(ge=1)]


class EntryCorrection(EntryUpdate):
    realized: bool | None = None
    confirmed: Literal[True]


class EntryDeletion(EntryAction):
    confirmed: Literal[True]


class SettlementInput(EntryAction):
    account_id: UUID

    amount: Money

    paid_on: date


class CardInput(Input):
    name: Annotated[str, Field(min_length=1, max_length=80)]

    closing_day: Annotated[int, Field(ge=1, le=31)]

    due_day: Annotated[int, Field(ge=1, le=31)]

    blocked: bool = False


class BlockCard(Input):
    card_id: UUID

    blocked: bool


class PurchaseInput(Input):
    card_id: UUID

    category_id: UUID

    description: Annotated[str, Field(max_length=120)] = ""

    total: Money

    installments: Annotated[int, Field(ge=1, le=120)]

    purchased_on: date

    first_due_date: date


class RecurringInput(Input):
    due_rule: Literal["calendar_day", "salary_fifth_business_day"] = "calendar_day"
    kind: Literal["income", "expense"] = "expense"
    name: Annotated[str, Field(max_length=120)] = ""

    amount: Money

    category_id: UUID

    account_id: UUID

    day: Annotated[int, Field(ge=1, le=31)]

    start_month: date

    end_month: date | None = None

    @field_validator("start_month", "end_month")
    @classmethod
    def month_start(cls, value):

        if value is not None and value.day != 1:
            raise ValueError("Informe o primeiro dia do mês.")

        return value


class RecurringUpdate(RecurringInput):
    recurring_id: UUID

    active: bool = True


class GenerateInput(Input):
    month: date

    @field_validator("month")
    @classmethod
    def month_start(cls, value):

        if value.day != 1:
            raise ValueError("Informe o primeiro dia do mês.")

        return value


class GoalInput(Input):
    name: Annotated[str, Field(min_length=1, max_length=80)]

    target: Money

    target_date: date | None = None


class GoalUpdate(GoalInput):
    goal_id: UUID


class GoalCreateInput(GoalInput):
    initial_plan_amount: NonnegativeMoney | None = None

    initial_plan_month: date | None = None

    @model_validator(mode="after")
    def initial_plan_pair(self):

        if (self.initial_plan_amount is None) != (self.initial_plan_month is None):
            raise ValueError("Informe o valor e o mês do aporte planejado juntos.")

        if self.initial_plan_month and self.initial_plan_month.day != 1:
            raise ValueError("O mês planejado deve usar o primeiro dia do mês.")

        return self


class GoalPlanInput(GenerateInput):
    goal_id: UUID

    amount: NonnegativeMoney


class AllocationInput(Input):
    goal_id: UUID

    account_id: UUID

    amount: Money

    occurred_on: date

    direction: Literal["reserve", "withdraw"] = "reserve"


class BudgetInput(GenerateInput):
    category_id: UUID

    amount: NonnegativeMoney


class PlanTransferInput(GenerateInput):
    from_goal_id: UUID

    to_goal_id: UUID

    amount: Money


class InvoicePayment(GenerateInput):
    card_id: UUID

    account_id: UUID

    amount: Money

    paid_on: date


class OpeningInvoice(Input):
    card_id: UUID

    category_id: UUID

    amount: Money

    due_date: date


class GoalDeleteInput(Input):
    goal_id: UUID
