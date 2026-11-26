import pytest
from django.core.exceptions import ImproperlyConfigured

from config.environment import database_config, required


def test_database_fields_come_only_from_supplied_environment():
    values = {
        "DB_HOST": "localhost",
        "DB_PORT": "5544",
        "DB_NAME": "example_test",
        "DB_USER": "example_role",
        "DB_PASSWORD": "test-only-password",
    }
    config = database_config(values)
    assert config["PORT"] == "5544"
    assert config["NAME"] == "example_test"
    assert config["USER"] == "example_role"
    assert config["PASSWORD"] == values["DB_PASSWORD"]


def test_missing_password_fails_instead_of_using_a_default():
    with pytest.raises(ImproperlyConfigured, match="DB_PASSWORD"):
        database_config(
            {"DB_HOST": "localhost", "DB_PORT": "5433", "DB_NAME": "example", "DB_USER": "example"}
        )


def test_secret_key_is_required_without_development_fallback():
    with pytest.raises(ImproperlyConfigured, match="SECRET_KEY"):
        required("SECRET_KEY", {})


def test_url_configuration_still_supports_isolated_test_database():
    assert database_config({"DATABASE_URL": "sqlite:///:memory:"})["ENGINE"] == "django.db.backends.sqlite3"
