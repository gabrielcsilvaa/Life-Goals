import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

spec = importlib.util.spec_from_file_location(
    "setup_local_db", Path(__file__).resolve().parents[2] / "scripts/setup_local_db.py"
)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


def test_hosted_start_preserves_url_and_never_bootstraps_local_database(tmp_path):
    env_file = tmp_path / ".env"
    content = "LIFEGOALS_DATABASE_MODE=hosted\nDATABASE_URL=postgresql://test:unused@db.example.com/app?sslmode=verify-full\n"
    env_file.write_text(content)
    connection = MagicMock()
    with (
        patch.object(setup, "ENV_FILE", env_file),
        patch.object(setup, "LOCAL", tmp_path),
        patch.object(setup, "prepare_environment", side_effect=AssertionError("No local bootstrap")),
        patch.object(setup.psycopg, "connect", return_value=connection),
    ):
        setup.main()
    assert env_file.read_text() == content
    statements = [call.args[0] for call in connection.__enter__.return_value.execute.call_args_list]
    assert statements == ["SET TRANSACTION READ ONLY", "SELECT 1"]


@pytest.mark.parametrize(
    "url",
    ["", "postgresql://localhost/app?sslmode=verify-full", "postgresql://db.example.com/app?sslmode=require"],
)
def test_hosted_start_refuses_missing_local_or_unverified_connection(tmp_path, url):
    env_file = tmp_path / ".env"
    env_file.write_text("LIFEGOALS_DATABASE_MODE=hosted\nDATABASE_URL=" + url)
    with patch.object(setup, "ENV_FILE", env_file), patch.object(setup, "LOCAL", tmp_path):
        with pytest.raises(RuntimeError, match="TLS verify-full"):
            setup.main()
