# shellcheck shell=bash
# Helpers shared by provision.sh and the sefid-* scripts (deploy/vps). Sourced, never run.
# Installed as /usr/local/lib/sefid/common.sh; the scripts find it at ../lib/sefid next to
# themselves, so they also run from the repository (vps.test.ts).

# Overridable only so that vps.test.ts can run the scripts in a temporary folder.
: "${SEFID_ROOT:=/srv/sefid}"
: "${SEFID_ETC:=/etc/sefid}"
: "${SEFID_BACKUPS:=/var/backups/sefid}"
# The restore drill's folder: not under /tmp or /var/tmp, which the scratch app's PrivateTmp hides.
: "${SEFID_SCRATCH:=/var/lib}"
# Touched by sefid-cron.service after every successful tick (sefid-status --check).
: "${SEFID_CRON_OK:=/run/sefid-cron.ok}"

# set -e stops a script without a word: name the failing line and command (provision.sh adds
# more). Under set -E a failure inside $(...) prints this line twice.
trap 'echo "ERROR: ${0##*/} line $LINENO: \"$BASH_COMMAND\" failed with exit code $?" >&2' ERR

die() {
  echo "ERROR: $*" >&2
  exit 1
}

say() { printf '==> %s\n' "$*"; }

need_root() {
  if [ "$(id -u)" -ne 0 ] && [ "$SEFID_ROOT" = /srv/sefid ]; then
    die "run it as root: sudo $(basename "$0") $*"
  fi
}

# env_get FILE NAME: the value of NAME= in FILE (the last line wins); empty when missing.
env_get() {
  if [ -f "$1" ]; then sed -n "s/^$2=//p" "$1" | tail -n 1; fi
}

# The loopback origin of the app. provision.sh writes it from what "localhost" resolves to.
app_origin() {
  local origin
  origin=$(env_get "$SEFID_ETC/host.env" SEFID_ORIGIN)
  [ -n "$origin" ] || die "$SEFID_ETC/host.env has no SEFID_ORIGIN: run the provision action first"
  printf '%s\n' "$origin"
}

# json_field NAME: one top-level field of the JSON on stdin; empty when it is not JSON.
json_field() {
  python3 -I -c '
import json, sys
try:
    value = json.load(sys.stdin).get(sys.argv[1], "")
except Exception:
    value = ""
print(str(value).lower() if isinstance(value, bool) else value)' "$1"
}

# wait_healthy SHA SECONDS: poll GET /api/health on loopback until it answers 200 with
# "version" = SHA. Prints the last answer; returns 1 after SECONDS without one.
wait_healthy() {
  local want=$1 limit=$2 origin out code body
  local deadline=$((SECONDS + limit))
  # Callers test this function in "if", where set -e is off: return explicitly.
  origin=$(app_origin) || return 1
  while :; do
    out=$(curl -sS --max-time 5 -w '\n%{http_code}' "$origin/api/health" 2>&1) || true
    code=${out##*$'\n'}
    body=${out%$'\n'*}
    if [ "$code" = 200 ] && [ "$(printf '%s' "$body" | json_field version)" = "$want" ]; then
      printf '%s\n' "$body"
      return 0
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "ERROR: /api/health gave no 200 with version $want within $limit s." >&2
      echo "Last answer (HTTP ${code:-none}): ${body:-none}" >&2
      return 1
    fi
    sleep 2
  done
}

# link_tls CERT_NAME: point nginx at the Let's Encrypt certificate CERT_NAME, or at the
# snakeoil certificate while that does not exist yet.
link_tls() {
  local live=/etc/letsencrypt/live/$1 crt key
  if [ -f "$live/fullchain.pem" ]; then
    crt=$live/fullchain.pem key=$live/privkey.pem
  else
    crt=/etc/ssl/certs/ssl-cert-snakeoil.pem key=/etc/ssl/private/ssl-cert-snakeoil.key
  fi
  install -d -m 0750 "$SEFID_ETC/tls"
  ln -sfn "$crt" "$SEFID_ETC/tls/fullchain.pem"
  ln -sfn "$key" "$SEFID_ETC/tls/privkey.pem"
}

# newest KIND PATTERN: "<epoch> <path>" of the newest finished file under $SEFID_BACKUPS/KIND
# whose name matches PATTERN; empty when there is none.
newest() {
  find "$SEFID_BACKUPS/$1" -maxdepth 1 -type f -name "$2" -printf '%T@ %p\n' 2>/dev/null |
    sort -n | tail -n 1 | sed 's/^\([0-9]*\)[.0-9]* /\1 /'
}
