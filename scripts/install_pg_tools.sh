#!/usr/bin/env bash
set -euo pipefail
# Official PGDG packages; Ubuntu's default repository only includes PG 16.
. /etc/os-release
test "$ID" = ubuntu && test "$VERSION_ID" = 24.04
key_file="$(mktemp)"
trap 'rm -f "$key_file"' EXIT
curl --fail --silent --show-error https://www.postgresql.org/media/keys/ACCC4CF8.asc -o "$key_file"
fingerprint="$(gpg --batch --show-keys --with-colons "$key_file" | awk -F: '$1 == "fpr" {print $10; exit}')"
test "$fingerprint" = B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8
sudo install -m 644 "$key_file" /usr/share/keyrings/lifegoals-pgdg.asc
printf '%s\n' 'deb [arch=amd64 signed-by=/usr/share/keyrings/lifegoals-pgdg.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main' | sudo tee /etc/apt/sources.list.d/lifegoals-pgdg.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y postgresql-client-16 postgresql-client-18 age
