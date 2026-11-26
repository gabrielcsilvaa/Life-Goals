import json
from unittest.mock import MagicMock, patch
from urllib.error import URLError

import pytest
from django.core.mail import EmailMessage
from django.test import override_settings

from identity.email_backend import BrevoEmailBackend


@override_settings(BREVO_API_KEY="test-only-mail-key", EMAIL_TIMEOUT=5)
def test_https_email_preserves_reset_link_without_smtp():
    response = MagicMock()
    response.__enter__.return_value.status = 201
    with patch("identity.email_backend.urlopen", return_value=response) as send:
        message = EmailMessage(
            "Life Goals",
            "https://app.example.com/reset-password#token=test-only",
            "Life Goals <sender@example.com>",
            ["person@example.com"],
        )
        assert BrevoEmailBackend().send_messages([message]) == 1
        request = send.call_args.args[0]
        assert request.full_url == "https://api.brevo.com/v3/smtp/email"
        assert json.loads(request.data)["textContent"].endswith("#token=test-only")
        assert "test-only-mail-key" not in request.full_url


@override_settings(BREVO_API_KEY="test-only-mail-key", EMAIL_TIMEOUT=5)
def test_email_failure_does_not_expose_provider_body():
    with patch("identity.email_backend.urlopen", side_effect=URLError("private-provider-body")):
        message = EmailMessage("Life Goals", "private-token", to=["person@example.com"])
        with pytest.raises(OSError, match="Não foi possível enviar") as error:
            BrevoEmailBackend().send_messages([message])
        assert "private-provider-body" not in str(error.value)
        assert BrevoEmailBackend(fail_silently=True).send_messages([message]) == 0
