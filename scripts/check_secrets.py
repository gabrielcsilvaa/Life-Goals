"""Scan Git candidates without displaying secret values; exit nonzero on findings."""

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "private-key": r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    "github-token": r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b",
    "provider-key": r"\b(?:AKIA[0-9A-Z]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{20,})\b",
    "jwt": r"\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b",
    "database-url": r"(?i)(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s:/]+:[^\s@]+@",
}


def candidates():
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, capture_output=True, check=True,
    )
    return sorted(set(result.stdout.decode("utf-8").split("\0")) - {""})


def main():
    # Compare exact local secret values without logging or copying them.
    local_secrets = []
    for env_file in [ROOT / "backend/.env", ROOT / "mobile/.env.local"]:
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                key, separator, value = line.partition("=")
                value = value.strip().strip("\"'")
                if separator and re.search(r"PASSWORD|SECRET|TOKEN|API_KEY", key, re.I) and len(value) >= 8:
                    local_secrets.append(value)
    findings = []
    files = candidates()
    for name in files:
        path = ROOT / name
        if not path.is_file():
            continue
        parts = Path(name).parts
        if (path.name.startswith(".env") and path.name != ".env.example") or any(
            part in {".local", ".venv", "artifacts", "node_modules", "test-results", "playwright-report"}
            for part in parts
        ):
            findings.append((name, 0, "private-path"))
        data = path.read_bytes()
        for secret in local_secrets:
            if secret.encode() in data:
                findings.append((name, 0, "local-secret"))
        if b"\0" in data:
            continue
        for number, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), 1):
            for label, pattern in PATTERNS.items():
                if re.search(pattern, line):
                    findings.append((name, number, label))
    for name, number, label in findings:
        print(f"{name}:{number}: {label} (value redacted)")
    print(f"Scanned {len(files)} Git candidates; {len(findings)} findings.")
    return bool(findings)


if __name__ == "__main__":
    raise SystemExit(main())
