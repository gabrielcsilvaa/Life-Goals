from django.db import models

from finance.models import OwnedModel


class Connection(OwnedModel):
    oauth_application = models.ForeignKey(
        "oauth2_provider.Application", on_delete=models.CASCADE, null=True, blank=True
    )

    name = models.CharField(max_length=80)
    token_hash = models.CharField(max_length=64, unique=True)
    scopes = models.JSONField(default=list)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "oauth_application"],
                condition=models.Q(oauth_application__isnull=False),
                name="one_oauth_connection_per_user_client",
            )
        ]
