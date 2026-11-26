import uuid

from django.conf import settings
from django.db import models


class OwnedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Account(OwnedModel):
    name = models.CharField(max_length=80)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    opening_date = models.DateField()


class Category(OwnedModel):
    kind = models.CharField(
        max_length=7,
        choices=[("income", "Receita"), ("expense", "Despesa"), ("both", "Ambas")],
        default="both",
    )
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#168477")
    archived = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "name"], name="unique_category_per_user")]


class Card(OwnedModel):
    name = models.CharField(max_length=80)
    closing_day = models.PositiveSmallIntegerField()
    due_day = models.PositiveSmallIntegerField()
    blocked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(closing_day__gte=1, closing_day__lte=31), name="valid_card_closing_day"
            ),
            models.CheckConstraint(
                condition=models.Q(due_day__gte=1, due_day__lte=31), name="valid_card_due_day"
            ),
        ]


class RecurringRule(OwnedModel):
    due_rule = models.CharField(
        max_length=30,
        choices=[("calendar_day", "Dia do mês"), ("salary_fifth_business_day", "5º dia útil salarial")],
        default="calendar_day",
    )
    kind = models.CharField(
        max_length=10, choices=[("income", "Receita"), ("expense", "Despesa")], default="expense"
    )
    name = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    day = models.PositiveSmallIntegerField()
    start_month = models.DateField()
    end_month = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="positive_recurring_amount"),
            models.CheckConstraint(condition=models.Q(day__gte=1, day__lte=31), name="valid_recurring_day"),
        ]


class CardInvoice(OwnedModel):
    card = models.ForeignKey(Card, on_delete=models.PROTECT)
    month = models.DateField()
    due_date = models.DateField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["card", "month"], name="unique_card_invoice_month")]


class Purchase(OwnedModel):
    card = models.ForeignKey(Card, on_delete=models.PROTECT)
    description = models.CharField(max_length=120)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    installments = models.PositiveSmallIntegerField()
    purchased_on = models.DateField()


class Entry(OwnedModel):
    class Kind(models.TextChoices):
        INCOME = "income", "Receita"
        EXPENSE = "expense", "Despesa"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    description = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True)
    card = models.ForeignKey(Card, on_delete=models.PROTECT, null=True, blank=True)
    due_date = models.DateField()
    paid_on = models.DateField(null=True, blank=True)
    settled_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    canceled = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    recurring_rule = models.ForeignKey(RecurringRule, on_delete=models.PROTECT, null=True, blank=True)
    occurrence_month = models.DateField(null=True, blank=True)
    purchase = models.ForeignKey(Purchase, on_delete=models.PROTECT, null=True, blank=True)
    invoice = models.ForeignKey(CardInvoice, on_delete=models.PROTECT, null=True, blank=True)
    installment_number = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-due_date", "-created_at", "id"]
        indexes = [
            models.Index(fields=["user", "due_date"]),
            models.Index(fields=["user", "card", "due_date"]),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="positive_entry_amount"),
            models.CheckConstraint(
                condition=models.Q(settled_amount__gte=0) & models.Q(settled_amount__lte=models.F("amount")),
                name="valid_settlement_total",
            ),
            models.CheckConstraint(
                condition=models.Q(account__isnull=False, card__isnull=True)
                | models.Q(account__isnull=True, card__isnull=False),
                name="entry_account_or_card",
            ),
            models.UniqueConstraint(
                fields=["recurring_rule", "occurrence_month"], name="one_recurring_occurrence"
            ),
            models.UniqueConstraint(
                fields=["purchase", "installment_number"], name="one_purchase_installment"
            ),
        ]


class CashMovement(OwnedModel):
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    entry = models.ForeignKey(Entry, on_delete=models.PROTECT, null=True, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    occurred_on = models.DateField()
    reason = models.CharField(max_length=30, default="settlement")


class IdempotencyRecord(OwnedModel):
    key = models.CharField(max_length=128)
    operation = models.CharField(max_length=80)
    fingerprint = models.CharField(max_length=64)
    result = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "key"], name="unique_user_request_key")]
