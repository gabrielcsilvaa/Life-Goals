from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from planning.models import Budget, Goal, GoalAllocation, GoalPlan

from .models import Account, Card, CashMovement, Category, Entry, RecurringRule
from .services import ZERO, add_months, amount_string, month_bounds, serialize_entry


def parse_month(raw):
    try:
        value = date.fromisoformat(f"{raw}-01")
        if len(raw) != 7:
            raise ValueError
        return value
    except (ValueError, TypeError):
        from .errors import DomainError

        raise DomainError("Mês inválido. Utilize AAAA-MM.") from None


def snapshot(user, month):
    from .services import ensure_recurring_month

    ensure_recurring_month(user, month)
    start, end = month_bounds(month)
    today = timezone.now().astimezone(ZoneInfo(user.timezone)).date()
    as_of = min(end, today)
    accounts = list(Account.objects.filter(user=user).order_by("created_at"))
    categories = list(Category.objects.filter(user=user).order_by("name"))
    entries = Entry.objects.filter(user=user, due_date__range=(start, end))
    live = list(entries.filter(canceled=False))
    movements = CashMovement.objects.filter(user=user, occurred_on__lte=as_of)
    by_account = {
        r["account_id"]: r["total"] for r in movements.values("account_id").annotate(total=Sum("amount"))
    }
    by_entry = {
        r["entry_id"]: abs(r["total"])
        for r in movements.exclude(entry_id=None).values("entry_id").annotate(total=Sum("amount"))
    }
    allocations = GoalAllocation.objects.filter(user=user, occurred_on__lte=as_of)
    account_reserves = {
        r["account_id"]: r["total"] for r in allocations.values("account_id").annotate(total=Sum("amount"))
    }
    goal_reserves = {
        r["goal_id"]: r["total"] for r in allocations.values("goal_id").annotate(total=Sum("amount"))
    }
    month_contributions = {
        r["goal_id"]: r["total"]
        for r in allocations.filter(occurred_on__gte=start).values("goal_id").annotate(total=Sum("amount"))
    }
    account_data = [
        {
            "id": str(a.pk),
            "name": a.name,
            "balance": amount_string(
                a.opening_balance + by_account.get(a.pk, ZERO) if a.opening_date <= as_of else ZERO
            ),
            "reserved": amount_string(account_reserves.get(a.pk, ZERO)),
            "opening_date": a.opening_date.isoformat(),
        }
        for a in accounts
    ]
    balance = sum((Decimal(a["balance"]) for a in account_data), ZERO)
    reserved = sum(account_reserves.values(), ZERO)
    income_expected = sum((e.amount for e in live if e.kind == "income"), ZERO)
    income_received = sum((by_entry.get(e.pk, ZERO) for e in live if e.kind == "income"), ZERO)
    expense_expected = sum((e.amount for e in live if e.kind == "expense"), ZERO)
    expense_paid = sum((by_entry.get(e.pk, ZERO) for e in live if e.kind == "expense"), ZERO)
    # Include overdue obligations from earlier months exactly once.
    unpaid = ZERO
    upcoming = []
    for entry in Entry.objects.filter(user=user, kind="expense", canceled=False, due_date__lte=end).order_by(
        "due_date"
    ):
        remaining = entry.amount - by_entry.get(entry.pk, ZERO)
        if remaining > 0:
            unpaid += remaining
            if len(upcoming) < 8:
                upcoming.append({**serialize_entry(entry), "remaining": amount_string(remaining)})
    budgets = list(Budget.objects.filter(user=user, month=start))
    committed_by_category = {}
    recognized_by_category = {}
    for entry in live:
        if entry.kind == "expense":
            committed_by_category[entry.category_id] = (
                committed_by_category.get(entry.category_id, ZERO) + entry.amount
            )
            recognized = entry.amount if entry.card_id else by_entry.get(entry.pk, ZERO)
            recognized_by_category[entry.category_id] = (
                recognized_by_category.get(entry.category_id, ZERO) + recognized
            )
    budget_remaining = sum(
        (max(b.amount - committed_by_category.get(b.category_id, ZERO), ZERO) for b in budgets), ZERO
    )
    plans = {p.goal_id: p.amount for p in GoalPlan.objects.filter(user=user, month=start)}
    goal_plan_remaining = sum(
        (max(value - max(month_contributions.get(pk, ZERO), ZERO), ZERO) for pk, value in plans.items()), ZERO
    )
    # One grouped query supplies the goal detail chart; never substitute planned funds.
    goal_changes = {}
    for row in (
        allocations.annotate(month=TruncMonth("occurred_on"))
        .values("goal_id", "month")
        .annotate(total=Sum("amount"))
    ):
        goal_changes.setdefault(row["goal_id"], []).append((row["month"].strftime("%Y-%m"), row["total"]))
    goal_months = [add_months(start, offset).strftime("%Y-%m") for offset in range(-5, 1)]
    goal_data = [
        {
            "id": str(g.pk),
            "name": g.name,
            "target": amount_string(g.target),
            "target_date": g.target_date.isoformat() if g.target_date else None,
            "accumulated": amount_string(goal_reserves.get(g.pk, ZERO)),
            "planned": amount_string(plans.get(g.pk, ZERO)),
            "contributed": amount_string(month_contributions.get(g.pk, ZERO)),
            "history": [
                {
                    "month": key,
                    "accumulated": amount_string(
                        sum((value for period, value in goal_changes.get(g.pk, []) if period <= key), ZERO)
                    ),
                }
                for key in goal_months
            ],
        }
        for g in Goal.objects.filter(user=user).order_by("created_at")
    ]
    history_rows = (
        movements.filter(occurred_on__gte=add_months(start, -5))
        .annotate(month=TruncMonth("occurred_on"))
        .values("month")
        .annotate(income=Sum("amount", filter=Q(amount__gt=0)), expense=Sum("amount", filter=Q(amount__lt=0)))
    )
    history_map = {}
    for row in history_rows:
        key = row["month"].strftime("%Y-%m")
        history_map[key] = {"income": row["income"] or ZERO, "expense": abs(row["expense"] or ZERO)}
    history = []
    for offset in range(-5, 1):
        key = add_months(start, offset).strftime("%Y-%m")
        values = history_map.get(key, {"income": ZERO, "expense": ZERO})
        history.append({"month": key, **{k: amount_string(v) for k, v in values.items()}})
    cards = []
    invoice_totals = {
        r["card_id"]: r["total"]
        for r in entries.filter(canceled=False, card__isnull=False)
        .values("card_id")
        .annotate(total=Sum("amount"))
    }
    invoice_paid = {}
    for entry in live:
        if entry.card_id:
            invoice_paid[entry.card_id] = invoice_paid.get(entry.card_id, ZERO) + by_entry.get(entry.pk, ZERO)
    for card in Card.objects.filter(user=user).order_by("created_at"):
        cards.append(
            {
                "id": str(card.pk),
                "name": card.name,
                "closing_day": card.closing_day,
                "due_day": card.due_day,
                "blocked": card.blocked,
                "invoice_total": amount_string(invoice_totals.get(card.pk, ZERO)),
                "invoice_paid": amount_string(invoice_paid.get(card.pk, ZERO)),
            }
        )
    return {
        "user": {
            "name": user.display_name or user.username,
            "username": user.username,
            "timezone": user.timezone,
        },
        "month": start.strftime("%Y-%m"),
        "as_of": as_of.isoformat(),
        "summary": {
            "balance": amount_string(balance),
            "reserved": amount_string(reserved),
            "income_expected": amount_string(income_expected),
            "income_received": amount_string(income_received),
            "expense_expected": amount_string(expense_expected),
            "expense_paid": amount_string(expense_paid),
            "unpaid": amount_string(unpaid),
            "budget_remaining": amount_string(budget_remaining),
            "goal_plan_remaining": amount_string(goal_plan_remaining),
            "available": amount_string(balance - reserved - unpaid - budget_remaining - goal_plan_remaining),
        },
        "accounts": account_data,
        "categories": [
            {"id": str(c.pk), "name": c.name, "color": c.color, "archived": c.archived, "kind": c.kind}
            for c in categories
        ],
        "entries": [serialize_entry(e) for e in entries[:200]],
        "entry_count": entries.count(),
        "goals": goal_data,
        "cards": cards,
        "upcoming": upcoming,
        "history": history,
        "category_expenses": [
            {
                "category_id": str(c.pk),
                "name": c.name,
                "color": c.color,
                "amount": amount_string(recognized_by_category.get(c.pk, ZERO)),
            }
            for c in categories
            if recognized_by_category.get(c.pk, ZERO)
        ],
        "budgets": [
            {"id": str(b.pk), "category_id": str(b.category_id), "amount": amount_string(b.amount)}
            for b in budgets
        ],
        "recurring": [
            {
                "id": str(r.pk),
                "kind": r.kind,
                "due_rule": r.due_rule,
                "name": r.name,
                "amount": amount_string(r.amount),
                "day": r.day,
                "active": r.active,
                "category_id": str(r.category_id),
                "account_id": str(r.account_id),
                "start_month": r.start_month.isoformat(),
                "end_month": r.end_month.isoformat() if r.end_month else None,
            }
            for r in RecurringRule.objects.filter(user=user).order_by("created_at")
        ],
        "criteria": "Saldo registrado até a data de corte, menos reservas, obrigações abertas até o fim do mês (inclui atrasos), orçamento variável restante e aportes planejados restantes. Receitas futuras não são dinheiro disponível.",
    }
