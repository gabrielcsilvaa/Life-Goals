"""Fail-closed production profile for a persistent ASGI container behind HTTPS."""

import os
from urllib.parse import urlsplit

import certifi
from django.core.exceptions import ImproperlyConfigured

from .environment import required
from .settings import *  # noqa: F403

DEBUG = False
APP_VERSION = os.getenv("APP_VERSION") or required("RENDER_GIT_COMMIT")
SECURE_REDIRECT_EXEMPT = [r"^health/$", r"^ready/$"]
SECRET_KEY = required("SECRET_KEY")
if len(SECRET_KEY) < 50:
    raise ImproperlyConfigured("SECRET_KEY precisa ter pelo menos 50 caracteres aleatórios.")
FRONTEND_ORIGIN = required("FRONTEND_ORIGIN").rstrip("/")
origin = urlsplit(FRONTEND_ORIGIN)
if (
    origin.scheme != "https"
    or not origin.hostname
    or origin.path
    or origin.query
    or origin.fragment
    or origin.username
):
    raise ImproperlyConfigured("FRONTEND_ORIGIN deve ser uma origem HTTPS sem caminho ou credenciais.")
ALLOWED_HOSTS = [host.strip() for host in required("ALLOWED_HOSTS").split(",")]
if "*" in ALLOWED_HOSTS or any(not host for host in ALLOWED_HOSTS):
    raise ImproperlyConfigured("Configure hosts explícitos.")
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":  # noqa: F405
    raise ImproperlyConfigured("Produção exige PostgreSQL persistente.")
DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "verify-full"  # noqa: F405
DATABASES["default"]["OPTIONS"]["sslrootcert"] = os.getenv(  # noqa: F405
    "DB_SSLROOTCERT", certifi.where()
)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [FRONTEND_ORIGIN]
SESSION_COOKIE_NAME = "__Host-lifegoals_session"
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_DOMAIN = None
SESSION_COOKIE_PATH = "/"
CSRF_COOKIE_NAME = "__Host-lifegoals_csrf"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_DOMAIN = None
SECURE_SSL_REDIRECT = True
# Only expose ASGI behind a proxy that replaces these headers (see deployment guide).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"
REQUIRE_EMAIL_VERIFICATION = True
EMAIL_TRANSPORT = os.getenv("EMAIL_TRANSPORT", "smtp")
if EMAIL_TRANSPORT == "brevo":
    EMAIL_BACKEND = "identity.email_backend.BrevoEmailBackend"
    BREVO_API_KEY = required("BREVO_API_KEY")
elif EMAIL_TRANSPORT == "smtp":
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = required("EMAIL_HOST")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = required("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = required("EMAIL_HOST_PASSWORD")
    EMAIL_USE_TLS = True
else:
    raise ImproperlyConfigured("EMAIL_TRANSPORT deve ser smtp ou brevo.")
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = required("DEFAULT_FROM_EMAIL")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"private": {"()": "identity.logging.PrivateDataFilter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "filters": ["private"]}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {"django": {"handlers": ["console"], "level": "WARNING", "propagate": False}},
}
