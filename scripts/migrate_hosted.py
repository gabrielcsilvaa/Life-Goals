"""Apply a reviewed additive plan after CI has retained an encrypted backup."""

import os
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit


def main():
    if os.environ.get("BACKUP_RETAINED") != "1":
        raise SystemExit("Retained encrypted backup is required before migrations.")
    backup_dir = Path(os.environ["BACKUP_DIR"])
    if not any(backup_dir.glob("*.dump.age")):
        raise SystemExit("Encrypted backup file is missing.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.production_settings"
    # Management commands do not send mail or sign user sessions.
    os.environ.setdefault("SECRET_KEY", secrets.token_urlsafe(64))
    os.environ.setdefault(
        "ALLOWED_HOSTS", urlsplit(os.environ["BACKEND_ORIGIN"]).hostname
    )
    os.environ.setdefault("EMAIL_HOST", "unused.invalid")
    os.environ.setdefault("EMAIL_HOST_USER", "maintenance-only")
    os.environ.setdefault("EMAIL_HOST_PASSWORD", secrets.token_urlsafe(32))
    os.environ.setdefault("DEFAULT_FROM_EMAIL", "unused@example.com")
    import django

    django.setup()
    from django.core.management import call_command

    call_command("audit_identity")
    # Shares the exact same gate used for the portable VPS path.
    import runpy

    runpy.run_path(str(Path(__file__).with_name("check_migration_plan.py")))
    call_command("migrate", interactive=False, verbosity=0)
    print("Reviewed migrations applied; no automatic database rollback is configured.")


if __name__ == "__main__":
    main()
