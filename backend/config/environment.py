"""Explicit environment configuration; no embedded application credentials."""

import os
from collections.abc import Mapping

import dj_database_url
from django.core.exceptions import ImproperlyConfigured


def required(name: str, environ: Mapping[str, str] | None = None) -> str:
    values = os.environ if environ is None else environ
    value = values.get(name, "")
    if not value.strip():
        raise ImproperlyConfigured(f"Defina {name} no ambiente ou em backend/.env.")
    return value


def database_config(environ: Mapping[str, str] | None = None) -> dict:
    values = os.environ if environ is None else environ
    if values.get("DATABASE_URL", "").strip():
        try:
            return dj_database_url.parse(values["DATABASE_URL"], conn_max_age=60)
        except ValueError:
            raise ImproperlyConfigured("DATABASE_URL inválida; confira sua configuração.") from None
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": required("DB_NAME", values),
        "USER": required("DB_USER", values),
        "PASSWORD": required("DB_PASSWORD", values),
        "HOST": required("DB_HOST", values),
        "PORT": required("DB_PORT", values),
        "CONN_MAX_AGE": 60,
    }
