#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
NEXUS_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
NEXUS_ENV="$NEXUS_ROOT/.private/nexus/production.env"
test -f "$NEXUS_ENV" || { echo 'Private configuration is missing.' >&2; exit 1; }
dc() { docker compose --env-file "$NEXUS_ENV" -f "$NEXUS_ROOT/deploy/nexus/compose.yml" "$@"; }
