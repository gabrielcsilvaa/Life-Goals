"""Financial commands shared by REST, MCP and scheduled jobs.



Writes serialize per owner: adequate for personal finance and safe across workers

on PostgreSQL. SQLite is used only by isolated tests, never as production fallback.

"""

import calendar
import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from pydantic import ValidationError
from rest_framework.exceptions import NotFound

from audit.models import AuditEvent
from identity.models import User
from planning.models import Budget, Goal, GoalAllocation, GoalPlan

from . import schemas
from .errors import Conflict, DomainError
from .models import (
    Account,
    Card,
    CardInvoice,
    CashMovement,
    Category,
    Entry,
    IdempotencyRecord,
    Purchase,
    RecurringRule,
)

ZERO = Decimal("0.00")


def amount_string(value):

    return f"{value:.2f}"


def month_bounds(month):

    start = month.replace(day=1)

    return start, start.replace(day=calendar.monthrange(start.year, start.month)[1])


def add_months(value, offset):

    absolute = value.year * 12 + value.month - 1 + offset

    year, zero_month = divmod(absolute, 12)

    month = zero_month + 1

    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def owned(model, user, pk):

    obj = model.objects.filter(user=user, pk=pk).first()

    if obj is None:
        raise NotFound("Registro não encontrado.")

    return obj


def category(user, pk, kind="expense"):

    obj = owned(Category, user, pk)

    if obj.archived:
        raise DomainError("Categoria arquivada.")

    if obj.kind not in {kind, "both"}:
        raise DomainError("Esta categoria pertence a outro tipo de lancamento.")
    return obj


def account_balance(account, as_of):

    if as_of < account.opening_date:
        return ZERO

    movements = (
        CashMovement.objects.filter(account=account, occurred_on__lte=as_of).aggregate(total=Sum("amount"))[
            "total"
        ]
        or ZERO
    )

    return account.opening_balance + movements


def reserved_balance(account, as_of):

    return (
        GoalAllocation.objects.filter(account=account, occurred_on__lte=as_of).aggregate(total=Sum("amount"))[
            "total"
        ]
        or ZERO
    )


def valid_actual_date(user, value, account=None):

    from zoneinfo import ZoneInfo

    today = timezone.now().astimezone(ZoneInfo(user.timezone)).date()

    if value > today:
        raise DomainError("Uma movimentação realizada não pode ter data futura. Cadastre como prevista.")

    if account and value < account.opening_date:
        raise DomainError("A movimentação não pode anteceder a abertura da conta.")


def serialize_entry(entry):

    return {
        "id": str(entry.pk),
        "kind": entry.kind,
        "description": entry.description,
        "amount": amount_string(entry.amount),
        "settled_amount": amount_string(entry.settled_amount),
        "category_id": str(entry.category_id),
        "account_id": str(entry.account_id) if entry.account_id else None,
        "card_id": str(entry.card_id) if entry.card_id else None,
        "due_date": entry.due_date.isoformat(),
        "paid_on": entry.paid_on.isoformat() if entry.paid_on else None,
        "status": "canceled"
        if entry.canceled
        else "paid"
        if entry.settled_amount == entry.amount
        else "partial"
        if entry.settled_amount
        else "pending",
        "version": entry.version,
        "installment_number": entry.installment_number,
        "recurring": entry.recurring_rule_id is not None,
    }


def check_version(entry, version):

    if entry.version != version:
        raise Conflict("Este lançamento foi alterado. Atualize a tela antes de tentar novamente.")


def settle(user, entry, account, amount, paid_on):

    valid_actual_date(user, paid_on, account)

    if entry.canceled or amount > entry.amount - entry.settled_amount:
        raise DomainError("Valor maior que o saldo pendente ou lançamento cancelado.")

    if entry.account_id and entry.account_id != account.pk:
        raise DomainError("Use a conta vinculada ao lançamento.")

    if entry.paid_on and paid_on < entry.paid_on:
        raise DomainError("A liquidação adicional não pode anteceder a última liquidação.")

    CashMovement.objects.create(
        user=user,
        account=account,
        entry=entry,
        amount=amount if entry.kind == "income" else -amount,
        occurred_on=paid_on,
    )

    entry.settled_amount += amount

    entry.paid_on = paid_on

    entry.version += 1

    entry.save(update_fields=["settled_amount", "paid_on", "version"])


COMMANDS = {}


def command(name, schema):

    def register(fn):

        COMMANDS[name] = (schema, fn)

        return fn

    return register


def execute(user, operation, payload, key, source="mobile"):

    if operation not in COMMANDS:
        raise NotFound("Operação desconhecida.")

    if not isinstance(key, str) or not 8 <= len(key) <= 128:
        raise DomainError("Informe Idempotency-Key com 8 a 128 caracteres.")

    schema, handler = COMMANDS[operation]

    try:
        data = schema.model_validate(payload)

    except ValidationError as exc:
        raise DomainError(json.loads(exc.json(include_url=False, include_context=False))) from exc

    normalized = data.model_dump(mode="json")

    fingerprint = hashlib.sha256(
        json.dumps({"operation": operation, "payload": normalized}, sort_keys=True).encode()
    ).hexdigest()

    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)

        previous = IdempotencyRecord.objects.filter(user=user, key=key).first()

        if previous:
            if previous.fingerprint != fingerprint:
                raise Conflict("Chave de idempotência já utilizada com outros dados.")

            return previous.result

        result = handler(user, data)

        IdempotencyRecord.objects.create(
            user=user, key=key, operation=operation, fingerprint=fingerprint, result=result
        )

        AuditEvent.objects.create(
            user=user,
            action=operation,
            resource_id=result.get("id", "batch"),
            source=source[:100],
            details={"input": normalized, "result": result},
        )

        return result


@command("create_account", schemas.AccountInput)
def create_account(user, data):

    valid_actual_date(user, data.opening_date)

    obj = Account.objects.create(user=user, **data.model_dump())

    return {"id": str(obj.pk), "name": obj.name}


@command("create_category", schemas.CategoryInput)
def create_category(user, data):

    if Category.objects.filter(user=user, name=data.name).exists():
        raise Conflict("Já existe uma categoria com este nome.")

    obj = Category.objects.create(user=user, **data.model_dump())

    return {"id": str(obj.pk), "name": obj.name}


@command("update_category", schemas.CategoryUpdate)
def update_category(user, data):

    obj = owned(Category, user, data.category_id)

    if Category.objects.filter(user=user, name=data.name).exclude(pk=obj.pk).exists():
        raise Conflict("Já existe uma categoria com este nome.")

    obj.name, obj.color, obj.archived, obj.kind = (
        data.name,
        data.color,
        data.archived,
        data.kind if data.kind is not None else obj.kind,
    )

    obj.save(update_fields=["name", "color", "archived", "kind"])

    return {"id": str(obj.pk), "name": obj.name, "archived": obj.archived}


@command("create_transaction", schemas.EntryInput)
def create_entry(user, data):

    cat = category(user, data.category_id, data.kind)
    obj = Entry.objects.create(
        user=user,
        kind=data.kind,
        description=data.description or cat.name,
        amount=data.amount,
        category=cat,
        account=owned(Account, user, data.account_id),
        due_date=data.due_date,
    )

    if data.paid_on:
        settle(user, obj, obj.account, obj.amount, data.paid_on)

    return serialize_entry(obj)


@command("update_transaction", schemas.EntryUpdate)
def update_entry(user, data):

    obj = owned(Entry, user, data.entry_id)

    check_version(obj, data.version)

    if obj.canceled or obj.settled_amount or obj.purchase_id:
        raise DomainError("Edite apenas lançamentos abertos sem liquidações e sem compra parcelada.")

    obj.category = category(user, data.category_id, obj.kind)

    obj.description, obj.amount, obj.due_date = (
        data.description or obj.category.name,
        data.amount,
        data.due_date,
    )

    obj.version += 1

    obj.save()

    return serialize_entry(obj)


@command("cancel_transaction", schemas.EntryAction)
def cancel_entry(user, data):

    obj = owned(Entry, user, data.entry_id)

    check_version(obj, data.version)

    if obj.settled_amount or obj.purchase_id:
        raise DomainError("Lançamentos liquidados ou parcelas não podem ser cancelados isoladamente.")

    obj.canceled = True

    obj.version += 1

    obj.save(update_fields=["canceled", "version"])

    return serialize_entry(obj)


@command("correct_transaction", schemas.EntryCorrection)
def correct_entry(user, data):
    obj = owned(Entry, user, data.entry_id)
    check_version(obj, data.version)
    if obj.canceled or obj.purchase_id or obj.card_id:
        raise DomainError("Corrija compras pelo controle do cartão.")
    cat = category(user, data.category_id, obj.kind)
    if data.realized is False:
        total = (
            CashMovement.objects.filter(user=user, entry=obj).aggregate(total=Sum("amount"))["total"] or ZERO
        )
        if total:
            CashMovement.objects.create(
                user=user,
                account=obj.account,
                entry=obj,
                amount=-total,
                occurred_on=timezone.now().astimezone(ZoneInfo(user.timezone)).date(),
                reason="entry_reopen",
            )
        obj.settled_amount, obj.paid_on = ZERO, None
    elif obj.settled_amount == obj.amount:
        delta = data.amount - obj.amount
        if delta:
            CashMovement.objects.create(
                user=user,
                account=obj.account,
                entry=obj,
                amount=delta if obj.kind == "income" else -delta,
                occurred_on=timezone.now().astimezone(ZoneInfo(user.timezone)).date(),
                reason="entry_correction",
            )
        obj.settled_amount = data.amount
    elif data.amount < obj.settled_amount:
        raise DomainError(
            "O valor não pode ser menor que a parte já realizada. Exclua e cadastre o lançamento correto."
        )
    obj.description, obj.amount, obj.due_date, obj.category = (
        data.description or cat.name,
        data.amount,
        data.due_date,
        cat,
    )
    obj.version += 1
    obj.save()
    return serialize_entry(obj)


@command("delete_transaction", schemas.EntryDeletion)
def delete_entry(user, data):
    obj = owned(Entry, user, data.entry_id)
    check_version(obj, data.version)
    if obj.canceled or obj.purchase_id or obj.card_id:
        raise DomainError("Este lançamento não pode ser excluído isoladamente.")
    totals = (
        CashMovement.objects.filter(user=user, entry=obj).values("account_id").annotate(total=Sum("amount"))
    )
    for row in totals:
        if row["total"]:
            CashMovement.objects.create(
                user=user,
                entry=obj,
                account_id=row["account_id"],
                amount=-row["total"],
                occurred_on=timezone.now().astimezone(ZoneInfo(user.timezone)).date(),
                reason="entry_deletion",
            )
    obj.canceled, obj.settled_amount, obj.paid_on = True, ZERO, None
    obj.version += 1
    obj.save()
    return serialize_entry(obj)


@command("settle_transaction", schemas.SettlementInput)
def settle_entry(user, data):

    obj = owned(Entry, user, data.entry_id)

    check_version(obj, data.version)

    settle(user, obj, owned(Account, user, data.account_id), data.amount, data.paid_on)

    return serialize_entry(obj)


@command("create_card", schemas.CardInput)
def create_card(user, data):

    obj = Card.objects.create(user=user, **data.model_dump())

    return {"id": str(obj.pk), "name": obj.name}


@command("set_card_block", schemas.BlockCard)
def block_card(user, data):

    obj = owned(Card, user, data.card_id)

    obj.blocked = data.blocked

    obj.save(update_fields=["blocked"])

    return {"id": str(obj.pk), "blocked": obj.blocked}


@command("create_card_purchase", schemas.PurchaseInput)
def create_purchase(user, data):

    card = owned(Card, user, data.card_id)

    cat = category(user, data.category_id)

    if card.blocked:
        raise DomainError("Cartão bloqueado no aplicativo. Novas compras não são permitidas.")

    valid_actual_date(user, data.purchased_on)

    if data.first_due_date < data.purchased_on:
        raise DomainError("A primeira parcela não pode vencer antes da compra.")

    cents = int(data.total * 100)

    base, remainder = divmod(cents, data.installments)

    if base == 0:
        raise DomainError("O valor precisa permitir parcelas de pelo menos R$ 0,01.")

    purchase = Purchase.objects.create(
        user=user,
        card=card,
        description=data.description or cat.name,
        total=data.total,
        installments=data.installments,
        purchased_on=data.purchased_on,
    )

    entries = []

    for index in range(data.installments):
        value = Decimal(base + (1 if index < remainder else 0)) / 100

        due = add_months(data.first_due_date, index)

        invoice, _ = CardInvoice.objects.get_or_create(
            user=user, card=card, month=due.replace(day=1), defaults={"due_date": due}
        )

        if invoice.due_date != due:
            raise DomainError(
                "Já existe fatura com outro vencimento neste mês. Use a data da fatura existente."
            )

        entries.append(
            Entry(
                user=user,
                kind="expense",
                description=f"{purchase.description} · {index + 1}/{data.installments}",
                amount=value,
                category=cat,
                card=card,
                invoice=invoice,
                due_date=due,
                purchase=purchase,
                installment_number=index + 1,
            )
        )

    Entry.objects.bulk_create(entries)

    return {"id": str(purchase.pk), "installments": [serialize_entry(e) for e in entries]}


@command("register_opening_invoice", schemas.OpeningInvoice)
def opening_invoice(user, data):

    card = owned(Card, user, data.card_id)

    cat = category(user, data.category_id)

    invoice, _ = CardInvoice.objects.get_or_create(
        user=user, card=card, month=data.due_date.replace(day=1), defaults={"due_date": data.due_date}
    )

    if invoice.due_date != data.due_date or Entry.objects.filter(invoice=invoice).exists():
        raise DomainError(
            "O saldo inicial deve ser informado em uma fatura vazia, com seu vencimento correto."
        )

    entry = Entry.objects.create(
        user=user,
        kind="expense",
        description=f"Fatura inicial · {card.name}",
        amount=data.amount,
        category=cat,
        card=card,
        invoice=invoice,
        due_date=data.due_date,
    )

    return serialize_entry(entry)


@command("pay_card_invoice", schemas.InvoicePayment)
def pay_invoice(user, data):

    card = owned(Card, user, data.card_id)

    account = owned(Account, user, data.account_id)

    rows = list(
        Entry.objects.filter(
            user=user, card=card, canceled=False, due_date__range=month_bounds(data.month)
        ).order_by("due_date", "created_at")
    )

    outstanding = sum((e.amount - e.settled_amount for e in rows), ZERO)

    if data.amount > outstanding:
        raise DomainError("O pagamento excede o saldo aberto da fatura.")

    remaining = data.amount

    for entry in rows:
        applied = min(remaining, entry.amount - entry.settled_amount)

        if applied > ZERO:
            settle(user, entry, account, applied, data.paid_on)

            remaining -= applied

    return {
        "id": str(card.pk),
        "paid": amount_string(data.amount),
        "remaining": amount_string(outstanding - data.amount),
    }


def reject_duplicate_recurring(user, data, name, exclude=None):
    rules = RecurringRule.objects.filter(
        user=user,
        active=True,
        kind=data.kind,
        account_id=data.account_id,
        category_id=data.category_id,
        name__iexact=name,
    )
    if exclude:
        rules = rules.exclude(pk=exclude)
    rules = rules.filter(Q(end_month__isnull=True) | Q(end_month__gte=data.start_month))
    if data.end_month:
        rules = rules.filter(start_month__lte=data.end_month)
    if rules.exists():
        raise Conflict(
            "Já existe um lançamento fixo com esse nome, categoria e conta nesse período. Edite a recorrência existente em Ajustes > Despesas fixas."
        )


@command("create_recurring_expense", schemas.RecurringInput)
def create_recurring(user, data):

    if data.end_month and data.end_month < data.start_month:
        raise DomainError("O fim precisa ser posterior ao início.")

    cat = category(user, data.category_id, data.kind)
    reject_duplicate_recurring(user, data, data.name or cat.name)
    obj = RecurringRule.objects.create(
        user=user,
        name=data.name or cat.name,
        kind=data.kind,
        due_rule=data.due_rule,
        amount=data.amount,
        day=data.day,
        category=cat,
        account=owned(Account, user, data.account_id),
        start_month=data.start_month,
        end_month=data.end_month,
    )

    return {"id": str(obj.pk)}


@command("update_recurring_expense", schemas.RecurringUpdate)
def update_recurring(user, data):

    obj = owned(RecurringRule, user, data.recurring_id)

    if data.end_month and data.end_month < data.start_month:
        raise DomainError("O fim precisa ser posterior ao início.")

    if data.active:
        reject_duplicate_recurring(
            user, data, data.name or category(user, data.category_id, data.kind).name, obj.pk
        )
    obj.category = category(user, data.category_id, data.kind)

    obj.account = owned(Account, user, data.account_id)

    for key in ["due_rule", "kind", "name", "amount", "day", "start_month", "end_month", "active"]:
        setattr(obj, key, getattr(data, key))

    obj.name = obj.name or obj.category.name
    obj.save()

    return {"id": str(obj.pk), "effect": "future_unmaterialized_occurrences_only"}


@command("generate_recurring_expenses", schemas.GenerateInput)
def generate_recurring(user, data):

    count = 0

    rules = RecurringRule.objects.filter(user=user, active=True, start_month__lte=data.month)

    for rule in rules:
        if rule.end_month and rule.end_month < data.month:
            continue

        due = data.month.replace(day=min(rule.day, calendar.monthrange(data.month.year, data.month.month)[1]))
        if rule.due_rule == "salary_fifth_business_day":
            from .business_days import fifth_business_day

            due = fifth_business_day(data.month)

        _, created = Entry.objects.get_or_create(
            user=user,
            recurring_rule=rule,
            occurrence_month=data.month,
            defaults={
                "kind": rule.kind,
                "description": rule.name,
                "amount": rule.amount,
                "category": rule.category,
                "account": rule.account,
                "due_date": due,
            },
        )

        count += int(created)

    return {"created": count, "month": data.month.isoformat()}


@command("create_goal", schemas.GoalCreateInput)
def create_goal(user, data):

    obj = Goal.objects.create(
        user=user, **data.model_dump(exclude={"initial_plan_amount", "initial_plan_month"})
    )

    if data.initial_plan_amount is not None:
        GoalPlan.objects.create(
            user=user, goal=obj, month=data.initial_plan_month, amount=data.initial_plan_amount
        )

    return {"id": str(obj.pk), "name": obj.name}


@command("update_goal", schemas.GoalUpdate)
def update_goal(user, data):

    obj = owned(Goal, user, data.goal_id)

    obj.name, obj.target, obj.target_date = data.name, data.target, data.target_date

    obj.save(update_fields=["name", "target", "target_date"])

    return {"id": str(obj.pk), "name": obj.name}


@command("set_goal_plan", schemas.GoalPlanInput)
def set_goal_plan(user, data):

    goal = owned(Goal, user, data.goal_id)

    obj, _ = GoalPlan.objects.update_or_create(
        user=user, goal=goal, month=data.month, defaults={"amount": data.amount}
    )

    return {"id": str(obj.pk), "amount": amount_string(obj.amount)}


@command("transfer_goal_plan", schemas.PlanTransferInput)
def transfer_goal_plan(user, data):

    source, target = owned(Goal, user, data.from_goal_id), owned(Goal, user, data.to_goal_id)

    if source == target:
        raise DomainError("Escolha duas metas diferentes.")

    source_plan = GoalPlan.objects.filter(user=user, goal=source, month=data.month).first()

    if not source_plan or source_plan.amount < data.amount:
        raise DomainError("Planejamento de origem insuficiente.")

    source_plan.amount -= data.amount

    source_plan.save(update_fields=["amount"])

    target_plan, _ = GoalPlan.objects.get_or_create(
        user=user, goal=target, month=data.month, defaults={"amount": ZERO}
    )

    target_plan.amount += data.amount

    target_plan.save(update_fields=["amount"])

    return {"id": str(target_plan.pk), "transferred": amount_string(data.amount)}


@command("allocate_goal_funds", schemas.AllocationInput)
def allocate_goal(user, data):

    goal, account = owned(Goal, user, data.goal_id), owned(Account, user, data.account_id)

    valid_actual_date(user, data.occurred_on, account)

    if (
        GoalAllocation.objects.filter(user=user, occurred_on__gt=data.occurred_on).exists()
        or CashMovement.objects.filter(user=user, occurred_on__gt=data.occurred_on).exists()
    ):
        raise DomainError(
            "Reserve ou retire na data do último movimento ou depois, para preservar os saldos históricos."
        )

    signed = data.amount if data.direction == "reserve" else -data.amount

    if data.direction == "reserve":
        if data.amount > account_balance(account, data.occurred_on) - reserved_balance(
            account, data.occurred_on
        ):
            raise DomainError("Saldo não reservado insuficiente nesta conta.")

    else:
        current = (
            GoalAllocation.objects.filter(user=user, goal=goal, account=account).aggregate(
                total=Sum("amount")
            )["total"]
            or ZERO
        )

        if data.amount > current:
            raise DomainError("A retirada excede o valor reservado nesta conta para esta meta.")

    obj = GoalAllocation.objects.create(
        user=user, goal=goal, account=account, amount=signed, occurred_on=data.occurred_on
    )

    return {"id": str(obj.pk), "amount": amount_string(signed), "effect": "reservation_only"}


@command("set_budget", schemas.BudgetInput)
def set_budget(user, data):

    cat = category(user, data.category_id)

    obj, _ = Budget.objects.update_or_create(
        user=user, category=cat, month=data.month, defaults={"amount": data.amount}
    )

    return {"id": str(obj.pk), "amount": amount_string(obj.amount)}


@command("delete_goal", schemas.GoalDeleteInput)
def delete_goal(user, data):

    goal = owned(Goal, user, data.goal_id)

    if GoalAllocation.objects.filter(user=user, goal=goal).exists():
        raise DomainError(
            "Esta meta tem histórico de aportes e não pode ser excluída. O histórico financeiro será preservado."
        )

    identifier = str(goal.pk)

    GoalPlan.objects.filter(user=user, goal=goal).delete()

    goal.delete()

    return {"id": identifier, "deleted": True}


@transaction.atomic
def ensure_recurring_month(user, month):
    """Catch up elapsed months and the displayed month; forecasts never move cash."""
    User.objects.select_for_update().get(pk=user.pk)
    today = timezone.now().astimezone(ZoneInfo(user.timezone)).date().replace(day=1)
    first = (
        RecurringRule.objects.filter(user=user, active=True, start_month__lte=month)
        .order_by("start_month")
        .first()
    )
    count = 0
    if first:
        cursor = first.start_month
        through = min(month, today)
        while cursor <= through:
            count += generate_recurring(user, schemas.GenerateInput(month=cursor))["created"]
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        if month > today:
            count += generate_recurring(user, schemas.GenerateInput(month=month))["created"]
    if count:
        AuditEvent.objects.create(
            user=user,
            action="auto_generate_recurring",
            resource_id="batch",
            source="system",
            details={"created": count, "month": month.isoformat()},
        )
    return {"created": count}
