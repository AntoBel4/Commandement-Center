#!/usr/bin/env bash
# Restore ONLY into a new disposable container, with no published port or production volume.
set -Eeuo pipefail
umask 077
test "$#" -eq 2 && [[ "$1" = /* ]] || { echo 'Usage: restore-check.sh /absolute/backup postgres-image@sha256:digest' >&2; exit 1; }
backup=$(cd -- "$1" && pwd)
image=$2
[[ "$image" =~ ^[a-z0-9./:_-]+@sha256:[a-f0-9]{64}$ ]] || { echo 'A pinned PostgreSQL image is required.' >&2; exit 1; }
(cd -- "$backup" && sha256sum -c SHA256SUMS)
drill="commandement-restore-$(date +%s)-$$"
created=false
cleanup() { if [[ "$created" = true ]]; then docker rm -f -v "$drill" >/dev/null; fi; }
trap cleanup EXIT
docker run -d --name "$drill" --label commandement.restore-check=true --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
created=true
ready=false
for ((attempt=0;attempt<60;attempt++)); do
  # The image starts a temporary server during initialization. Wait for the
  # entrypoint to exec the final postgres process before accepting readiness.
  if docker exec "$drill" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres' >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" = true ]] || { echo 'Restore database did not start.' >&2; exit 1; }
docker exec "$drill" createdb -U postgres courses
docker exec "$drill" createdb -U postgres identity
docker exec -i "$drill" pg_restore -U postgres -d courses --no-owner --no-acl --exit-on-error < "$backup/courses.dump"
docker exec -i "$drill" pg_restore -U postgres -d identity --no-owner --no-acl --exit-on-error < "$backup/identity.dump"
courses=$(docker exec "$drill" psql -U postgres -d courses -At -v ON_ERROR_STOP=1 -c \
  'select (select count(*) from families), (select count(*) from family_members), (select count(*) from grocery_items), (select count(*) from grocery_history), (select count(*) from grocery_requests);')
identity=$(docker exec "$drill" psql -U postgres -d identity -At -v ON_ERROR_STOP=1 -c \
  'select (select count(*) from realm), (select count(*) from user_entity), (select count(*) from credential);')
[[ "$courses" = "$(cat "$backup/courses.counts")" && "$identity" = "$(cat "$backup/identity.counts")" ]] || { echo 'Restored record counts differ.' >&2; exit 1; }
echo 'Both databases restored; household, grocery, history, request, realm, user and credential counts match.'
echo 'This verifies database recovery; still perform login and grocery checks on an isolated full stack before a production recovery.'
