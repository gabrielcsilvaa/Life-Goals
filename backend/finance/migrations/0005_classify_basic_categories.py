from django.db import migrations


def classify(apps, schema_editor):
    category = apps.get_model("finance", "Category")
    for name in ["Salário", "Outras receitas"]:
        category.objects.filter(name__iexact=name, kind="both").update(kind="income")
    for name in ["Transporte", "Alimentação", "Moradia", "Saúde", "Lazer", "Educação", "Outros"]:
        category.objects.filter(name__iexact=name, kind="both").update(kind="expense")


class Migration(migrations.Migration):
    dependencies = [("finance", "0004_category_kind")]
    operations = [migrations.RunPython(classify, migrations.RunPython.noop)]
