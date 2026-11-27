#!/usr/bin/env bash
set -euo pipefail
# Runs only on a prepared host over authenticated SSH. No secrets are passed in argv.
image="${1:?immutable image required}"
commit="${2:?commit required}"
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$image" =~ ^ghcr.io/[a-z0-9._/-]+:[a-f0-9]{40}$ ]] || exit 2
cd "${LIFEGOALS_DEPLOY_ROOT:-/opt/lifegoals}"
test -f backend.env && test -f migration.env && test -x backup.sh && test -f compose.yml
exec 9>deploy.lock
flock -n 9 || { echo 'Another deployment is active'; exit 3; }
./backup.sh  # Must produce and validate an encrypted persistent backup or fail.
docker pull "$image"
previous="$(cat current-image 2>/dev/null || true)"
docker run --rm --env-file migration.env -e "APP_VERSION=$commit" -v "$PWD/certs:/run/certs:ro" "$image" python manage.py audit_identity
docker run --rm --env-file migration.env -e "APP_VERSION=$commit" -v "$PWD/certs:/run/certs:ro" -v "$PWD/check_migration_plan.py:/tmp/check_migration_plan.py:ro" "$image" python /tmp/check_migration_plan.py
# This command is reachable only after backup and the additive migration gate.
docker run --rm --env-file migration.env -e "APP_VERSION=$commit" -v "$PWD/certs:/run/certs:ro" "$image" python manage.py migrate --noinput
export LIFEGOALS_IMAGE="$image" APP_VERSION="$commit"
if ! docker compose -f compose.yml up -d --wait --wait-timeout 120 || ! curl --fail --silent --max-time 15 http://127.0.0.1:8000/ready/ | python3 -c 'import json,sys; assert json.load(sys.stdin)["version"] == sys.argv[1]' "$commit"; then
  if [[ -n "$previous" ]]; then
    LIFEGOALS_IMAGE="$previous" APP_VERSION="${previous##*:}" docker compose -f compose.yml up -d --wait
  fi
  echo 'Health failed. Code rollback attempted; database was NOT reversed.'
  exit 1
fi
printf '%s\n' "$image" > current-image
printf '%s\n' "$previous" > previous-image
