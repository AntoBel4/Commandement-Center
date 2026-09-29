#!/usr/bin/env bash
# Restore from an ENCRYPTED off-site archive. The age private key is read on standard
# input and kept in memory only (never written to Nexus disks). Decrypted files hold
# production secrets: they are deleted on exit, error or interruption.
#
#   Rehearsal (isolated Compose project, no port, no proxy, no production volume):
#     restore-service.sh --rehearse [--with-services] /abs/archive.tar.age < key-from-usb
#   Production (MANUAL ONLY, never from monitor.sh or a timer):
#     restore-service.sh --production --confirm <archive-name> --pre-backup /abs/new-dir \
#       [--restore-private] /abs/archive.tar.age < key-from-usb
set -Eeuo pipefail
umask 077
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mode='' with_services=false confirm='' pre_backup='' restore_private=false
while (($#)); do
  case $1 in
    --rehearse) mode=rehearse;;
    --production) mode=production;;
    --with-services) with_services=true;;
    --restore-private) restore_private=true;;
    --confirm) confirm=${2:?}; shift;;
    --pre-backup) pre_backup=${2:?}; shift;;
    -*) echo "Unknown option $1" >&2; exit 1;;
    *) break;;
  esac
  shift
done
test "$#" -eq 1 && [[ "$1" = /*.tar.age && -f "$1" ]] && [[ -n "$mode" ]] || {
  echo 'Usage: restore-service.sh --rehearse [--with-services] | --production --confirm NAME --pre-backup DIR [--restore-private]  /abs/archive.tar.age < age-key' >&2; exit 1; }
archive=$1
name=$(basename -- "$archive" .tar.age)
[[ "$name" =~ ^commandement-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$ ]] || { echo 'Unexpected archive name.' >&2; exit 1; }
if [[ "$mode" = production ]]; then
  [[ "$confirm" = "$name" ]] || { echo "Production restore requires --confirm $name" >&2; exit 1; }
  [[ "$pre_backup" = /* ]] || { echo 'Production restore requires --pre-backup /absolute/new-directory' >&2; exit 1; }
fi
test ! -t 0 || { echo 'Provide the age private key on standard input (e.g. < /media/usb/key.txt or through ssh).' >&2; exit 1; }
identity=$(cat)
[[ "$identity" == *AGE-SECRET-KEY-1* ]] || { echo 'Standard input is not an age identity.' >&2; exit 1; }

work=''
project=''
cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$project" ]]; then
    docker compose -p "$project" --env-file "$work/rehearsal.env" -f "$here/rehearsal.yml" --profile services down -v --remove-orphans >/dev/null 2>&1 || result=1
  fi
  if [[ -n "$work" ]]; then rm -rf -- "$work"; fi
  identity=''
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
work=$(mktemp -d "${TMPDIR:-/tmp}/commandement-restore.XXXXXX")

if test -f "$archive.sha256"; then (cd -- "$(dirname -- "$archive")" && sha256sum -c --quiet "$name.tar.age.sha256"); fi
age -d -i <(printf '%s\n' "$identity") "$archive" | tar -C "$work" --no-same-owner -xf -
identity=''
backup="$work/$name"
test -d "$backup" || { echo 'Archive layout unexpected.' >&2; exit 1; }
(cd -- "$backup" && sha256sum -c --quiet SHA256SUMS)
echo "Archive decrypted and SHA256SUMS verified: $name"

envvalue() { grep -m1 "^$1=" "$backup/production.env" | cut -d= -f2-; }
courses_counts='select (select count(*) from families), (select count(*) from family_members), (select count(*) from grocery_items), (select count(*) from grocery_history), (select count(*) from grocery_requests);'
identity_counts='select (select count(*) from realm), (select count(*) from user_entity), (select count(*) from credential);'

if [[ "$mode" = rehearse ]]; then
  project="commandement-rehearsal-$(date +%s)"
  {
    printf 'REHEARSAL_PROJECT=%s\n' "$project"
    for key in POSTGRES_IMAGE POSTGRES_PASSWORD KEYCLOAK_DB_PASSWORD KEYCLOAK_IMAGE PORTAL_HOST RELEASE DATABASE_URL; do
      printf '%s=%s\n' "$key" "$(envvalue "$key")"
    done
  } > "$work/rehearsal.env"
  rc() { docker compose -p "$project" --env-file "$work/rehearsal.env" -f "$here/rehearsal.yml" "$@"; }
  rc up -d postgres keycloak-db
  for service in postgres keycloak-db; do
    ready=false
    for ((attempt=0;attempt<90;attempt++)); do
      if rc exec -T "$service" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -q' >/dev/null 2>&1; then ready=true; break; fi
      sleep 1
    done
    [[ "$ready" = true ]] || { echo "$service did not start." >&2; exit 1; }
  done
  rc exec -T postgres pg_restore -U commandement -d commandement --no-owner --role=commandement --exit-on-error < "$backup/courses.dump"
  rc exec -T keycloak-db pg_restore -U keycloak -d keycloak --no-owner --role=keycloak --exit-on-error < "$backup/identity.dump"
  courses=$(rc exec -T postgres psql -U commandement -d commandement -At -v ON_ERROR_STOP=1 -c "$courses_counts")
  ident=$(rc exec -T keycloak-db psql -U keycloak -d keycloak -At -v ON_ERROR_STOP=1 -c "$identity_counts")
  [[ "$courses" = "$(cat "$backup/courses.counts")" && "$ident" = "$(cat "$backup/identity.counts")" ]] || { echo 'Restored record counts differ.' >&2; exit 1; }
  echo "Databases restored in $project; counts match (courses $courses, identity $ident)."
  if [[ "$with_services" = true ]]; then
    echo 'Effective rehearsal configuration (no port, internal network, no Google/Telegram variable):'
    rc --profile services config --no-interpolate | grep -Ev 'PASSWORD|DATABASE_URL'
    rc --profile services up -d --wait --wait-timeout 300 keycloak api
    rc exec -T api node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{console.log('api /ready',r.status);process.exit(r.ok?0:1)})"
    rc exec -T api node -e "fetch('http://keycloak:9000/auth/health/ready').then(r=>{console.log('keycloak ready',r.status);process.exit(r.ok?0:1)}).catch(()=>fetch('http://keycloak:8080/auth/realms/commandement').then(r=>{console.log('realm',r.status);process.exit(r.ok?0:1)}))"
    echo 'Service rehearsal passed: identity and API start on the restored data, isolated.'
  fi
  echo 'Rehearsal complete; project, volumes and decrypted files are removed on exit.'
  exit 0
fi

# ---- Production: manual only ----
source "$here/common.sh"
[[ "$(cat "$backup/source-commit.txt")" = "$(git -C "$NEXUS_ROOT" rev-parse HEAD)" ]] || {
  echo "Checkout $(cat "$backup/source-commit.txt") first (same code and migrations as the backup)." >&2; exit 1; }
echo 'Mandatory safety backup of the current state before overwriting anything...'
"$here/backup.sh" "$pre_backup"
services=(web api keycloak)
if test -f "$NEXUS_ROOT/.private/nexus/alexa.env"; then services+=(alexa); fi
if test -f "$NEXUS_ROOT/.private/nexus/telegram.env"; then services+=(telegram); fi
dc stop "${services[@]}"
dc exec -T postgres psql -U commandement -d postgres -v ON_ERROR_STOP=1 -c 'drop database if exists commandement with (force);' -c 'create database commandement owner commandement;'
dc exec -T postgres pg_restore -U commandement -d commandement --no-owner --role=commandement --exit-on-error < "$backup/courses.dump"
dc exec -T keycloak-db psql -U keycloak -d postgres -v ON_ERROR_STOP=1 -c 'drop database if exists keycloak with (force);' -c 'create database keycloak owner keycloak;'
dc exec -T keycloak-db pg_restore -U keycloak -d keycloak --no-owner --role=keycloak --exit-on-error < "$backup/identity.dump"
courses=$(dc exec -T postgres psql -U commandement -d commandement -At -v ON_ERROR_STOP=1 -c "$courses_counts")
ident=$(dc exec -T keycloak-db psql -U keycloak -d keycloak -At -v ON_ERROR_STOP=1 -c "$identity_counts")
[[ "$courses" = "$(cat "$backup/courses.counts")" && "$ident" = "$(cat "$backup/identity.counts")" ]] || {
  echo "Counts differ after restore. Services left stopped; roll back from $pre_backup." >&2; exit 1; }
if [[ "$restore_private" = true ]]; then
  for file in production.env portal-config.json commandement-realm.json alexa.env google-calendar.env google-calendar.json telegram.env telegram-token; do
    if test -f "$backup/$file"; then install -m 600 -- "$backup/$file" "$NEXUS_ROOT/.private/nexus/$file"; fi
  done
fi
dc up -d --wait --wait-timeout 300
echo "Production restored from $name; counts match. Safety backup kept in $pre_backup."
