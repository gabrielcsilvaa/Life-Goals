from django.apps import AppConfig


class FinanceConfig(AppConfig):
    name = "finance"

    def ready(self):
        from . import examples  # noqa: F401
