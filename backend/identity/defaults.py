from django.db import transaction

from finance.models import Category

DEFAULT_CATEGORIES = (
    ("Transporte", "#527594"),
    ("Alimentação", "#896332"),
    ("Moradia", "#71685D"),
    ("Saúde", "#98596B"),
    ("Lazer", "#7D668B"),
    ("Educação", "#647252"),
    ("Salário", "#344A35"),
    ("Outras receitas", "#527594"),
    ("Outros", "#71685D"),
)


@transaction.atomic
def ensure_default_categories(user):
    type(user).objects.select_for_update().get(pk=user.pk)
    for name, color in DEFAULT_CATEGORIES:
        if not Category.objects.filter(user=user, name__iexact=name).exists():
            Category.objects.create(
                user=user,
                name=name,
                color=color,
                kind="income" if name in {"Salário", "Outras receitas"} else "expense",
            )
