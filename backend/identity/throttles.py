import hashlib
import hmac

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.throttling import BaseThrottle

from .models import AuthRateLimit


def consume_limit(identity, limit, period):
    now = timezone.now()
    key = hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()
    with transaction.atomic():
        row, _ = AuthRateLimit.objects.get_or_create(key=key, defaults={"started_at": now})
        row = AuthRateLimit.objects.select_for_update().get(pk=row.pk)
        if (now - row.started_at).total_seconds() >= period:
            row.started_at, row.attempts = now, 0
        remaining = max(1, period - (now - row.started_at).total_seconds())
        if row.attempts >= limit:
            return False, remaining
        row.attempts += 1
        row.save(update_fields=["started_at", "attempts"])
    return True, remaining


class AuthThrottle(BaseThrottle):
    """Shared counter, keyed by normalized identity; no raw personal data stored."""

    def allow_request(self, request, view):
        data = request.data if isinstance(request.data, dict) else {}
        identifier = (
            str(
                data.get("email")
                or data.get("username")
                or data.get("uid")
                or request.META.get("REMOTE_ADDR", "unknown")
            )
            .strip()
            .lower()
        )
        allowed, self.remaining = consume_limit(
            f"auth:{request.path}:{identifier}", settings.AUTH_ATTEMPTS_PER_WINDOW, 900
        )
        return allowed

    def wait(self):
        return self.remaining
