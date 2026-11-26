"""Opt-in editable example. No realized income, cash movements or contributions."""

from datetime import date
from decimal import Decimal

from planning.models import Budget, Goal, GoalPlan

from . import schemas
from .errors import DomainError
from .models import Account, Card, CardInvoice, Category, Entry, RecurringRule
from .services import command


@command("load_example", schemas.Input)
def load_example(user, data):
    if any(model.objects.filter(user=user).exists() for model in [Account, Category, Entry, Card, Goal]):
        raise DomainError("O exemplo só pode ser carregado em uma conta vazia.")
    account = Account.objects.create(
        user=user, name="Conta principal", opening_balance=0, opening_date=date(2026, 1, 1)
    )
    cats = {}
    for name, color in [
        ("Salário", "#168477"),
        ("Transporte", "#6488D5"),
        ("Saúde", "#C886A5"),
        ("Celular", "#AB94D4"),
        ("Lazer", "#E7B362"),
        ("Alimentação", "#DF8B70"),
        ("Outros", "#8C9C99"),
    ]:
        cats[name] = Category.objects.create(user=user, name=name, color=color)
    mp = Card.objects.create(user=user, name="Mercado Pago", closing_day=3, due_day=10)
    Card.objects.create(user=user, name="Nubank", closing_day=20, due_day=27, blocked=True)
    invoice = CardInvoice.objects.create(
        user=user, card=mp, month=date(2027, 1, 1), due_date=date(2027, 1, 10)
    )
    Entry.objects.create(
        user=user,
        kind="expense",
        description="Fatura inicial · Mercado Pago",
        amount=200,
        category=cats["Outros"],
        card=mp,
        invoice=invoice,
        due_date=invoice.due_date,
    )
    europe = Goal.objects.create(user=user, name="Viagem para a Itália", target=8000)
    reserve = Goal.objects.create(user=user, name="Reserva de emergência", target=6000)
    for month in range(1, 13):
        start = date(2027, month, 1)
        Entry.objects.create(
            user=user,
            account=account,
            kind="income",
            description="Salário líquido previsto",
            amount=2000,
            category=cats["Salário"],
            due_date=date(2027, month, 5),
        )
        Budget.objects.create(user=user, category=cats["Transporte"], month=start, amount=Decimal("407.00"))
        Budget.objects.create(user=user, category=cats["Lazer"], month=start, amount=200)
        GoalPlan.objects.create(user=user, goal=europe, month=start, amount=400 if month == 1 else 600)
        GoalPlan.objects.create(user=user, goal=reserve, month=start, amount=200 if month == 1 else 350)
    for name, amount, category_name, day in [("Academia", 140, "Saúde", 10), ("TIM", 70, "Celular", 15)]:
        rule = RecurringRule.objects.create(
            user=user,
            name=name,
            amount=amount,
            category=cats[category_name],
            account=account,
            day=day,
            start_month=date(2027, 1, 1),
        )
        for month in range(1, 13):
            Entry.objects.create(
                user=user,
                kind="expense",
                description=name,
                amount=amount,
                category=rule.category,
                account=account,
                recurring_rule=rule,
                occurrence_month=date(2027, month, 1),
                due_date=date(2027, month, day),
            )
    return {
        "id": str(account.pk),
        "message": "Planejamento editável criado. Datas e valores-alvo das metas são exemplos; confirme-os. Saldo realizado e aportes: zero.",
    }
