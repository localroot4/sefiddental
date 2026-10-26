#!/usr/bin/env bash
# Provision the production server (docs/deploy.md section 3). Run as root from the uploaded
# deploy/vps folder:
#
#   sudo bash provision.sh                     the server
#   sudo env SEFID_SMOKE=1 bash provision.sh   a CI runner: skips sshd, ufw, fail2ban, the
#                                              hostname, the swap file and the reboot settings
#
# Idempotent: safe to run any number of times. It never deletes data and never prints a secret.
# It reads ./server.env (committed, no secrets) and ends with a report.
set -Eeuo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
FILES=$HERE/files
# shellcheck source=SCRIPTDIR/files/usr/local/lib/sefid/common.sh
. "$FILES/usr/local/lib/sefid/common.sh"

SMOKE=${SEFID_SMOKE:-0}
PORT=3000
SECRET_NAMES=(PAYLOAD_SECRET CRON_SECRET INTERNAL_API_TOKEN IP_HASH_SECRET FORM_TOKEN_SECRET)
APT=(apt-get -q -y -o DPkg::Lock::Timeout=600 -o Dpkg::Options::=--force-confdef
  -o Dpkg::Options::=--force-confold)
CHANGED=0

# --- helpers (vps.test.ts sources this file and calls the pure ones) ---

# load_config FILE: source server.env and check every value provision writes somewhere.
load_config() {
  # shellcheck source=SCRIPTDIR/server.env
  . "$1"
  local host d
  [[ ${SERVER_HOSTNAME:-} =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || die "server.env: SERVER_HOSTNAME is not a host name"
  [[ ${SERVER_HOST:-} =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "server.env: SERVER_HOST must be the IPv4 address"
  [[ ${SITE_URL:-} =~ ^https://([a-z0-9.-]+)$ ]] || die "server.env: SITE_URL must be https://<host> with no path or slash"
  host=${BASH_REMATCH[1]}
  [ -n "${DOMAINS:-}" ] || die "server.env: DOMAINS is empty"
  for d in $DOMAINS; do
    [[ $d =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] || die "server.env: DOMAINS has an invalid name: $d"
  done
  [ "${DOMAINS%% *}" = "$host" ] || die "server.env: the first name in DOMAINS must be the SITE_URL host $host"
  [[ ${ALLOW_INDEXING:-} =~ ^(true|false)$ ]] || die "server.env: ALLOW_INDEXING must be true or false"
  [[ -z ${LE_EMAIL:-} || $LE_EMAIL =~ ^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$ ]] || die "server.env: LE_EMAIL is not an e-mail address"
  [[ ${NODE_OPTIONS:-} =~ ^[A-Za-z0-9=_.-]+(\ [A-Za-z0-9=_.-]+)*$ ]] || die "server.env: NODE_OPTIONS has characters app.env cannot hold"
}

# loopback ADDRESS: the three loopback settings for the address "localhost" resolves to first
# (Node binds HOSTNAME=localhost there; docs/deploy.md 2.3): SEFID_ORIGIN for curl, the
# INTERNAL_ORIGIN of the app and the nginx upstream.
loopback() {
  case $1 in
    127.*) printf '%s\n' "http://$1:$PORT" "http://$1:$PORT" "$1:$PORT" ;;
    ::1) printf '%s\n' "http://[::1]:$PORT" "http://localhost:$PORT" "[::1]:$PORT" ;;
    *) die "\"localhost\" resolves to $1, not to a loopback address: fix /etc/hosts" ;;
  esac
}

# The first address of "localhost", resolved the way Node resolves a listen host.
localhost_address() {
  python3 -I -c 'import socket; print(socket.getaddrinfo("localhost", None, 0, socket.SOCK_STREAM)[0][4][0])'
}

# render_app_env OLD INTERNAL_ORIGIN: the new /etc/sefid/app.env on stdout. The names above the
# blank line come from server.env on every run; the secrets, MAINTENANCE_MODE and every other
# line of OLD are kept; a missing secret is generated once.
render_app_env() {
  local old=$1 name value known
  local managed=(
    "SITE_URL=$SITE_URL" "ALLOW_INDEXING=$ALLOW_INDEXING" MEDIA_DIR=/var/lib/sefid/media
    DB_PUSH=false TRUST_PROXY_HEADERS=true TRUSTED_PROXY_HOPS=1 "NODE_OPTIONS=$NODE_OPTIONS"
    NEXT_TELEMETRY_DISABLED=1 TZ=UTC LOG_LEVEL=info "PORT=$PORT" HOSTNAME=localhost
    "INTERNAL_ORIGIN=$2"
  )
  echo "# Written by deploy/vps/provision.sh. The names above the blank line are rewritten from"
  echo "# server.env on every provision; the rest is kept. Secrets: never print this file."
  printf '%s\n' "${managed[@]}"
  echo
  for name in "${SECRET_NAMES[@]}"; do
    value=$(env_get "$old" "$name")
    printf '%s=%s\n' "$name" "${value:-$(openssl rand -base64 48)}"
  done
  # Hex: the password needs no URL encoding.
  value=$(env_get "$old" DATABASE_URL)
  printf 'DATABASE_URL=%s\n' "${value:-postgres://sefid:$(openssl rand -hex 32)@127.0.0.1:5432/sefid}"
  value=$(env_get "$old" MAINTENANCE_MODE)
  printf 'MAINTENANCE_MODE=%s\n' "${value:-off}"
  # Lines added by hand (SMTP_*, TELEGRAM_BOT_TOKEN, ...) stay as they are.
  known=$(printf '%s|' "${managed[@]%%=*}" "${SECRET_NAMES[@]}" DATABASE_URL MAINTENANCE_MODE)
  if [ -f "$old" ]; then grep -Ev "^(#|$|(${known%|})=)" "$old" || true; fi
}

# render_site TEMPLATE NGINX_VERSION IPV6(yes|no) UPSTREAM: the nginx site on stdout.
render_site() {
  local h2=" http2" h2on="# HTTP/2: on the listen lines (nginx before 1.25.1)"
  if dpkg --compare-versions "$2" ge 1.25.1; then h2="" h2on="http2 on;"; fi
  sed -e "s|@SERVER_NAMES@|$DOMAINS|g" -e "s|@SITE_URL@|$SITE_URL|g" -e "s|@UPSTREAM@|$4|g" \
    -e "s|@H2@|$h2|g" -e "s|@H2ON@|$h2on|g" "$1" |
    if [ "$3" = yes ]; then cat; else sed '/# ipv6$/d'; fi
}

# put SRC DEST MODE [OWNER:GROUP]: install SRC when DEST differs; sets CHANGED=1 then.
put() {
  if [ -f "$2" ] && cmp -s "$1" "$2"; then return 0; fi
  local owner=${4:-root:root}
  install -D -m "$3" -o "${owner%%:*}" -g "${owner##*:}" "$1" "$2"
  say "updated $2"
  CHANGED=1
}

# --- steps ---

install_packages() {
  say "packages"
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
  # A run killed inside dpkg leaves it half-configured, and apt then refuses every command.
  # dpkg has no lock timeout: while unattended-upgrades holds the lock, wait and look again.
  local i
  for i in $(seq 60); do
    [ -n "$(dpkg --audit || true)" ] || break
    dpkg --force-confdef --force-confold --configure -a && break
    [ "$i" -lt 60 ] || die "dpkg --configure -a failed for 10 minutes (output above)"
    sleep 10
  done
  apt-get -q -o DPkg::Lock::Timeout=600 update
  if ! "${APT[@]}" full-upgrade; then
    dpkg --audit >&2 || true
    die "apt-get full-upgrade failed (dpkg --audit above). Repair it with the action run: \"sudo dpkg --configure -a\", or hold the failing package: \"sudo apt-mark hold <package>\". Then run provision again."
  fi
  local pkgs=(nginx ssl-cert certbot postgresql ufw unattended-upgrades needrestart curl
    ca-certificates openssl python3 bind9-dnsutils)
  [ "$SMOKE" = 1 ] || pkgs+=(fail2ban python3-systemd)
  "${APT[@]}" install "${pkgs[@]}"
  python3 -I -c 'import tarfile; tarfile.data_filter' 2>/dev/null ||
    die "python3 is older than 3.12 (no tarfile data filter): sefid-release cannot check tarballs"
}

setup_os() {
  say "operating system"
  timedatectl set-timezone UTC
  CHANGED=0
  put "$FILES/etc/systemd/journald.conf.d/90-sefid.conf" /etc/systemd/journald.conf.d/90-sefid.conf 0644
  if [ "$CHANGED" = 1 ]; then systemctl restart systemd-journald; fi
  CHANGED=0
  put "$FILES/etc/sysctl.d/90-sefid.conf" /etc/sysctl.d/90-sefid.conf 0644
  if [ "$CHANGED" = 1 ]; then sysctl -q -e -p /etc/sysctl.d/90-sefid.conf; fi
  put "$FILES/etc/apt/apt.conf.d/52sefid-unattended-upgrades" /etc/apt/apt.conf.d/52sefid-unattended-upgrades 0644
  put "$FILES/etc/needrestart/conf.d/90-sefid.conf" /etc/needrestart/conf.d/90-sefid.conf 0644
  # chrony is the default from 26.04 on, systemd-timesyncd before; keep whichever runs.
  if ! systemctl is-active --quiet chrony && ! systemctl is-active --quiet systemd-timesyncd; then
    "${APT[@]}" install chrony
    systemctl enable --now chrony
  fi
  if [ -d /etc/chrony/sources.d ]; then
    CHANGED=0
    put "$FILES/etc/chrony/sources.d/sefid.sources" /etc/chrony/sources.d/sefid.sources 0644
    if [ "$CHANGED" = 1 ] && systemctl is-active --quiet chrony; then chronyc reload sources >/dev/null; fi
  fi
  [ "$SMOKE" = 1 ] && return 0

  put "$FILES/etc/apt/apt.conf.d/53sefid-auto-reboot" /etc/apt/apt.conf.d/53sefid-auto-reboot 0644
  CHANGED=0
  put "$FILES/etc/systemd/system/apt-daily-upgrade.timer.d/90-sefid.conf" \
    /etc/systemd/system/apt-daily-upgrade.timer.d/90-sefid.conf 0644
  if [ "$CHANGED" = 1 ]; then
    systemctl daemon-reload
    systemctl restart apt-daily-upgrade.timer
  fi
  # Not on the runner: a missed daily run would start at once and hold the dpkg lock.
  systemctl enable --now apt-daily.timer apt-daily-upgrade.timer >/dev/null
  if [ "$(hostname)" != "$SERVER_HOSTNAME" ]; then hostnamectl set-hostname "$SERVER_HOSTNAME"; fi
  grep -qE "^127\.0\.1\.1[[:space:]]+$SERVER_HOSTNAME\$" /etc/hosts ||
    printf '127.0.1.1 %s\n' "$SERVER_HOSTNAME" >>/etc/hosts
  if [ -d /etc/cloud/cloud.cfg.d ]; then
    put "$FILES/etc/cloud/cloud.cfg.d/99-sefid.cfg" /etc/cloud/cloud.cfg.d/99-sefid.cfg 0644
  fi
  # A 2 GB swap file, unless the machine already has swap.
  if [ -z "$(swapon --show=NAME --noheadings)" ]; then
    if [ ! -f /swapfile ]; then
      fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 0600 /swapfile
      mkswap /swapfile >/dev/null
    fi
    swapon /swapfile
  fi
  if [ -f /swapfile ] && ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >>/etc/fstab
  fi
  if [ -f /run/reboot-required ]; then
    shutdown -r 23:45 "sefid: reboot required by package updates" || true
    say "a reboot is required: scheduled for 23:45 UTC"
  fi
}

setup_layout() {
  say "users and folders"
  id sefid >/dev/null 2>&1 ||
    useradd --system --user-group --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin sefid
  install -d -m 0750 -o root -g sefid "$SEFID_ETC"
  install -d -m 0755 "$SEFID_ROOT" "$SEFID_ROOT/releases" /var/lib/sefid /var/www/letsencrypt
  install -d -m 0750 -o sefid -g sefid /var/lib/sefid/media
  install -d -m 0700 /var/backups/sefid /var/backups/sefid/db /var/backups/sefid/media
  install -m 0644 "$HERE/server.env" "$SEFID_ETC/server.env"
  local f
  for f in "$FILES"/usr/local/sbin/sefid-*; do put "$f" "/usr/local/sbin/${f##*/}" 0755; done
  put "$FILES/usr/local/lib/sefid/common.sh" /usr/local/lib/sefid/common.sh 0644
}

APP_ENV_CHANGED=0
setup_app_env() {
  say "app environment (values are never shown)"
  local address loop new cron
  address=$(localhost_address)
  mapfile -t loop < <(loopback "$address")
  [ "${#loop[@]}" = 3 ] || die "\"localhost\" resolves to \"$address\", not to a loopback address: fix /etc/hosts"
  printf 'SEFID_ORIGIN=%s\n' "${loop[0]}" >"$SEFID_ETC/host.env.new"
  CHANGED=0
  put "$SEFID_ETC/host.env.new" "$SEFID_ETC/host.env" 0644
  rm -f "$SEFID_ETC/host.env.new"
  UPSTREAM=${loop[2]}
  say "localhost is $address: app origin ${loop[0]}, INTERNAL_ORIGIN ${loop[1]}"

  new=$(mktemp "$SEFID_ETC/.app.env.XXXXXX")
  render_app_env "$SEFID_ETC/app.env" "${loop[1]}" >"$new"
  if ! cmp -s "$new" "$SEFID_ETC/app.env"; then
    install -m 0640 -o root -g sefid "$new" "$SEFID_ETC/app.env"
    APP_ENV_CHANGED=1
    say "updated $SEFID_ETC/app.env"
  fi
  rm -f "$new"
  # docs/deploy.md 2.8: the bearer in a file, so it stays out of unit files and ps.
  cron=$(mktemp "$SEFID_ETC/.cron.XXXXXX")
  printf 'Authorization: Bearer %s\n' "$(env_get "$SEFID_ETC/app.env" CRON_SECRET)" >"$cron"
  put "$cron" "$SEFID_ETC/cron-auth.header" 0400 sefid:sefid
  rm -f "$cron"
}

setup_postgres() {
  say "PostgreSQL"
  local version dir password
  version=$(pg_lsclusters --no-header | awk '$2 == "main" {print $1}' | sort -V | tail -n 1)
  if [ -z "$version" ]; then
    version=$(find /usr/lib/postgresql -mindepth 1 -maxdepth 1 -printf '%f\n' | sort -V | tail -n 1)
    pg_createcluster "$version" main
  fi
  dir=/etc/postgresql/$version/main
  CHANGED=0
  put "$FILES/etc/postgresql/conf.d/90-sefid.conf" "$dir/conf.d/90-sefid.conf" 0644 postgres:postgres
  put "$FILES/etc/postgresql/pg_hba.conf" "$dir/pg_hba.conf" 0640 postgres:postgres
  systemctl enable --now postgresql >/dev/null
  if [ "$CHANGED" = 1 ]; then systemctl restart "postgresql@$version-main"; fi
  systemctl start "postgresql@$version-main"
  local i
  for i in $(seq 30); do
    if pg_isready -q -h /var/run/postgresql; then break; fi
    [ "$i" -lt 30 ] || die "PostgreSQL $version did not start"
    sleep 1
  done
  password=$(sed -n 's|^DATABASE_URL=postgres://sefid:\([0-9a-f]\{64\}\)@127\.0\.0\.1:5432/sefid$|\1|p' "$SEFID_ETC/app.env")
  [ -n "$password" ] || die "DATABASE_URL in $SEFID_ETC/app.env is not postgres://sefid:<hex>@127.0.0.1:5432/sefid"
  # The password goes through stdin, never through the process list.
  runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -d postgres >/dev/null <<SQL
SELECT 'CREATE ROLE sefid LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sefid')\gexec
ALTER ROLE sefid WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '$password';
SELECT 'CREATE DATABASE sefid OWNER sefid' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sefid')\gexec
SQL
  say "PostgreSQL $version: role and database sefid ready"
}

setup_units() {
  say "systemd units"
  local u
  CHANGED=0
  for u in sefid.service sefid-cron.service sefid-cron.timer sefid-backup.service sefid-backup.timer; do
    put "$FILES/etc/systemd/system/$u" "/etc/systemd/system/$u" 0644
  done
  if [ "$CHANGED" = 1 ]; then systemctl daemon-reload; fi
  systemctl enable sefid.service >/dev/null
  systemctl enable --now sefid-cron.timer sefid-backup.timer >/dev/null
  if [ "$CHANGED" = 1 ] || [ "$APP_ENV_CHANGED" = 1 ]; then restart_app; fi
}

# A changed unit or app.env takes effect only after a restart of a running release.
restart_app() {
  local sha
  sha=$(env_get "$SEFID_ROOT/current/release.env" GIT_SHA)
  [ -n "$sha" ] || return 0
  say "restarting sefid.service for the new settings"
  systemctl restart sefid.service || true
  if ! wait_healthy "$sha" 180; then
    journalctl -u sefid.service -n 80 --no-pager -o short-iso >&2 || true
    die "the app is not healthy after the restart (last 80 journal lines above)"
  fi
}

setup_nginx() {
  say "nginx"
  local site=/etc/nginx/sites-available/sefid version ipv6=no rendered backup f
  local conf=(/etc/nginx/snippets/sefid-tls.conf /etc/nginx/snippets/sefid-headers.conf "$site")
  [ -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] || make-ssl-cert generate-default-snakeoil
  link_tls "${DOMAINS%% *}"
  version=$(nginx -v 2>&1 | sed -n 's|^nginx version: nginx/\([0-9.]*\).*|\1|p')
  [ -e /proc/net/if_inet6 ] && ipv6=yes
  rendered=$(mktemp)
  render_site "$FILES/etc/nginx/sites-available/sefid.template" "$version" "$ipv6" "$UPSTREAM" >"$rendered"
  # Every file nginx -t reads from here on, so a rejected change can be undone as a whole.
  backup=$(mktemp -d)
  for f in "${conf[@]}"; do
    if [ -f "$f" ]; then cp -p "$f" "$backup/${f##*/}"; fi
  done
  CHANGED=0
  put "$FILES/etc/nginx/snippets/sefid-tls.conf" /etc/nginx/snippets/sefid-tls.conf 0644
  put "$FILES/etc/nginx/snippets/sefid-headers.conf" /etc/nginx/snippets/sefid-headers.conf 0644
  put "$rendered" "$site" 0644
  rm -f "$rendered"
  put "$FILES/etc/letsencrypt/renewal-hooks/deploy/sefid-nginx-reload" \
    /etc/letsencrypt/renewal-hooks/deploy/sefid-nginx-reload 0755
  ln -sfn ../sites-available/sefid /etc/nginx/sites-enabled/sefid
  # The packaged default site also claims default_server on port 80.
  rm -f /etc/nginx/sites-enabled/default
  if ! nginx -t; then
    for f in "${conf[@]}"; do
      if [ -f "$backup/${f##*/}" ]; then cp -p "$backup/${f##*/}" "$f"; else rm -f "$f"; fi
    done
    if [ ! -f "$site" ]; then rm -f /etc/nginx/sites-enabled/sefid; fi
    die "nginx -t failed: ${conf[*]} are back as they were; nginx still runs the old configuration"
  fi
  rm -rf "$backup"
  systemctl enable nginx >/dev/null
  if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi
  systemctl enable --now certbot.timer >/dev/null 2>&1 || say "certbot.timer not found: check renewal"
}

setup_firewall() {
  say "firewall (ufw)"
  local port
  port=$(sshd -T | awk '$1 == "port" {print $2}' | head -n 1)
  [ "$port" = 22 ] || die "sshd listens on port $port, not 22: refusing to enable ufw with limit 22/tcp"
  sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw limit 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null

  say "fail2ban"
  CHANGED=0
  put "$FILES/etc/fail2ban/jail.d/sefid.local" /etc/fail2ban/jail.d/sefid.local 0644
  put "$FILES/etc/fail2ban/filter.d/sshd.local" /etc/fail2ban/filter.d/sshd.local 0644
  systemctl enable fail2ban >/dev/null
  if [ "$CHANGED" = 1 ]; then systemctl restart fail2ban; else systemctl start fail2ban; fi
}

SSHD_WANT="passwordauthentication no
kbdinteractiveauthentication no
permitrootlogin no
allowusers deploy
authenticationmethods publickey
maxauthtries 3
logingracetime 20
x11forwarding no
allowagentforwarding no
allowtcpforwarding local
permitopen 127.0.0.1:5432
clientaliveinterval 300"

setup_sshd() {
  say "sshd"
  local dropin=/etc/ssh/sshd_config.d/10-sefid.conf backup="" effective line
  # The only way in after this step is the deploy key: make sure it is there.
  grep -qE '^(ssh-ed25519|ecdsa-sha2-|sk-|ssh-rsa) ' /home/deploy/.ssh/authorized_keys 2>/dev/null ||
    die "refusing to turn off password login: /home/deploy/.ssh/authorized_keys holds no key"
  if [ -f "$dropin" ]; then
    backup=$(mktemp)
    cp "$dropin" "$backup"
  fi
  install -d -m 0755 /run/sshd
  CHANGED=0
  put "$FILES/etc/ssh/sshd_config.d/10-sefid.conf" "$dropin" 0644
  if ! sshd -t; then
    if [ -n "$backup" ]; then cp "$backup" "$dropin"; else rm -f "$dropin"; fi
    die "sshd -t failed with the new drop-in: the old one is back"
  fi
  rm -f "$backup"
  effective=$(sshd -T)
  while read -r line; do
    grep -qxF "$line" <<<"$effective" ||
      die "sshd: effective value is not \"$line\" but \"$(grep "^${line%% *} " <<<"$effective")\": another drop-in sorts first"
  done <<<"$SSHD_WANT"
  # Ubuntu 24.04 and later may start sshd by socket activation (ssh.socket): reload a running
  # daemon; a socket-started one reads the files when it starts.
  if [ "$CHANGED" = 1 ] && systemctl is-active --quiet ssh.service; then systemctl reload ssh.service; fi
}

report() {
  section() { printf '\n===== %s =====\n' "$1"; }
  section "system"
  grep PRETTY_NAME /etc/os-release
  echo "kernel $(uname -r), hostname $(hostname), time zone $(timedatectl show -p Timezone --value)"
  echo "CPU: $(nproc) x $(grep -m 1 'model name' /proc/cpuinfo | cut -d : -f 2-)"
  free -m
  df -h /
  swapon --show
  local sync i
  for i in $(seq 12); do
    sync=$(timedatectl show -p NTPSynchronized --value)
    if [ "$sync" = yes ] || [ "$i" = 12 ]; then break; fi
    sleep 5
  done
  echo "time synchronized: $sync"
  if command -v chronyc >/dev/null; then chronyc -n sources || true; fi
  [ "$sync" = yes ] ||
    echo "WARNING: the clock is not synchronized after 60 s. TOTP codes and TLS need the right time: read the sources above (NTS uses TCP 4460, plain NTP UDP 123) and run provision again."
  section "versions"
  # 26.04 ships sudo-rs and the Rust coreutils; the scripts were tested with GNU ones (3.8).
  sudo --version 2>&1 | sed -n 1p
  date --version 2>&1 | sed -n 1p
  nginx -v 2>&1
  psql --version
  ssh -V 2>&1
  certbot --version 2>&1
  python3 --version
  "$SEFID_ROOT/current/node/bin/node" --version 2>/dev/null || echo "node: no release installed yet"
  section "sshd (effective values)"
  if [ "$SMOKE" = 1 ]; then echo "skipped (SEFID_SMOKE=1)"; else sshd -T | grep -E "^($(cut -d ' ' -f 1 <<<"$SSHD_WANT" | paste -sd '|')) "; fi
  section "firewall"
  if [ "$SMOKE" = 1 ]; then echo "skipped (SEFID_SMOKE=1)"; else ufw status verbose; fail2ban-client status sshd || true; fi
  section "listening sockets"
  ss -ltnp
  section "systemd-analyze security sefid.service"
  systemd-analyze security --no-pager sefid.service || true
  section "app environment names"
  /usr/local/sbin/sefid-env || true
  /usr/local/sbin/sefid-status || true
}

main() {
  # The failing line, then what systemd and the journal know: the run log is all there is.
  trap 'echo "ERROR: provision.sh line $LINENO: \"$BASH_COMMAND\" failed with exit code $?" >&2; systemctl --no-pager --failed >&2 || true; journalctl -n 40 -p warning --no-pager >&2 || true' ERR
  [ "$(id -u)" -eq 0 ] || die "run it as root: sudo bash $0"
  cd /
  load_config "$HERE/server.env"
  [ "$SMOKE" = 1 ] && say "SEFID_SMOKE=1: skipping sshd, ufw, fail2ban, hostname, swap and reboot settings"
  install_packages
  setup_os
  setup_layout
  setup_app_env
  setup_postgres
  setup_units
  setup_nginx
  if [ "$SMOKE" != 1 ]; then
    setup_sshd
    setup_firewall
  fi
  report
  say "provision finished"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
