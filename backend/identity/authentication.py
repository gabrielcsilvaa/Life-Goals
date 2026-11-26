from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models.functions import Lower, Trim


class EmailOrUsernameBackend(ModelBackend):
    """Email for new accounts; retain legacy username access without guessing emails."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = (kwargs.get("email") or username or "").strip()
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
            return user
