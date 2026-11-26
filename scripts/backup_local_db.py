"""Create a local PostgreSQL custom archive without displaying credentials."""

import os
import subprocess
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
directory = ROOT / ".local" / "backups"
directory.mkdir(exist_ok=True)
destination = directory / f"lifegoals-{datetime.now():%Y%m%d-%H%M%S-%f}.dump"
binary = ROOT / ".local" / "postgres" / "pgsql" / "bin" / "pg_dump.exe"
values = dotenv_values(ROOT / "backend" / ".env")
parameters = urlparse(values.get("DATABASE_URL") or "")
# Secrets are passed only through a child environment, never argv/log output.
subprocess.run(
    [str(binary), "--format=custom", "--file", str(destination)],
    env={
        **os.environ,
        "PGHOST": parameters.hostname or values["DB_HOST"],
        "PGPORT": str(parameters.port or values.get("DB_PORT") or 5432),
        "PGDATABASE": parameters.path.lstrip("/") or values["DB_NAME"],
        "PGUSER": unquote(parameters.username or values.get("DB_USER") or ""),
        "PGPASSWORD": unquote(parameters.password)
        if parameters.password is not None
        else values["DB_PASSWORD"],
    },
    check=True,
)
subprocess.run(
    [str(binary.with_name("pg_restore.exe")), "--list", str(destination)],
    check=True,
    capture_output=True,
)
print(f"Backup verified: {destination.name} ({destination.stat().st_size} bytes)")
