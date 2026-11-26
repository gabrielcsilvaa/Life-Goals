import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest

spec = importlib.util.spec_from_file_location(
    "deploy_render", Path(__file__).resolve().parents[2] / "scripts/deploy_render.py"
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

COMMIT = "a" * 40
ORIGIN = "https://lifegoals-test.onrender.com"


@pytest.mark.parametrize("plan,origin", [("starter", ORIGIN), ("free", "https://wrong.example.com")])
def test_release_refuses_paid_plan_and_wrong_target(plan, origin):
    with patch.object(
        release,
        "render_request",
        return_value={"type": "web_service", "serviceDetails": {"plan": plan, "url": origin}},
    ) as api:
        with pytest.raises(RuntimeError):
            release.deploy("srv-testonly", COMMIT, ORIGIN)
        assert api.call_count == 1


def test_release_waits_for_exact_image_and_blocks_failed_deploy():
    with patch.object(
        release,
        "render_request",
        side_effect=[
            {
                "type": "web_service",
                "branch": "main",
                "autoDeploy": "no",
                "serviceDetails": {"plan": "free", "url": ORIGIN},
            },
            {"id": "dep-testonly"},
            {"status": "update_failed"},
        ],
    ) as api:
        with pytest.raises(RuntimeError, match="frontend promotion is blocked"):
            release.deploy("srv-testonly", COMMIT, ORIGIN)
        assert api.call_args_list[1].args[1] == {"commitId": COMMIT}
