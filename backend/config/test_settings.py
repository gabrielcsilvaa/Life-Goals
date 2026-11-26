import os
import secrets

os.environ["DEBUG"] = "true"
os.environ.setdefault("SECRET_KEY", secrets.token_urlsafe(64))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
from .settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
