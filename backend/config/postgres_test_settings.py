"""Opt-in PostgreSQL tests; never derive the test database from personal data."""

import os
import re

from django.core.exceptions import ImproperlyConfigured

from .environment import required
from .test_settings import *  # noqa: F403

test_database = required("TEST_DB_NAME")
if not re.fullmatch(r"test_lifegoals_audit_[a-z0-9_]+", test_database) or test_database == os.getenv(
    "DB_NAME"
):
    raise ImproperlyConfigured("Use um banco exclusivo com prefixo test_lifegoals_audit_.")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "postgres",
        "HOST": required("TEST_DB_HOST"),
        "PORT": required("TEST_DB_PORT"),
        "USER": required("TEST_DB_USER"),
        "PASSWORD": required("TEST_DB_PASSWORD"),
        "CONN_MAX_AGE": 0,
        "TEST": {"NAME": test_database},
    }
}
