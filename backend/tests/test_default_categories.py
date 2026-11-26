from finance.models import Category
from identity.defaults import ensure_default_categories


def test_defaults_preserve_custom_categories_and_do_not_duplicate(user):
    custom = Category.objects.create(user=user, name="Categoria específica", color="#123456")
    existing = Category.objects.create(user=user, name="transporte", color="#654321")
    ensure_default_categories(user)
    count = Category.objects.filter(user=user).count()
    ensure_default_categories(user)
    assert Category.objects.filter(user=user).count() == count
    assert Category.objects.filter(user=user, name__iexact="Transporte").count() == 1
    existing.refresh_from_db()
    assert existing.color == "#654321"
    assert Category.objects.filter(pk=custom.pk).exists()
    assert Category.objects.filter(user=user, name="Alimentação").exists()
