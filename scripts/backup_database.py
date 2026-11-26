"""Provider-neutral encrypted PostgreSQL backups. Requires matching pg tools and age."""

import os
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit

import certifi
from dotenv import dotenv_values


def main():
    values = {
        **dotenv_values(
            os.environ.get("BACKEND_ENV_FILE", "/opt/lifegoals/backend.env")
        ),
        **os.environ,
    }
    target = Path(values["BACKUP_DIR"]).resolve()
    if not target.is_dir():
        raise SystemExit("Create a private persistent BACKUP_DIR first.")
    if values.get("DATABASE_URL"):
        url = urlsplit(values["DATABASE_URL"])
        if url.scheme not in {"postgres", "postgresql"} or not url.hostname:
            raise SystemExit("Invalid PostgreSQL backup URL.")
        values.update(
            DB_HOST=url.hostname,
            DB_PORT=str(url.port or 5432),
            DB_NAME=unquote(url.path.lstrip("/")),
            DB_USER=unquote(url.username or ""),
            DB_PASSWORD=unquote(url.password or ""),
        )
    env = {
        **os.environ,
        "PGHOST": values["DB_HOST"],
        "PGPORT": values["DB_PORT"],
        "PGDATABASE": values["DB_NAME"],
        "PGUSER": values["DB_USER"],
        "PGPASSWORD": values["DB_PASSWORD"],
        "PGSSLMODE": "verify-full",
    }
    env["PGSSLROOTCERT"] = values.get("DB_SSLROOTCERT") or certifi.where()
    destination = target / (
        "lifegoals-" + datetime.now(UTC).strftime("%Y%m%dT%H%M%S") + ".dump.age"
    )
    with tempfile.TemporaryDirectory(dir=target) as temp:
        dump = Path(temp) / "database.dump"
        subprocess.run(
            [
                "pg_dump",
                "--format=custom",
                "--no-owner",
                "--no-acl",
                "--file",
                str(dump),
            ],
            env=env,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["pg_restore", "--list", str(dump)], check=True, capture_output=True
        )
        subprocess.run(
            [
                "age",
                "-r",
                values["BACKUP_AGE_RECIPIENT"],
                "-o",
                str(destination),
                str(dump),
            ],
            check=True,
            capture_output=True,
        )
    os.chmod(destination, 0o600)
    print(
        "Encrypted backup created and archive structure validated. Full restore must be tested separately."
    )


if __name__ == "__main__":
    main()
