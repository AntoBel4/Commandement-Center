#!/usr/bin/env bash
# A short maintenance window gives a consistent pair of database backups.
source "$(dirname -- "$0")/common.sh"
test "$#" -eq 1 && [[ "$1" = /* ]] || { echo 'Usage: backup.sh /absolute/new-backup-directory' >&2; exit 1; }
destination=$1
mkdir -m 700 -- "$destination" # Refuse existing directories (including symlinks).
running=()
containers=()
services=(web api keycloak)
if test -f "$NEXUS_ROOT/.private/nexus/alexa.env"; then services+=(alexa); fi
if test -f "$NEXUS_ROOT/.private/nexus/telegram.env"; then services+=(telegram); fi
for service in "${services[@]}"; do
  container=$(dc ps --status running -q "$service")
  if [[ -n "$container" ]]; then running+=("$service"); containers+=("$container"); fi
done
resume() {
  local result=$?
  trap - EXIT
  if ((${#containers[@]})); then
    docker start "${containers[@]}" >/dev/null || result=1
    for container in "${containers[@]}"; do
      healthy=false
      for ((attempt=0;attempt<120;attempt++)); do
        state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container") || break
        if [[ "$state" = healthy || "$state" = running ]]; then healthy=true; break; fi
        sleep 1
      done
      [[ "$healthy" = true ]] || result=1
    done
  fi
  if ((result)); then echo 'Backup incomplete or service restart failed. Inspect service health.' >&2; fi
  exit "$result"
}
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if ((${#running[@]})); then dc stop "${running[@]}"; fi
dc exec -T postgres pg_dump -U commandement -d commandement -Fc > "$destination/courses.dump"
dc exec -T keycloak-db pg_dump -U keycloak -d keycloak -Fc > "$destination/identity.dump"
dc exec -T postgres psql -U commandement -d commandement -At -v ON_ERROR_STOP=1 -c \
  'select (select count(*) from families), (select count(*) from family_members), (select count(*) from grocery_items), (select count(*) from grocery_history), (select count(*) from grocery_requests);' > "$destination/courses.counts"
dc exec -T keycloak-db psql -U keycloak -d keycloak -At -v ON_ERROR_STOP=1 -c \
  'select (select count(*) from realm), (select count(*) from user_entity), (select count(*) from credential);' > "$destination/identity.counts"
cp -- "$NEXUS_ENV" "$destination/production.env"
cp -- "$NEXUS_ROOT/.private/nexus/portal-config.json" "$destination/portal-config.json"
cp -- "$NEXUS_ROOT/.private/nexus/commandement-realm.json" "$destination/commandement-realm.json"
git -C "$NEXUS_ROOT" rev-parse HEAD > "$destination/source-commit.txt"
dc images --format json > "$destination/images.json"
extra=()
if test -f "$NEXUS_ROOT/.private/nexus/alexa.env"; then
  cp -- "$NEXUS_ROOT/.private/nexus/alexa.env" "$destination/alexa.env"
  extra+=(alexa.env)
fi
# The identity dump contains the linked client's secret; no plaintext client export is needed.
for file in google-calendar.env google-calendar.json telegram.env telegram-token; do
  if test -f "$NEXUS_ROOT/.private/nexus/$file"; then
    cp -- "$NEXUS_ROOT/.private/nexus/$file" "$destination/$file"
    extra+=("$file")
  fi
done
(cd -- "$destination" && sha256sum courses.dump identity.dump courses.counts identity.counts production.env portal-config.json commandement-realm.json source-commit.txt images.json "${extra[@]}" > SHA256SUMS)
printf 'Complete local backup. Copy encrypted off-server before declaring protection: %s\n' "$destination"
