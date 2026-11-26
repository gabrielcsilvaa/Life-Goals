"""Bootstrap the isolated local cluster; backend/.env owns all credentials."""

import json
import secrets
import socket
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg
from dotenv import dotenv_values, set_key, unset_key
from psycopg import sql

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
BIN = LOCAL / "postgres" / "pgsql" / "bin"
DATA = LOCAL / "postgres-data"
ENV_FILE = ROOT / "backend" / ".env"


def lan_address():
    # UDP connect selects the outgoing interface without sending application data.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
            route.connect(("1.1.1.1", 80))
            return route.getsockname()[0]
    except OSError:
        return socket.gethostbyname(socket.gethostname())


def prepare_environment():
    values = dict(dotenv_values(ENV_FILE)) if ENV_FILE.exists() else {}
    fresh = not (DATA / "PG_VERSION").exists()
    legacy_file = LOCAL / "database.json"
    legacy = (
        json.loads(legacy_file.read_text(encoding="utf-8"))
        if legacy_file.exists()
        else {}
    )
    legacy_url = urlparse(values.get("DATABASE_URL") or "")
    defaults = {
        "DB_HOST": legacy_url.hostname or "127.0.0.1",
        "DB_PORT": str(legacy_url.port or legacy.get("port") or 5433),
        "DB_NAME": legacy_url.path.lstrip("/") or legacy.get("database") or "lifegoals",
        "DB_USER": unquote(legacy_url.username or legacy.get("user") or "lifegoals"),
        "DB_PASSWORD": unquote(legacy_url.password or legacy.get("password") or ""),
        "POSTGRES_ADMIN_USER": "postgres",
    }
    old_admin = LOCAL / "postgres-admin.password"
    defaults["POSTGRES_ADMIN_PASSWORD"] = (
        old_admin.read_text(encoding="utf-8").strip() if old_admin.exists() else ""
    )
    for key, value in defaults.items():
        if not values.get(key):
            values[key] = value
    for key in ["DB_PASSWORD", "POSTGRES_ADMIN_PASSWORD"]:
        if not values.get(key):
            if not fresh:
                raise RuntimeError(
                    f"Restaure {key} em backend/.env; o banco existente não será reinicializado."
                )
            values[key] = secrets.token_urlsafe(36)
    values.setdefault("DEBUG", "true")
    if not values.get("SECRET_KEY"):
        values["SECRET_KEY"] = secrets.token_urlsafe(64)
    if values["DB_HOST"] not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Este setup gerencia somente o PostgreSQL local isolado.")
    if not ENV_FILE.exists():
        ENV_FILE.touch()
    for key in ["SECRET_KEY", "DEBUG", *defaults]:
        if dotenv_values(ENV_FILE).get(key) != values[key]:
            set_key(ENV_FILE, key, values[key])
    if "DATABASE_URL" in values:
        unset_key(ENV_FILE, "DATABASE_URL")
    return values


def main():
    LOCAL.mkdir(exist_ok=True)
    values = prepare_environment()
    port = int(values["DB_PORT"])
    if not (DATA / "PG_VERSION").exists():
        temporary_password = LOCAL / ".initdb-password"
        temporary_password.write_text(
            values["POSTGRES_ADMIN_PASSWORD"], encoding="utf-8"
        )
        try:
            subprocess.run(
                [
                    str(BIN / "initdb.exe"),
                    "-D",
                    str(DATA),
                    "-U",
                    values["POSTGRES_ADMIN_USER"],
                    "--pwfile",
                    str(temporary_password),
                    "--auth=scram-sha-256",
                    "--encoding=UTF8",
                    "--locale=C",
                ],
                check=True,
            )
        finally:
            temporary_password.unlink(missing_ok=True)
        with (DATA / "postgresql.conf").open("a", encoding="utf-8") as config:
            config.write(
                f"\n# Life Goals local development\nlisten_addresses='127.0.0.1'\nport={port}\n"
            )
    status = subprocess.run(
        [str(BIN / "pg_ctl.exe"), "-D", str(DATA), "status"],
        capture_output=True,
        check=False,
    )
    if status.returncode:
        subprocess.run(
            [
                str(BIN / "pg_ctl.exe"),
                "-D",
                str(DATA),
                "-l",
                str(LOCAL / "postgres.log"),
                "-w",
                "start",
            ],
            check=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    with psycopg.connect(
        host=values["DB_HOST"],
        port=port,
        dbname="postgres",
        user=values["POSTGRES_ADMIN_USER"],
        password=values["POSTGRES_ADMIN_PASSWORD"],
        autocommit=True,
    ) as connection:
        if not connection.execute(
            "SELECT 1 FROM pg_roles WHERE rolname = %s", (values["DB_USER"],)
        ).fetchone():
            connection.execute(
                sql.SQL(
                    "CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD {}"
                ).format(
                    sql.Identifier(values["DB_USER"]),
                    sql.Literal(values["DB_PASSWORD"]),
                )
            )
        if not connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (values["DB_NAME"],)
        ).fetchone():
            connection.execute(
                sql.SQL("CREATE DATABASE {} OWNER {}").format(
                    sql.Identifier(values["DB_NAME"]), sql.Identifier(values["DB_USER"])
                )
            )
    with psycopg.connect(
        host=values["DB_HOST"],
        port=port,
        dbname=values["DB_NAME"],
        user=values["DB_USER"],
        password=values["DB_PASSWORD"],
    ) as connection:
        print(
            "Banco validado:",
            connection.execute("SELECT current_database(), current_user").fetchone(),
        )
    # Retire only the old credential copies, after verifying both real logins.
    for legacy_name in ["database.json", "postgres-admin.password"]:
        (LOCAL / legacy_name).unlink(missing_ok=True)
    address = lan_address()
    network = {
        "ALLOWED_HOSTS": f"localhost,127.0.0.1,{address}",
        "CORS_ALLOWED_ORIGINS": f"http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://127.0.0.1:8082,http://{address}:8082",
    }
    for key, value in network.items():
        if dotenv_values(ENV_FILE).get(key) != value:
            set_key(ENV_FILE, key, value)
    mobile_env = ROOT / "mobile" / ".env.local"
    if not mobile_env.exists():
        mobile_env.touch()
    public_api = f"http://{address}:8000"
    if dotenv_values(mobile_env).get("EXPO_PUBLIC_API_URL") != public_api:
        set_key(mobile_env, "EXPO_PUBLIC_API_URL", public_api)
    print("Credenciais em backend/.env; configuração local atualizada.")


if __name__ == "__main__":
    main()
