"""Real browser login and consent against an isolated ephemeral Django test DB."""

import os
import subprocess
from pathlib import Path

import pytest

from identity.models import User
from integrations.models import Connection


@pytest.mark.skipif(os.getenv("LIFEGOALS_RUN_UI") != "1", reason="Requires Edge and Node")
@pytest.mark.django_db(transaction=True)
def test_oauth_browser_login_and_consent(live_server):
    user = User.objects.create_user(username="oauth-browser-user", password="Browser-OAuth-test-96!")
    mobile = Path(__file__).resolve().parents[2] / "mobile"
    result = subprocess.run(
        ["node", str(mobile / "node_modules/@playwright/test/cli.js"), "test", "oauth-login.spec.ts"],
        cwd=mobile,
        env={**os.environ, "LIFEGOALS_TEST_API": live_server.url},
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=160,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert Connection.objects.filter(user=user, oauth_application__isnull=False, revoked_at=None).exists()
