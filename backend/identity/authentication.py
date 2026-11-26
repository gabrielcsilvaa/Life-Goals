from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models.functions import Lower, Trim


class EmailOrUsernameBackend(ModelBackend):
    """Email for new accounts; retain legacy username access without guessing emails."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = kwargs.get("email") or username or ""
        if not isinstance(identifier, str) or not isinstance(password, str):
            return None
        identifier = identifier.strip()
        model = get_user_model()
        try:
            if "@" in identifier:
                user = model.objects.annotate(normalized_email=Lower(Trim("email"))).get(
                    normalized_email=identifier.lower()
                )
            else:
                user = model.objects.get(username=identifier)
        except (model.DoesNotExist, model.MultipleObjectsReturned):
            model().set_password(password or "")  # Equalize missing-account password work.
            return None
        if password and user.check_password(password) and self.user_can_authenticate(user):
            if settings.REQUIRE_EMAIL_VERIFICATION and user.email and not user.email_verified_at:
                return None
            return user
