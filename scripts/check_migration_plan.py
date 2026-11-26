"""Fail closed on unreviewed/destructive migrations; never applies them."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, os.getcwd())
import django

django.setup()
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

executor = MigrationExecutor(connection)
plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
allowed = {"CreateModel", "AddField", "AddIndex", "AddConstraint", "AlterModelOptions"}
for migration, backwards in plan:
    if backwards:
        raise SystemExit("Backward migration refused.")
    for operation in migration.operations:
        name = type(operation).__name__
        # Existing reviewed bootstrap operations are permitted only in explicit bootstrap.
        bootstrap = os.getenv("ALLOW_INITIAL_BOOTSTRAP") == "1" and migration.initial
        email_preflight = (
            name == "RunPython"
            and getattr(operation.code, "__name__", "") == "check_legacy_emails"
            and migration.app_label == "identity"
        )
        if name not in allowed and not bootstrap and not email_preflight:
            raise SystemExit(
                f"Manual database review required: {migration.app_label}.{migration.name}: {name}"
            )
print(f"Reviewed additive plan: {len(plan)} pending migrations. No changes applied.")
