"""Isolated HTTPS-facing MCP/OAuth process, behind the loopback-only tunnel."""

import os
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403

origin = os.environ.get("OAUTH_PUBLIC_ORIGIN", "")
parsed = urlsplit(origin)
if (
    parsed.scheme != "https"
    or not parsed.hostname
    or parsed.path not in {"", "/"}
    or parsed.query
    or parsed.fragment
    or parsed.username
    or parsed.password
):
    raise ImproperlyConfigured("OAUTH_PUBLIC_ORIGIN must be a public HTTPS origin.")
DEBUG = False
ALLOWED_HOSTS = [parsed.hostname, "127.0.0.1", "localhost"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_NAME = "lifegoals_oauth_session"
CSRF_COOKIE_NAME = "lifegoals_oauth_csrf"
SESSION_COOKIE_AGE = 3600
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = [origin.rstrip("/")]
# No forwarded-header trust: the loopback-only public ASGI boundary sets https.
SECURE_PROXY_SSL_HEADER = None
CORS_ALLOWED_ORIGINS = []
DATA_UPLOAD_MAX_MEMORY_SIZE = 65536
