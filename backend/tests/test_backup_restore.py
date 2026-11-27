import os
import shutil
import subprocess
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from django.db import connection
from psycopg import sql

from finance.services import execute


@pytest.mark.django_db(transaction=True)
def test_postgresql_backup_restores_financial_records(user, account, category, tmp_path):
    if connection.vendor != "postgresql":
        pytest.skip("Requires isolated PostgreSQL backup tools.")
    config = connection.settings_dict
    if not config["NAME"].startswith("test_lifegoals_audit_"):
        pytest.fail("Refusing to dump a non-test database.")
    binary = Path(os.environ.get("PG_BIN_DIR", ".local/postgres/pgsql/bin")).resolve()
    dump_tool = binary / ("pg_dump.exe" if os.name == "nt" else "pg_dump")
    restore_tool = binary / ("pg_restore.exe" if os.name == "nt" else "pg_restore")
    if not dump_tool.exists():
        dump_tool = shutil.which("pg_dump")
        restore_tool = shutil.which("pg_restore")
    assert dump_tool and restore_tool, "PostgreSQL backup tools are required for this validation."
    execute(
        user,
        "create_transaction",
        {
            "kind": "expense",
            "amount": "32.00",
            "due_date": "2026-11-01",
            "paid_on": "2026-11-01",
            "account_id": str(account.pk),
            "category_id": str(category.pk),
        },
        str(uuid4()),
    )
    env = {
        **os.environ,
        "PGHOST": config["HOST"],
        "PGPORT": str(config["PORT"]),
        "PGUSER": config["USER"],
        "PGPASSWORD": config["PASSWORD"],
        "PGDATABASE": config["NAME"],
    }
    dump = tmp_path / "isolated.dump"
    subprocess.run(
        [str(dump_tool), "--format=custom", "--no-owner", "--no-acl", "--file", str(dump)],
        env=env,
        check=True,
        capture_output=True,
    )
    restored = "test_lifegoals_audit_restore_" + uuid4().hex[:12]
    with psycopg.connect(
        host=config["HOST"],
        port=config["PORT"],
        user=config["USER"],
        password=config["PASSWORD"],
        dbname="postgres",
        autocommit=True,
    ) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(restored)))
        try:
            subprocess.run(
                [
                    str(restore_tool),
                    "--no-owner",
                    "--no-acl",
                    "--exit-on-error",
                    "--dbname",
                    restored,
                    str(dump),
                ],
                env=env,
                check=True,
                capture_output=True,
            )
            with psycopg.connect(
                host=config["HOST"],
                port=config["PORT"],
                user=config["USER"],
                password=config["PASSWORD"],
                dbname=restored,
            ) as check:
                count, amount = check.execute(
                    "SELECT count(*), sum(amount) FROM finance_cashmovement WHERE user_id=%s", [user.pk]
                ).fetchone()
                assert count == 1 and amount == -32
                assert (
                    check.execute(
                        "SELECT count(*) FROM finance_entry WHERE user_id=%s", [user.pk]
                    ).fetchone()[0]
                    == 1
                )
        finally:
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(restored)))
