"""Deploy a tested commit to an existing FREE Render Docker web service."""

import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def render_request(path, payload=None):
    request = Request(
        "https://api.render.com/v1/" + path,
        headers={
            "Authorization": "Bearer " + os.environ["RENDER_API_KEY"],
            "Content-Type": "application/json",
        },
        data=json.dumps(payload).encode() if payload is not None else None,
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except (HTTPError, URLError):
        raise RuntimeError(
            "Render API request failed; no credentials or response body logged."
        ) from None


def deploy(service_id, commit, expected_origin):
    if not re.fullmatch(r"srv-[a-z0-9]+", service_id):
        raise ValueError("Invalid Render service ID.")
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("An immutable tested commit is required.")
    service = render_request(f"services/{service_id}")
    details = service.get("serviceDetails", {})
    if service.get("type") != "web_service" or details.get("plan") != "free":
        raise RuntimeError(
            "Refusing deployment: target must be an existing Free web service."
        )
    if details.get("url", "").rstrip("/") != expected_origin.rstrip("/"):
        raise RuntimeError(
            "Render backend origin does not match the configured target."
        )
    if service.get("branch") != "main" or service.get("autoDeploy") != "no":
        raise RuntimeError("Render must follow main with native auto-deploy disabled.")
    result = render_request(f"services/{service_id}/deploys", {"commitId": commit})
    deploy_id = result["id"]
    if not re.fullmatch(r"dep-[a-z0-9]+", deploy_id):
        raise RuntimeError("Invalid deploy ID returned by Render.")
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        status = render_request(f"services/{service_id}/deploys/{deploy_id}")["status"]
        if status == "live":
            print("Render deployment is live; public readiness still must be verified.")
            return
        if status in {"build_failed", "update_failed", "canceled", "deactivated"}:
            raise RuntimeError(
                "Render deployment failed; frontend promotion is blocked."
            )
        time.sleep(10)
    raise RuntimeError("Render deployment timed out; frontend promotion is blocked.")


if __name__ == "__main__":
    deploy(
        os.environ["RENDER_SERVICE_ID"],
        os.environ["RELEASE_COMMIT"],
        os.environ["BACKEND_ORIGIN"],
    )
