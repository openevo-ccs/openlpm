#!/usr/bin/env bash
#
# localLPM-setup.sh — bring up, verify, seed, tear down, or sync LocalLPM: a
# self-hosted local copy of OpenLPM's Supabase backend, run from this repo's
# own existing supabase/config.toml and supabase/migrations/. See
# docs/localLPM-dev-environment.md for the full design and reasoning; this
# script is the concrete, reviewable procedure that document points back to
# throughout (§3-§7, §10-§12).
#
# THIS SCRIPT TARGETS LOCALLPM'S DEV-MIRROR INSTANCE (the repo's own
# supabase/ directory) — NOT LocalLPM-sandbox, which is a second, separate
# local Supabase project set up by hand per docs/localLPM-dev-environment.md
# §8 (a one-time procedure, not automated here, since it needs a human
# judgment call — a --workdir path and a set of shifted ports — not repeated
# daily the way this script's commands are).
#
# WHAT THIS SCRIPT DOES NOT DO to the real shared production project: `up`,
# `down`, `verify`, `seed`, `pause`, and `resume` never touch it at all —
# every one of those is scoped to the local Docker-based stack `supabase
# start` launches on THIS machine, and none of them uses `--linked` or
# `--project-ref` anywhere. The one exception is `sync`, which DOES read
# from the real shared production database on purpose (that's its whole
# job — see docs/localLPM-dev-environment.md §5) — but only ever reads, via
# `--db-url` with a dedicated read-only credential (never `--linked`, never
# a service-role or personal-access-token credential), and never writes
# anything back to it.
#
# Written and reviewed from a Windows sandbox with the Supabase CLI present
# (v2.116.0) but no Docker/Podman runtime available (confirmed via a real
# `supabase start` attempt — see docs/localLPM-dev-environment.md §12). That
# means every command below is written precisely against the CLI's real,
# checked --help output and this repo's real schema, but none of it has been
# run end to end against a live local or production Postgres. Treat a first
# real run on the actual home server as the true test, not as a formality —
# read the output of each step rather than assuming success, and see §12 for
# the exact, honest list of what's verified vs. only designed.
#
# Usage:
#   ./scripts/localLPM-setup.sh check        # verify prerequisites only
#   ./scripts/localLPM-setup.sh up           # supabase start (trimmed container set)
#   ./scripts/localLPM-setup.sh verify       # confirm migrations applied, extension schema matches, API answers
#   ./scripts/localLPM-setup.sh seed         # create two local test accounts (admin + contributor)
#   ./scripts/localLPM-setup.sh down         # supabase stop
#   ./scripts/localLPM-setup.sh sync         # dump prod (read-only) -> validate -> promote -> restore into LocalLPM (§5)
#   ./scripts/localLPM-setup.sh pause        # mark LocalLPM's mirror-sync paused (for active local schema work, §5.7)
#   ./scripts/localLPM-setup.sh resume       # unmark it
#   ./scripts/localLPM-setup.sh sync-status  # show pause state + last successful sync
#   ./scripts/localLPM-setup.sh systemd      # print the unit/timer files to install (does not install them)
#
# Required for `sync` only (unset for every other command):
#   LOCALLPM_PROD_READONLY_DB_URL — connection string for a dedicated,
#     read-only Postgres role on the real shared production database (see
#     docs/localLPM-dev-environment.md §5.2 for the one-time SQL that
#     creates that role — a real prerequisite this script cannot set up
#     itself, since it requires real admin access to production).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Containers this app doesn't use, per docs/localLPM-dev-environment.md §10
# (checked directly: no Storage/Realtime calls anywhere in src/, exactly one
# Edge Function actually invoked). Not a change to the committed
# supabase/config.toml — a runtime flag, so it only affects how LocalLPM
# itself is launched, not anyone else's plain `supabase start`.
EXCLUDE_CONTAINERS="realtime,storage-api,imgproxy,logflare,vector"

TEST_ADMIN_EMAIL="${LOCALLPM_TEST_ADMIN_EMAIL:-admin@locallpm.test}"
TEST_ADMIN_PASSWORD="${LOCALLPM_TEST_ADMIN_PASSWORD:-localLPM-admin-dev-only}"
TEST_CONTRIBUTOR_EMAIL="${LOCALLPM_TEST_CONTRIBUTOR_EMAIL:-contributor@locallpm.test}"
TEST_CONTRIBUTOR_PASSWORD="${LOCALLPM_TEST_CONTRIBUTOR_PASSWORD:-localLPM-contributor-dev-only}"

# Where sync (§5) keeps staged/archived dumps and its pause marker. Override
# via LOCALLPM_BACKUP_ROOT if the home server's convention differs (e.g. a
# dedicated data volume rather than a directory under the checkout).
BACKUP_ROOT="${LOCALLPM_BACKUP_ROOT:-$REPO_DIR/.locallpm-backups}"
STAGING_DIR="$BACKUP_ROOT/staging"
ARCHIVE_DIR="$BACKUP_ROOT/archive"
FAILED_DIR="$BACKUP_ROOT/failed"
CURRENT_LINK="$BACKUP_ROOT/current"
PAUSE_MARKER="$BACKUP_ROOT/PAUSED"
RETAIN_COUNT=30                 # §5.4 — a month of daily granularity
WARN_TOTAL_BYTES=$((5*1024*1024*1024))   # 5GB — early-warning trip-wire, not a hard cap
WARN_SINGLE_BYTES=$((200*1024*1024))     # 200MB — a single dump this big means investigate, not "wipe it"
CANARY_TABLES="projects users theories"  # §5.3 row-count cross-check

log()  { printf '\n== %s ==\n' "$1"; }
fail() { printf '\nFAILED: %s\n' "$1" >&2; exit 1; }

status_env() { supabase status -o env 2>/dev/null; }
get_var()    { status_env | grep "^${1}=" | cut -d= -f2- | tr -d '"'; }

cmd_check() {
  log "Checking prerequisites"

  if ! command -v docker >/dev/null 2>&1 && ! command -v podman >/dev/null 2>&1; then
    fail "Neither docker nor podman found on PATH. Install Docker (or Podman) and make sure the current user can run it (on Linux: is in the 'docker' group, or use rootless Podman) before continuing. This is the one prerequisite that could NOT be verified from the sandbox this script was written in."
  fi
  if command -v docker >/dev/null 2>&1; then
    docker info >/dev/null 2>&1 || fail "docker is on PATH but not usable (daemon not running, or permission denied). Run 'docker info' directly to see the real error before retrying."
    echo "docker: OK ($(docker --version))"
  else
    podman info >/dev/null 2>&1 || fail "podman is on PATH but not usable. Run 'podman info' directly to see the real error."
    echo "podman: OK ($(podman --version))"
  fi

  if ! command -v supabase >/dev/null 2>&1; then
    fail "supabase CLI not found on PATH. Install it (https://supabase.com/docs/guides/cli/getting-started) — this script was written and tested against v2.116.0, but should tolerate later 2.x versions since it only uses long-stable flags (--exclude, -o json/env, db diff -f, db dump --data-only --db-url)."
  fi
  echo "supabase CLI: OK ($(supabase --version 2>&1 | head -1))"

  if [ ! -f "$REPO_DIR/supabase/config.toml" ]; then
    fail "supabase/config.toml not found under $REPO_DIR — run this script from a real checkout of the openlpm repo, not a partial copy."
  fi
  echo "repo: OK ($REPO_DIR, $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'not a git checkout'))"

  if ! command -v psql >/dev/null 2>&1; then
    echo "NOTE: psql not found on PATH — 'verify', 'seed', and 'sync' fall back to CLI-only checks where possible, but some checks (uuid-ossp schema location, direct row counts) need psql. Install the postgresql-client package for full verification."
  else
    echo "psql: OK ($(psql --version))"
  fi

  echo "All prerequisites present. Note: this only confirms the tools exist and respond — it does not confirm supabase start will succeed (port conflicts, low disk space, and low-memory OOM kills during container startup are real, separate failure modes this check does not catch)."
}

cmd_up() {
  cmd_check
  log "Starting LocalLPM (supabase start, trimmed: excluding $EXCLUDE_CONTAINERS)"
  echo "This applies every file in supabase/migrations/ in order against a fresh local Postgres —"
  echo "currently 001 through whatever the highest-numbered file in that directory is today (never"
  echo "assume a fixed number; see docs/localLPM-dev-environment.md §4)."
  supabase start --exclude "$EXCLUDE_CONTAINERS"
  echo
  echo "Started. Run '$0 verify' next before trusting this as a working LocalLPM instance."
}

cmd_down() {
  log "Stopping LocalLPM (supabase stop)"
  supabase stop
  echo "Stopped. Containers are torn down; migration history lives in git, and mirrored data lives in $ARCHIVE_DIR, so nothing is lost by stopping."
}

_is_running() {
  supabase status >/dev/null 2>&1
}

cmd_verify() {
  log "Verifying LocalLPM"

  echo "--- 1. Container status ---"
  supabase status -o pretty || fail "supabase status failed — is LocalLPM actually running? Try '$0 up' first."

  local api_url db_url anon_key
  api_url="$(get_var API_URL)"
  db_url="$(get_var DB_URL)"
  anon_key="$(get_var ANON_KEY)"
  [ -n "$api_url" ] || fail "Could not read API_URL from 'supabase status -o env' — check container status above."

  echo
  echo "--- 2. Migration history actually applied ---"
  echo "Highest migration file in this checkout: $(ls supabase/migrations/*.sql | sort | tail -1)"
  if command -v psql >/dev/null 2>&1; then
    latest_applied="$(psql "$db_url" -Atc "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null || true)"
    echo "Highest migration Postgres recorded as applied: ${latest_applied:-<none found -- did supabase start actually finish?>}"
  fi
  supabase migration list || true

  echo
  echo "--- 3. uuid-ossp extension schema (docs/localLPM-dev-environment.md §4) ---"
  if command -v psql >/dev/null 2>&1; then
    ext_schema="$(psql "$db_url" -Atc "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'uuid-ossp';" 2>/dev/null || true)"
    if [ -z "$ext_schema" ]; then
      echo "Could not determine uuid-ossp's schema — check manually (see query below)."
    elif [ "$ext_schema" = "extensions" ]; then
      echo "uuid-ossp is in 'extensions' — matches the shared production instance. Good."
    else
      echo "uuid-ossp is in '$ext_schema', NOT 'extensions' — does not match the shared production"
      echo "instance's current layout. A migration that works here could behave differently there."
      echo "Fix (§4 option (a)): CREATE SCHEMA IF NOT EXISTS extensions; ALTER EXTENSION \"uuid-ossp\" SET SCHEMA extensions;"
      echo "That's a one-time parity fix, not a substitute for every new migration opening with"
      echo "  SET search_path = public, extensions;   (option (b), the standing convention)"
    fi
  else
    echo "psql not available — run manually against \$DB_URL:"
    echo "  SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'uuid-ossp';"
  fi

  echo
  echo "--- 4. REST API actually answering ---"
  local http_status
  http_status="$(curl -s -o /dev/null -w '%{http_code}' "$api_url/rest/v1/" -H "apikey: $anon_key" || echo "curl-failed")"
  if [ "$http_status" = "200" ]; then
    echo "REST API OK ($api_url/rest/v1/ -> 200)"
  else
    echo "REST API check returned '$http_status' (expected 200) — check container logs: supabase status, docker ps"
  fi

  echo
  echo "--- 5. Studio reachable ---"
  echo "Open $(get_var STUDIO_URL) in a browser and confirm the table list under 'public' loads and shows the expected tables (projects, theories, discussion_posts, etc.)."

  echo
  echo "If all five checks above look right, LocalLPM is a working, faithful mirror. If you haven't"
  echo "run '$0 seed' yet, do that next before starting real dev/testing work (§6: two accounts, not one)."
}

cmd_seed() {
  log "Seeding two local test accounts (admin + contributor) — docs/localLPM-dev-environment.md §6"

  local api_url service_role_key db_url
  api_url="$(get_var API_URL)"
  service_role_key="$(get_var SERVICE_ROLE_KEY)"
  db_url="$(get_var DB_URL)"
  [ -n "$api_url" ] && [ -n "$service_role_key" ] || fail "Could not read API_URL/SERVICE_ROLE_KEY — is LocalLPM running? Try '$0 up' first."

  create_user() {
    local email="$1" password="$2"
    echo "Creating $email ..."
    curl -s -X POST "$api_url/auth/v1/admin/users" \
      -H "apikey: $service_role_key" \
      -H "Authorization: Bearer $service_role_key" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true}" \
      | (command -v jq >/dev/null 2>&1 && jq -r '.id // .msg // .' || cat)
    echo
  }

  create_user "$TEST_ADMIN_EMAIL" "$TEST_ADMIN_PASSWORD"
  create_user "$TEST_CONTRIBUTOR_EMAIL" "$TEST_CONTRIBUTOR_PASSWORD"

  echo
  echo "Both accounts get a public.users row automatically (migration 003's trigger fires on any"
  echo "insert into auth.users, not just OAuth sign-ins — confirmed by reading that migration)."
  echo "Promoting $TEST_ADMIN_EMAIL to role='admin' (SETUP_GUIDE.md's normal 'set your own role to"
  echo "admin' step, done here via SQL since this is a scripted dev seed, not an interactive sign-in):"

  if command -v psql >/dev/null 2>&1; then
    psql "$db_url" -c "UPDATE public.users SET role = 'admin' WHERE email = '$TEST_ADMIN_EMAIL';"
  else
    echo "psql not available — run manually: UPDATE public.users SET role = 'admin' WHERE email = '$TEST_ADMIN_EMAIL';"
  fi

  echo
  echo "Two accounts ready:"
  echo "  admin:       $TEST_ADMIN_EMAIL / $TEST_ADMIN_PASSWORD"
  echo "  contributor: $TEST_CONTRIBUTOR_EMAIL / $TEST_CONTRIBUTOR_PASSWORD"
  echo "These are LOCAL-ONLY dev credentials with intentionally memorable defaults — fine for a"
  echo "throwaway local Postgres instance, never appropriate for anything internet-reachable."
  echo "Override with LOCALLPM_TEST_ADMIN_EMAIL / _PASSWORD / _CONTRIBUTOR_* env vars if preferred."
  echo
  echo "Standing convention from here on (§6): check a schema or feature change as BOTH accounts"
  echo "before treating it as ready to become a migration PR — two real bugs (a cross-project data"
  echo "leak, a role-display bug) only surfaced under a second, non-owner account, not the first."
}

# --- §5: production-data mirror sync ---------------------------------------

cmd_pause() {
  mkdir -p "$BACKUP_ROOT"
  printf 'paused at %s by %s\n' "$(date -u +%FT%TZ)" "${USER:-unknown}" > "$PAUSE_MARKER"
  echo "LocalLPM mirror-sync paused. The next scheduled sync will skip itself and log why, rather"
  echo "than resetting this instance's data. Run '$0 resume' when active local work is done."
}

cmd_resume() {
  rm -f "$PAUSE_MARKER"
  echo "LocalLPM mirror-sync resumed. The next scheduled sync will run normally."
}

cmd_sync_status() {
  log "LocalLPM mirror-sync status"
  if [ -f "$PAUSE_MARKER" ]; then
    echo "PAUSED — $(cat "$PAUSE_MARKER")"
  else
    echo "Not paused — the next scheduled sync will run normally."
  fi
  if [ -L "$CURRENT_LINK" ] || [ -f "$CURRENT_LINK" ]; then
    echo "Last known-good dump: $(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "$CURRENT_LINK") ($(date -r "$CURRENT_LINK" -u +%FT%TZ 2>/dev/null || echo 'unknown time'))"
  else
    echo "No successful sync has ever completed — 'current' does not exist yet."
  fi
  if [ -d "$ARCHIVE_DIR" ]; then
    echo "Archived dumps retained: $(ls "$ARCHIVE_DIR" 2>/dev/null | wc -l) (cap: $RETAIN_COUNT, §5.4)"
    echo "Archive size: $(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)"
  fi
}

cmd_sync() {
  log "LocalLPM production-data mirror sync (docs/localLPM-dev-environment.md §5)"

  if [ -f "$PAUSE_MARKER" ]; then
    echo "SKIPPED — sync is paused ($(cat "$PAUSE_MARKER")). Not a failure. Run '$0 resume' to re-enable."
    exit 0
  fi

  local prod_url="${LOCALLPM_PROD_READONLY_DB_URL:-}"
  [ -n "$prod_url" ] || fail "LOCALLPM_PROD_READONLY_DB_URL is not set. This must be a connection string for the dedicated, read-only 'locallpm_backup_reader' Postgres role on the real shared production database — see docs/localLPM-dev-environment.md §5.2 for the one-time SQL a production admin needs to run to create it. This script will not fall back to any broader credential."

  mkdir -p "$STAGING_DIR" "$ARCHIVE_DIR" "$FAILED_DIR"

  local timestamp staging_file
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  staging_file="$STAGING_DIR/dump-$timestamp.sql"

  # §5.6 steps 1-2: bring LocalLPM up if it isn't already, remember whether we did.
  local we_started_it="no"
  if ! _is_running; then
    echo "LocalLPM is not currently running — starting it for this sync (will stop it again afterward, since it was found stopped)."
    supabase start --exclude "$EXCLUDE_CONTAINERS"
    we_started_it="yes"
  else
    echo "LocalLPM is already running — leaving it running exactly as found, sync will not stop it afterward."
  fi

  local restore_ok="no"
  {
    echo "--- 1. Dumping production (read-only role, data-only, schema untouched) ---"
    supabase db dump --data-only --db-url "$prod_url" -f "$staging_file"

    echo
    echo "--- 2. Validating the staged dump before trusting it (§5.3) ---"
    local size
    size="$(wc -c < "$staging_file" 2>/dev/null || echo 0)"
    if [ "${size:-0}" -eq 0 ]; then
      fail "Staged dump is empty (0 bytes). Aborting — 'current' is untouched."
    fi
    echo "size OK: $size bytes"

    local check_failed="no"
    for table in $CANARY_TABLES; do
      local prod_count dump_count
      prod_count="$(psql "$prod_url" -Atc "SELECT count(*) FROM public.$table;" 2>/dev/null || echo "")"
      dump_count="$(awk -v t="public.$table" '
        $0 ~ "^COPY " t " " { in_copy=1; next }
        in_copy && $0 == "\\." { print n; exit }
        in_copy { n++ }
      ' "$staging_file")"
      if [ -z "$prod_count" ] || [ -z "$dump_count" ]; then
        echo "  $table: could not check (psql unavailable, or table used INSERTs not COPY — inspect manually)"
        continue
      fi
      if [ "$prod_count" != "$dump_count" ]; then
        echo "  $table: MISMATCH — production has $prod_count rows, dump has $dump_count"
        check_failed="yes"
      else
        echo "  $table: OK ($dump_count rows)"
      fi
    done

    if [ "$check_failed" = "yes" ]; then
      local failed_file="$FAILED_DIR/dump-$timestamp.sql"
      mv "$staging_file" "$failed_file"
      fail "Canary row-count check failed — moved staging dump to $failed_file for inspection. 'current' is untouched; LocalLPM keeps yesterday's data. This is a deliberate stop, not a partial apply."
    fi

    echo
    echo "--- 3. Promoting: staging -> archive -> atomic 'current' swap (§5.3) ---"
    local archived_file="$ARCHIVE_DIR/dump-$timestamp.sql"
    mv "$staging_file" "$archived_file"
    ln -sfn "$archived_file" "$CURRENT_LINK.tmp"
    mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
    echo "Promoted: $archived_file is now 'current'."

    echo
    echo "--- 4. Pruning old archived dumps beyond retention ($RETAIN_COUNT, §5.4) ---"
    ls -1t "$ARCHIVE_DIR"/dump-*.sql 2>/dev/null | tail -n +$((RETAIN_COUNT + 1)) | while read -r old; do
      echo "  pruning $old"
      rm -f "$old"
    done

    echo
    echo "--- 5. Size trip-wire check (§5.4, early warning only, not a hard cap) ---"
    local total_bytes
    total_bytes="$(du -sb "$ARCHIVE_DIR" 2>/dev/null | cut -f1)"
    if [ -n "$total_bytes" ] && [ "$total_bytes" -gt "$WARN_TOTAL_BYTES" ]; then
      echo "WARNING: archive directory is ${total_bytes} bytes, over the ${WARN_TOTAL_BYTES}-byte trip-wire. Investigate — Storage should still be unused (§10)."
    fi
    if [ "$size" -gt "$WARN_SINGLE_BYTES" ]; then
      echo "WARNING: this dump is ${size} bytes, over the ${WARN_SINGLE_BYTES}-byte single-dump trip-wire. Investigate before assuming this is normal growth."
    fi

    echo
    echo "--- 6. Restoring into LocalLPM: fresh schema from migrations, then the validated dump ---"
    supabase db reset --no-seed
    local db_url
    db_url="$(get_var DB_URL)"
    psql "$db_url" -f "$archived_file"
    restore_ok="yes"
  } || true

  # §5.6 step 4: only stop it again if this run was the one that started it.
  if [ "$we_started_it" = "yes" ]; then
    echo
    echo "Stopping LocalLPM again (this run started it; returning it to the state it was found in)."
    supabase stop
  fi

  if [ "$restore_ok" = "yes" ]; then
    echo
    echo "Sync complete. LocalLPM's dev-mirror instance now reflects production as of $timestamp."
  else
    fail "Sync did not complete successfully — see output above. 'current' reflects the last run that DID succeed, if any (check '$0 sync-status')."
  fi
}

cmd_systemd() {
  cat <<'UNIT_EOF'
# ---------------------------------------------------------------------------
# Five systemd units. Only localLPM-sync.timer should ever be `enable`d —
# see docs/localLPM-dev-environment.md §11 for why the sync job is the one
# deliberate exception to "stay on-demand." The four up/down units exist for
# convenience (`systemctl start localLPM-up`) but should stay disabled at
# boot; bringing either instance's compute up is a deliberate action, not
# something that should survive a reboot silently. Adjust
# WorkingDirectory/User to match the real checkout path and the account that
# owns it before installing.
#
# Install as (adjust path):
#   sudo cp localLPM-*.service localLPM-sync.timer /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now localLPM-sync.timer   # the one to actually enable
# Use the rest on demand:
#   sudo systemctl start localLPM-up      # bring LocalLPM's dev-mirror instance up
#   sudo systemctl start localLPM-down    # tear it down
#   sudo systemctl start localLPM-sync    # run a sync immediately, outside the schedule
# ---------------------------------------------------------------------------

# --- /etc/systemd/system/localLPM-up.service ---
[Unit]
Description=Bring up LocalLPM's dev-mirror instance (on-demand, not enabled at boot)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=<REPLACE: the account that owns the openlpm checkout>
WorkingDirectory=<REPLACE: /path/to/openlpm>
ExecStart=/usr/bin/env bash scripts/localLPM-setup.sh up
RemainAfterExit=yes

# --- /etc/systemd/system/localLPM-down.service ---
[Unit]
Description=Tear down LocalLPM's dev-mirror instance

[Service]
Type=oneshot
User=<REPLACE: the account that owns the openlpm checkout>
WorkingDirectory=<REPLACE: /path/to/openlpm>
ExecStart=/usr/bin/env bash scripts/localLPM-setup.sh down

# --- /etc/systemd/system/localLPM-sync.service ---
# Started on its own via localLPM-sync.timer below (or manually, on demand).
# Starts/stops LocalLPM's own compute around itself as needed -- see §5.6.
[Unit]
Description=Sync LocalLPM's dev-mirror instance from real production data (read-only pull)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=<REPLACE: the account that owns the openlpm checkout>
WorkingDirectory=<REPLACE: /path/to/openlpm>
# LOCALLPM_PROD_READONLY_DB_URL belongs in an EnvironmentFile with tight
# permissions (chmod 600, owned by the service user), never inline here and
# never committed anywhere -- see §5.2 for what credential this must be.
EnvironmentFile=<REPLACE: /etc/locallpm/sync.env>
ExecStart=/usr/bin/env bash scripts/localLPM-setup.sh sync

# --- /etc/systemd/system/localLPM-sync.timer ---
# The one unit this document recommends actually enabling at boot -- see §11.
[Unit]
Description=Run the LocalLPM production-data sync nightly

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT_EOF
}

case "${1:-}" in
  check)       cmd_check ;;
  up)          cmd_up ;;
  down)        cmd_down ;;
  verify)      cmd_verify ;;
  seed)        cmd_seed ;;
  sync)        cmd_sync ;;
  pause)       cmd_pause ;;
  resume)      cmd_resume ;;
  sync-status) cmd_sync_status ;;
  systemd)     cmd_systemd ;;
  *)
    echo "Usage: $0 {check|up|down|verify|seed|sync|pause|resume|sync-status|systemd}"
    echo "See the header of this file, and docs/localLPM-dev-environment.md, for what each does."
    exit 1
    ;;
esac
