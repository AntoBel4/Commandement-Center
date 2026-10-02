#!/usr/bin/env bash
# Nightly: local backup (backup.sh), age encryption with the PUBLIC key only, then
# upload with a write-only S3 key to a versioned bucket with default Object Lock.
# Unique names reduce collisions; retention protects versions, not object names.
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
[[ "$keep_local" =~ ^[1-9][0-9]*$ && "$keep_archives" =~ ^[1-9][0-9]*$ ]] || {
  echo 'Local retention counts must be positive integers.' >&2; exit 1; }
if [[ "$upload" = true ]]; then
  : "${OFFSITE_BUCKET:?}" "${OFFSITE_ENDPOINT:?}" "${OFFSITE_PREFIX:=nexus-maison}"
  # The qualified Contabo policy forbids listing; If-None-Match was ignored.
  [[ "${OFFSITE_CHECK:-none}" = none && "${OFFSITE_IF_NONE_MATCH:-false}" = false ]] || {
    echo 'Protected-version uploads require OFFSITE_CHECK=none and OFFSITE_IF_NONE_MATCH=false.' >&2; exit 1; }
  [[ "$OFFSITE_PREFIX" =~ ^[a-zA-Z0-9][a-zA-Z0-9/_-]*$ ]] || {
    echo 'OFFSITE_PREFIX must contain only letters, digits, slash, underscore or hyphen.' >&2; exit 1; }
  [[ "${OFFSITE_AWS_IMAGE:-}" =~ @sha256:[a-f0-9]{64}$ ]] || { echo 'OFFSITE_AWS_IMAGE must be pinned by digest.' >&2; exit 1; }
  test -f "$NEXUS_ROOT/.private/nexus/offsite-s3.env" || { echo 'Missing .private/nexus/offsite-s3.env.' >&2; exit 1; }
  command -v openssl >/dev/null || { echo 'OpenSSL is required for Object Lock Content-MD5.' >&2; exit 1; }
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
      -e AWS_PAGER= \
      -v "$OFFSITE_WORKDIR/outbox:/outbox:ro" "$OFFSITE_AWS_IMAGE" \
      --endpoint-url "$OFFSITE_ENDPOINT" "$@"
  }
  receipt="$archive.versions.tsv"
  # Keep partial receipts on failure: an accepted object may already exist remotely.
  printf 'key\tversion_id\n' > "$receipt.partial"
  for file in "$name.tar.age" "$name.tar.age.sha256"; do
    key="$OFFSITE_PREFIX/$file"
    # Base64 of the binary MD5, not of its hexadecimal representation. Required
    # for uploads into an Object Lock bucket, including the SHA-256 sidecar.
    content_md5=$(openssl dgst -md5 -binary "$OFFSITE_WORKDIR/outbox/$file" | openssl base64 -A)
    version=$(s3 s3api put-object --bucket "$OFFSITE_BUCKET" --key "$key" \
      --body "/outbox/$file" --content-md5 "$content_md5" --query VersionId --output text)
    [[ "$version" =~ ^[A-Za-z0-9._~+/=-]+$ && "$version" != None && "$version" != null ]] || {
      echo "Upload returned no usable VersionId for $key; off-site success not recorded." >&2; exit 1; }
    printf '%s\t%s\n' "$key" "$version" >> "$receipt.partial"
  done
  mv -- "$receipt.partial" "$receipt"
  # Neither an upload failure nor an incomplete receipt advances the monitor marker.
  date -u +%Y-%m-%dT%H:%M:%SZ > "$OFFSITE_WORKDIR/last-offsite-success.partial"
  mv -- "$OFFSITE_WORKDIR/last-offsite-success.partial" "$OFFSITE_WORKDIR/last-offsite-success"
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
for suffix in .sha256 .versions.tsv .versions.tsv.partial; do
  while IFS= read -r sidecar; do
    test -f "$OFFSITE_WORKDIR/outbox/${sidecar%"$suffix"}" || rm -f -- "$OFFSITE_WORKDIR/outbox/$sidecar"
  done < <(find "$OFFSITE_WORKDIR/outbox" -maxdepth 1 -name "commandement-*.tar.age$suffix" -printf '%f\n')
done
