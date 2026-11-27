"""Account mail over HTTPS on providers that block SMTP ports."""

import json
from email.utils import parseaddr
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class BrevoEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            if not message.recipients():
                continue
            name, address = parseaddr(message.from_email)
            payload = {
                "sender": {"email": address, "name": name or "Life Goals"},
                "to": [{"email": parseaddr(recipient)[1]} for recipient in message.to],
                "subject": message.subject,
                "textContent": message.body,
            }
            for field in ("cc", "bcc"):
                if getattr(message, field):
                    payload[field] = [{"email": parseaddr(r)[1]} for r in getattr(message, field)]
            request = Request(
                "https://api.brevo.com/v3/smtp/email",
                data=json.dumps(payload).encode(),
                headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                    if response.status != 201:
                        raise OSError("Email was not accepted.")
                sent += 1
            except (HTTPError, URLError, OSError):
                if not self.fail_silently:
                    raise OSError("Não foi possível enviar o e-mail. Tente novamente mais tarde.") from None
        return sent
