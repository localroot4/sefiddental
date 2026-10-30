#!/usr/bin/env bash
# The checks of the workflow "Watch" (.github/workflows/watch.yml, docs/deploy.md 3.6): prints
# one "FAIL <what>: <why>" line per failed check, nothing when every check passed.
#
#   watch-check.sh    env: SITE_URL, SSH_USER, SERVER_HOST, KEY (1 when the agent holds the
#                     deploy key), FORCE_FAILURE (true adds one failure), GITHUB_RUN_ID
#
# 1. GET $SITE_URL/api/health from GitHub, so also from outside Iran.
# 2. `sudo sefid-status --check` over SSH. A server whose sefid-status has no --check yet runs
#    the full status, which can exit 0 without an "ok: " line: that is a failure too.
set -Eeuo pipefail
cd "$(dirname "$0")"
err=$(mktemp)
trap 'rm -f "$err"' EXIT

code=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code}' "$SITE_URL/api/health" 2>"$err") || true
[ "$code" = 200 ] || echo "FAIL public: $SITE_URL/api/health answered HTTP ${code:-none} from GitHub $(head -c 200 "$err")"

if [ "${KEY-}" != 1 ]; then
  echo "FAIL ssh: the secret SERVER_SSH_KEY is empty or not a private key without a passphrase"
else
  rc=0
  out=$(ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=known_hosts \
    -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes -o ConnectTimeout=20 \
    "$SSH_USER@$SERVER_HOST" 'sudo sefid-status --check' 2>&1) || rc=$?
  if [ "$rc" = 255 ]; then
    echo "FAIL ssh: no connection to $SERVER_HOST: $(tail -n 1 <<<"$out")"
  elif [ "$rc" != 0 ]; then
    grep '^FAIL ' <<<"$out" || echo "FAIL server: sefid-status --check exited $rc: $(tail -n 1 <<<"$out")"
  elif ! grep -q '^ok: ' <<<"$out"; then
    echo "FAIL server: sefid-status --check printed no ok line (run provision)"
  fi
fi

# The run id in letters: each forced run differs from the last report, although the incident
# signature ignores digits (watch-incident.sh).
if [ "${FORCE_FAILURE-}" = true ]; then
  echo "FAIL forced: the input force_failure (run $(tr 0-9 A-J <<<"${GITHUB_RUN_ID-0}"))"
fi
