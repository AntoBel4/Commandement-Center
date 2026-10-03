#!/usr/bin/env bash
# Preferred input: a tar stream decrypted on the PC. The private key never reaches
# Nexus. The independently computed tar SHA-256 is mandatory and checked before
# extraction or Docker. Temporary plaintext is removed on exit/error/interruption.
# The legacy encrypted-file/identity-stdin input remains for compatibility only;
# do NOT use it where the private key must stay off the server.
#
#   Rehearsal (isolated Compose project, no port, no proxy, no production volume):
#     restore-service.sh --rehearse [--with-services] --decrypted-stdin \
#       --tar-sha256 HEX commandement-TIMESTAMP-SUFFIX < decrypted.tar
#   Production (MANUAL ONLY, never from monitor.sh or a timer):
#     restore-service.sh --production --confirm <archive-name> --pre-backup /abs/new-dir \
#       [--restore-private] --decrypted-stdin --tar-sha256 HEX NAME < decrypted.tar
set -Eeuo pipefail
umask 077
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mode='' with_services=false confirm='' pre_backup='' restore_private=false
decrypted_stdin=false tar_sha256='' identity=''
while (($#)); do
  case $1 in
    --rehearse) mode=rehearse;;
    --production) mode=production;;
    --with-services) with_services=true;;
    --restore-private) restore_private=true;;
    --decrypted-stdin) decrypted_stdin=true;;
    --tar-sha256) tar_sha256=${2:?}; shift;;
    --confirm) confirm=${2:?}; shift;;
    --pre-backup) pre_backup=${2:?}; shift;;
    -*) echo "Unknown option $1" >&2; exit 1;;
    *) break;;
  esac
  shift
done
test "$#" -eq 1 && [[ -n "$mode" ]] || {
  echo 'Usage: restore-service.sh --rehearse [--with-services] | --production --confirm NAME --pre-backup DIR [--restore-private] --decrypted-stdin --tar-sha256 HEX NAME < decrypted.tar' >&2; exit 1; }
if [[ "$decrypted_stdin" = true ]]; then
  name=$1
  [[ "$tar_sha256" =~ ^[a-fA-F0-9]{64}$ ]] || { echo 'A PC-computed tar SHA-256 is required.' >&2; exit 1; }
else
  [[ -z "$tar_sha256" && "$1" = /*.tar.age && -f "$1" ]] || { echo 'Provide an encrypted archive or use --decrypted-stdin.' >&2; exit 1; }
  archive=$1
  name=$(basename -- "$archive" .tar.age)
fi
[[ "$name" =~ ^commandement-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$ ]] || { echo 'Unexpected archive name.' >&2; exit 1; }
if [[ "$mode" = production ]]; then
  [[ "$confirm" = "$name" ]] || { echo "Production restore requires --confirm $name" >&2; exit 1; }
  [[ "$pre_backup" = /* ]] || { echo 'Production restore requires --pre-backup /absolute/new-directory' >&2; exit 1; }
fi
test ! -t 0 || { echo 'Provide the requested input on standard input.' >&2; exit 1; }

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
trap 'exit 129' HUP
work=$(mktemp -d "${TMPDIR:-/tmp}/commandement-restore.XXXXXX")

if [[ "$decrypted_stdin" = true ]]; then
  cat > "$work/payload.tar"
  (cd -- "$work" && printf '%s  payload.tar\n' "$tar_sha256" | sha256sum -c --quiet)
  echo 'PC-decrypted tar received; complete stream SHA-256 verified.'
else
  identity=$(cat)
  [[ "$identity" == *AGE-SECRET-KEY-1* ]] || { echo 'Standard input is not an age identity.' >&2; exit 1; }
  if test -f "$archive.sha256"; then (cd -- "$(dirname -- "$archive")" && sha256sum -c --quiet "$name.tar.age.sha256"); fi
  age -d -i <(printf '%s\n' "$identity") "$archive" > "$work/payload.tar"
  identity=''
fi
# backup.sh creates only regular files in one flat, named directory. Refuse
# traversal, absolute paths, extra roots, symlinks and hardlinks before extraction.
tar -tf "$work/payload.tar" > "$work/entries"
while IFS= read -r entry; do
  [[ "$entry" = "$name/" || "$entry" =~ ^$name/[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || {
    echo 'Unsafe or unexpected archive path.' >&2; exit 1; }
done < "$work/entries"
tar -tvf "$work/payload.tar" > "$work/types"
while IFS= read -r entry; do
  [[ "${entry:0:1}" = '-' || "${entry:0:1}" = d ]] || { echo 'Archive links and special files are not allowed.' >&2; exit 1; }
done < "$work/types"
tar -C "$work" --no-same-owner --no-same-permissions -xf "$work/payload.tar"
backup="$work/$name"
test -d "$backup" || { echo 'Archive layout unexpected.' >&2; exit 1; }
while IFS= read -r line; do
  [[ "$line" =~ ^[a-fA-F0-9]{64}\ [\ *][a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo 'Unsafe checksum manifest.' >&2; exit 1; }
done < "$backup/SHA256SUMS"
(cd -- "$backup" && sha256sum -c --quiet SHA256SUMS)
echo "Archive contents and SHA256SUMS verified: $name"

envvalue() { grep -m1 "^$1=" "$backup/${2:-production.env}" | cut -d= -f2-; }
courses_counts='select (select count(*) from families), (select count(*) from family_members), (select count(*) from grocery_items), (select count(*) from grocery_history), (select count(*) from grocery_requests);'
identity_counts='select (select count(*) from realm), (select count(*) from user_entity), (select count(*) from credential);'

if [[ "$mode" = rehearse ]]; then
  # Match common.sh overlay order without sourcing private files or importing
  # Google/Telegram settings into the isolated services.
  api_release=$(envvalue RELEASE)
  if test -f "$backup/google-calendar.env"; then api_release=$(envvalue GOOGLE_RELEASE google-calendar.env); fi
  if test -f "$backup/telegram.env"; then api_release=$(envvalue TELEGRAM_RELEASE telegram.env); fi
  [[ "$api_release" =~ ^[a-f0-9]{7,40}$ ]] || { echo 'Invalid effective API release in backup.' >&2; exit 1; }
  echo "Rehearsal API image: commandement-api:$api_release"
  suffix=${work##*.}
  project="commandement-rehearsal-$(date +%s)-${suffix,,}"
  {
    printf 'REHEARSAL_PROJECT=%s\n' "$project"
    for key in POSTGRES_IMAGE POSTGRES_PASSWORD KEYCLOAK_DB_PASSWORD KEYCLOAK_IMAGE PORTAL_HOST DATABASE_URL; do
      printf '%s=%s\n' "$key" "$(envvalue "$key")"
    done
    printf 'RELEASE=%s\n' "$api_release"
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
