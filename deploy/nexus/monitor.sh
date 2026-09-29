#!/usr/bin/env bash
# Maison services only, run on Nexus every 5 minutes (systemd timer). Alerts Antoine alone
# (TELEGRAM_ALERT_USER) on failure and on recovery, never repeatedly. It does not check
# whether Nexus itself is reachable (the existing external probe does) and never restores.
source "$(dirname -- "$0")/common.sh"
private="$NEXUS_ROOT/.private/nexus"
state_dir="$private/monitor"
mkdir -p -m 700 -- "$state_dir"
envfile_value() { test -f "$1" && grep -m1 "^$2=" "$1" | cut -d= -f2- || true; }

workdir=$(envfile_value "$private/offsite.env" OFFSITE_WORKDIR)
# Nightly backup window: services are stopped on purpose; stay silent up to 45 minutes.
if [[ -n "$workdir" && -f "$workdir/maintenance" ]] && (( $(date +%s) - $(cat "$workdir/maintenance") < 2700 )); then exit 0; fi

services=(postgres keycloak-db keycloak api web)
if test -f "$private/alexa.env"; then services+=(alexa); fi
if test -f "$private/telegram.env"; then services+=(telegram); fi
problems=()
for service in "${services[@]}"; do
  container=$(dc ps -q "$service" 2>/dev/null || true)
  if [[ -z "$container" ]]; then problems+=("$service absent"); continue; fi
  state=$(docker inspect --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo unknown/none)
  [[ "$state" = running/healthy || "$state" = running/none ]] || problems+=("$service $state")
done
if [[ -n "$workdir" ]]; then
  last="$workdir/last-offsite-success"
  if ! test -f "$last" || (( $(date +%s) - $(date -d "$(cat "$last")" +%s) > 26*3600 )); then problems+=('sauvegarde hors site > 26 h'); fi
fi
current=$(printf '%s\n' "${problems[@]}")
previous=$(cat "$state_dir/state" 2>/dev/null || true)
[[ "$current" != "$previous" ]] || { rm -f -- "$state_dir/pending"; exit 0; }
# Debounce: a change must be seen on two consecutive runs (avoids alerts on "starting").
if [[ "$current" != "$(cat "$state_dir/pending" 2>/dev/null || true)" ]]; then printf '%s' "$current" > "$state_dir/pending"; exit 0; fi

user=$(envfile_value "$private/telegram.env" TELEGRAM_ALERT_USER)
[[ "$user" =~ ^[0-9a-fA-F-]{36}$ ]] || { echo 'TELEGRAM_ALERT_USER not configured; state change not sent.' >&2; exit 1; }
# psql interpolates :'u' (safely quoted) only in scripts read from stdin, not with -c.
chat=$(echo "select data->'links'->:'u'->>'chat' from telegram_state limit 1;" |
  dc exec -T postgres psql -U commandement -d commandement -At -v ON_ERROR_STOP=1 -v u="${user,,}" 2>/dev/null || true)
if [[ "$chat" =~ ^-?[0-9]+$ ]]; then echo "$chat" > "$state_dir/alert-chat"; else chat=$(cat "$state_dir/alert-chat" 2>/dev/null || true); fi
[[ "$chat" =~ ^-?[0-9]+$ ]] || { echo 'Alert chat unknown (Telegram not linked or database down, no cache).' >&2; exit 1; }
if ((${#problems[@]})); then
  text="Maison — panne : $(IFS=', '; echo "${problems[*]}")"
elif [[ -n "$previous" ]]; then
  text='Maison — rétabli : tous les services Maison sont sains.'
else
  text=''
fi
if [[ -n "$text" ]]; then
  token=$(cat "$private/telegram-token")
  # Token passed through curl's stdin config, never on the command line.
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" | curl -fsS --max-time 20 --config - \
    --data-urlencode "chat_id=$chat" --data-urlencode "text=$text" -o /dev/null
fi
# Only record the new state once the alert was accepted: no repetition, but a retry if sending failed.
printf '%s' "$current" > "$state_dir/state"
