#!/usr/bin/env bash
# Nightly: local backup (backup.sh), age encryption with the PUBLIC key only, then
# upload of a unique, never-overwritten object with a write-only S3 key.
# Private settings (never in Git): .private/nexus/offsite.env and offsite-s3.env.
# Usage: backup-offsite.sh [--no-upload]
source "$(dirname -- "$0")/common.sh"
upload=true
if [[ "${1:-}" = --no-upload ]]; then upload=false; shift; fi
test "$#" -eq 0 || { echo 'Usage: backup-offsite.sh [--no-upload]' >&2; exit 1; }
OFFSITE_ENV="$NEXUS_ROOT/.private/nexus/offsite.env"
test -f "$OFFSITE_ENV" || { echo 'Missing .private/nexus/offsite.env.' >&2; exit 1; }
# shellcheck source=/dev/null
source "$OFFSITE_ENV"
: "${OFFSITE_AGE_RECIPIENT:?}" "${OFFSITE_WORKDIR:?}"
[[ "$OFFSITE_AGE_RECIPIENT" =~ ^age1[0-9a-z]{58}$ ]] || { echo 'OFFSITE_AGE_RECIPIENT must be an age public key.' >&2; exit 1; }
[[ "$OFFSITE_WORKDIR" = /* ]] || { echo 'OFFSITE_WORKDIR must be absolute.' >&2; exit 1; }
keep_local=${OFFSITE_KEEP_LOCAL:-3}
keep_archives=${OFFSITE_KEEP_ARCHIVES:-7}
if [[ "$upload" = true ]]; then
  : "${OFFSITE_BUCKET:?}" "${OFFSITE_ENDPOINT:?}" "${OFFSITE_PREFIX:=nexus-maison}"
  [[ "${OFFSITE_AWS_IMAGE:-}" =~ @sha256:[a-f0-9]{64}$ ]] || { echo 'OFFSITE_AWS_IMAGE must be pinned by digest.' >&2; exit 1; }
  test -f "$NEXUS_ROOT/.private/nexus/offsite-s3.env" || { echo 'Missing .private/nexus/offsite-s3.env.' >&2; exit 1; }
fi
mkdir -p -m 700 -- "$OFFSITE_WORKDIR" "$OFFSITE_WORKDIR/local" "$OFFSITE_WORKDIR/outbox"
# Maintenance marker: monitor.sh stays silent while services are stopped for the dump.
marker="$OFFSITE_WORKDIR/maintenance"
date +%s > "$marker"
trap 'rm -f -- "$marker"' EXIT
stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="commandement-$stamp-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
local_dir="$OFFSITE_WORKDIR/local/$name"
"$NEXUS_ROOT/deploy/nexus/backup.sh" "$local_dir"
(cd -- "$local_dir" && sha256sum -c --quiet SHA256SUMS)
archive="$OFFSITE_WORKDIR/outbox/$name.tar.age"
# Plaintext never leaves this pipe: tar -> age -> encrypted file.
tar -C "$OFFSITE_WORKDIR/local" -cf - "$name" | age -r "$OFFSITE_AGE_RECIPIENT" -o "$archive.partial"
mv -- "$archive.partial" "$archive"
(cd -- "$OFFSITE_WORKDIR/outbox" && sha256sum "$name.tar.age" > "$name.tar.age.sha256")
if [[ "$upload" = true ]]; then
  s3() {
    docker run --rm --network bridge --read-only --security-opt no-new-privileges:true \
      --env-file "$NEXUS_ROOT/.private/nexus/offsite-s3.env" \
      -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
      -v "$OFFSITE_WORKDIR/outbox:/outbox:ro" "$OFFSITE_AWS_IMAGE" \
      --endpoint-url "$OFFSITE_ENDPOINT" "$@"
  }
  for file in "$name.tar.age" "$name.tar.age.sha256"; do
    key="$OFFSITE_PREFIX/$file"
    # A write-only key cannot see existing objects. With s3:ListBucket granted, refuse a name already present.
    if [[ "${OFFSITE_CHECK:-none}" = list ]]; then
      found=$(s3 s3api list-objects-v2 --bucket "$OFFSITE_BUCKET" --prefix "$key" --query 'length(Contents[])' --output text)
      [[ "$found" = 0 || "$found" = None ]] || { echo "Object already exists, refusing to overwrite: $key" >&2; exit 1; }
    fi
    extra=()
    if [[ "${OFFSITE_IF_NONE_MATCH:-true}" = true ]]; then extra=(--if-none-match '*'); fi
    s3 s3api put-object --bucket "$OFFSITE_BUCKET" --key "$key" --body "/outbox/$file" "${extra[@]}" >/dev/null
  done
  date -u +%Y-%m-%dT%H:%M:%SZ > "$OFFSITE_WORKDIR/last-offsite-success"
  echo "Encrypted archive uploaded: $OFFSITE_PREFIX/$name.tar.age"
else
  echo "Encrypted archive created (not uploaded): $archive"
fi
# Local rotation only (remote deletion is done from Antoine's PC with a separate key).
prune() { # directory pattern keep
  mapfile -t old < <(find "$1" -mindepth 1 -maxdepth 1 -name "$2" -printf '%f\n' | sort | head -n "-$3")
  for entry in "${old[@]}"; do rm -rf -- "${1:?}/$entry"; done
}
prune "$OFFSITE_WORKDIR/local" 'commandement-*' "$keep_local"
prune "$OFFSITE_WORKDIR/outbox" 'commandement-*.tar.age' "$keep_archives"
find "$OFFSITE_WORKDIR/outbox" -name 'commandement-*.tar.age.sha256' -printf '%f\n' | while read -r sum; do
  test -f "$OFFSITE_WORKDIR/outbox/${sum%.sha256}" || rm -f -- "$OFFSITE_WORKDIR/outbox/$sum"
done
