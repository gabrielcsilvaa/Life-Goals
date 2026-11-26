from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower, Now, Trim


class User(AbstractUser):
    display_name = models.CharField(max_length=80, blank=True)
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())
    email_verified_at = models.DateTimeField(null=True, blank=True)
    pending_email = models.EmailField(blank=True, db_default="")
    preferences = models.JSONField(default=dict, blank=True, db_default={})

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                Lower(Trim("email")), condition=~models.Q(email=""), name="unique_normalized_user_email"
            )
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        if kwargs.get("update_fields"):
            kwargs["update_fields"] = set(kwargs["update_fields"]) | {"updated_at"}
        super().save(*args, **kwargs)


class AuthRateLimit(models.Model):
    key = models.CharField(max_length=64, unique=True)
    started_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
