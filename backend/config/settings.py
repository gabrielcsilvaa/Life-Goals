import os
from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers
from dotenv import load_dotenv

from .environment import database_config, required

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
SECRET_KEY = required("SECRET_KEY")
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "oauth2_provider",
    "identity",
    "finance",
    "planning",
    "integrations",
    "audit",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "identity.middleware.PrivateResponsesMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "integrations.oauth.OAuthSafetyMiddleware",
]
ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
DATABASES = {"default": database_config()}
AUTH_USER_MODEL = "identity.User"
AUTHENTICATION_BACKENDS = ["identity.authentication.EmailOrUsernameBackend"]
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:8081").rstrip("/")
REQUIRE_EMAIL_VERIFICATION = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() == "true"
AUTH_ATTEMPTS_PER_WINDOW = 20
PASSWORD_RESET_TIMEOUT = 3600
SESSION_COOKIE_AGE = 7 * 86400
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = os.getenv(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://127.0.0.1:8082",
).split(",")
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.locmem.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@lifegoals.invalid")
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081").split(
    ","
)
CORS_ALLOW_HEADERS = [*default_headers, "idempotency-key"]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "30/min", "user": "300/min"},
    "EXCEPTION_HANDLER": "finance.errors.exception_handler",
}
SIMPLE_JWT = {
    "CHECK_REVOKE_TOKEN": True,
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
MCP_PUBLIC_URL = os.getenv("MCP_PUBLIC_URL", "http://127.0.0.1:8000/mcp")


# OAuth is exclusively for the MCP resource; mobile JWT authentication is unchanged.
OAUTH_PUBLIC_ORIGIN = os.getenv("OAUTH_PUBLIC_ORIGIN", MCP_PUBLIC_URL.removesuffix("/mcp")).rstrip("/")
LOGIN_URL = "/oauth/login/"
LOGIN_REDIRECT_URL = "/oauth/connected/"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ]
        },
    }
]
OAUTH2_PROVIDER = {
    "SCOPES": {
        "finance:read": "Consultar seus dados financeiros",
        "finance:write": "Criar e alterar registros financeiros",
        "offline_access": "Manter a conexão autorizada entre conversas",
    },
    "DEFAULT_SCOPES": ["finance:read"],
    "ACCESS_TOKEN_EXPIRE_SECONDS": 900,
    "AUTHORIZATION_CODE_EXPIRE_SECONDS": 120,
    "REFRESH_TOKEN_EXPIRE_SECONDS": 30 * 86400,
    "ROTATE_REFRESH_TOKEN": True,
    "REFRESH_TOKEN_REUSE_PROTECTION": True,
    "PKCE_REQUIRED": True,
    "REQUEST_APPROVAL_PROMPT": "force",
    "ALLOWED_REDIRECT_URI_SCHEMES": ["https"],
    "OAUTH2_VALIDATOR_CLASS": "integrations.oauth.LifeGoalsOAuthValidator",
    "OIDC_ISS_ENDPOINT": OAUTH_PUBLIC_ORIGIN,
    "OAUTH2_PROTECTED_RESOURCE_IDENTIFIER": MCP_PUBLIC_URL,
    "OAUTH2_PROTECTED_RESOURCE_AUTHORIZATION_SERVERS": [OAUTH_PUBLIC_ORIGIN],
    "OAUTH2_PROTECTED_RESOURCE_NAME": "Life Goals",
    "OAUTH2_TOKEN_ENDPOINT_AUTH_METHODS_SUPPORTED": ["none"],
    "OAUTH2_GRANT_TYPES_SUPPORTED": ["authorization_code", "refresh_token"],
    "OAUTH2_RESPONSE_TYPES_SUPPORTED": ["code"],
    "DCR_ENABLED": True,
    "DCR_REGISTRATION_PERMISSION_CLASSES": ["oauth2_provider.dcr.AllowAllDCRPermission"],
    "DCR_REGISTRATION_TOKEN_EXPIRE_SECONDS": 86400,
    "COMPLIANT_BCP_RFC9700_IMPLICIT_GRANT": True,
    "COMPLIANT_BCP_RFC9700_PASSWORD_GRANT": True,
    "COMPLIANT_BCP_RFC9700_PKCE_METHOD": True,
    "COMPLIANT_BCP_RFC9700_ACCESS_TOKEN_TRANSPORT": True,
    "COMPLIANT_BCP_RFC9700_AUTHZ_RESPONSE_ISS": True,
    "COMPLIANT_BCP_RFC9700_TOKEN_STORAGE": True,
    "REQUIRE_FORM_ENCODED_REQUEST_BODY": True,
}
OAUTH2_PROVIDER_APPLICATION_MODEL = "oauth2_provider.Application"
