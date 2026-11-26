import logging
import os
import re


class PrivateDataFilter(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        for key, value in os.environ.items():
            if (
                any(word in key for word in ("PASSWORD", "SECRET", "TOKEN", "DATABASE_URL"))
                and len(value) >= 8
            ):
                message = message.replace(value, "[redacted]")
        message = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email]", message)
        message = re.sub(
            r"Bearer\s+\S+|\blg_[A-Za-z0-9_-]{40,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+", "[token]", message
        )
        record.msg, record.args = message, ()
        record.exc_info = None
        record.stack_info = None
        return True
