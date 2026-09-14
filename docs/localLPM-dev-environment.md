# LocalLPM: a self-hosted development, backup, and sandbox environment for OpenLPM

**Status:** Design spec, approved by Dustin 2026-09-14 ("let's create a Linux box local clone of
OpenLPM also for development purposes... call it LocalLPM"), extended the same day with a second,
explicit requirement: LocalLPM should also hold a real, reliably-synced local copy of OpenLPM's
actual production data, not just replay schema with empty or seed data. Written from the `openlpm`
repo, branch `localLPM-dev-environment-design`. Nothing here has been provisioned — no container
has been started against a persistent home-server volume, no account created, no data moved, and
no credential created against the real shared production database. This document specs the work
precisely enough for whoever provisions the home server to execute it; it does not do that
provisioning itself. See `scripts/localLPM-setup.sh` for the concrete runbook and §12 for exactly
what was and wasn't testable from here.

## 1. What LocalLPM is

LocalLPM is a self-hosted deployment of the same OpenLPM application, running against its own
local Postgres/Supabase stack instead of the shared, public, multi-tenant production project. It
is not a different app and not a different codebase — it is the same `openlpm` git repository,
built and run exactly as it already is, pointed at a different backend through the same two
environment variables the app already uses for that purpose (§2).

It exists to do three things:

1. **A real development mirror, backed by real data.** Schema and feature changes get tried
   against LocalLPM's own Postgres instance before they ever touch the shared production database
   — and, per Dustin's explicit "make it easy and error proof and reliable" instruction, that
   instance also carries a nightly, validated, locally-stored copy of OpenLPM's actual production
   data (§5), not just the empty schema. Development happens against realistic content, and the
   home server ends up with a real local backup of OpenLPM's data as a byproduct.
2. **The private home for `eva-lpm`.** The MPI-EVA Research & Department Engagement project,
   already prepped on branch `eva-lpm-self-hosted-prep`, needs to live somewhere other than
   OpenLPM's shared production database because that database has no per-project privacy
   mechanism (§8). LocalLPM is the "separate Supabase project" that design already called for.
3. **Ask Eva's own capability sandbox.** Before Ask Eva (`eva-graph/ask_eva/`) gets a real, live
   connection to any OpenLPM-shaped data, it needs somewhere to develop and test that connection
   that isn't the shared production database — and, once `eva-lpm` is seeded, somewhere holding
   real (if unreviewed) MPI-EVA content to actually develop against.

### Two instances, not one — and why that changed from an earlier draft of this document

The first version of this document, before the production-data-sync requirement existed, proposed
one shared LocalLPM instance for all three jobs. That no longer holds, for a concrete, checkable
reason: job 1 now means a **nightly process that wipes and reloads this instance's data from
production** (§5.7 covers exactly when and how). Job 2 means `eva-lpm`'s data needs to be
**permanent** — never touched by an automated process, ever, because it's the one thing on
LocalLPM that has no upstream copy to restore from if something goes wrong. Those two
requirements cannot both be true of the same database without either building fragile,
row-level-filtered sync logic (excluding `eva-lpm`'s rows from every wipe, maintained by hand as
the schema grows) or accepting real risk that a sync bug someday nukes MPI-EVA department content
nobody meant to touch. Given Dustin's own explicit "error proof" bar applies specifically to the
sync mechanism, the simpler and more robust answer is architectural, not procedural: **put them on
different instances**, so the sync job's blast radius is structurally limited to the one instance
that's supposed to be disposable, and `eva-lpm` sits somewhere the sync job has no way to reach at
all — not "reaches but is coded to skip."

So, concretely, LocalLPM is two local Supabase projects, both built from this same repo's
codebase and migration history, both run via the same Supabase CLI, on the same home server, on
different local ports:

- **LocalLPM** (the default instance — `supabase/config.toml`, this repo's existing one).
  Job 1: schema/feature development, and the nightly synced production-data mirror. Expected to
  get its data wiped and replaced on the sync job's own cadence (§5) — nothing that needs to
  survive that should ever be created here.
- **LocalLPM-sandbox** (a second, separate local Supabase project — its own `config.toml`, its
  own ports, same migration files, never touched by the sync job at all). Jobs 2 and 3:
  `eva-lpm`'s permanent home, and Ask Eva's development target. Set up once (§8), then evolves
  only through deliberate human action — a curator's import pass, real discussion activity —
  never an automated overwrite.

Both are real, working OpenLPM instances in every other respect: same UI, same RLS-enforced access
rules, same migration history. The split is about which one a scheduled, unattended process is
allowed to touch, not about the app being different in any way between them.

## 2. Same codebase, different backend — not a fork

The whole design turns on one constraint: **neither LocalLPM instance is ever a separate copy of
the `openlpm` codebase.** Both are the same git history, the same `src/`, the same
`supabase/migrations/`, run in more than one place. What differs between "the live public
OpenLPM," "LocalLPM," and "LocalLPM-sandbox" is entirely captured in two environment variables:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`src/lib/supabase/client.ts` reads exactly these two values from `import.meta.env` and nothing
else decides which backend the app talks to (confirmed by reading the file directly — it's an
eleven-line function). Point them at the shared hosted project and you get production OpenLPM.
Point them at one local Supabase project's URL and anon key and you get that instance, same code,
same UI, same RLS-enforced access rules, running against a database nobody else can see.

This matters more than it might look like on paper, because this ecosystem has been burned by the
alternative more than once. A forked or hand-copied second version of an app or dataset drifts:

- `eva_literature` existed as two separate clones that quietly diverged before being reconciled
  onto one canonical repo (resolved 2026-08-04, after real fragmentation had already happened).
- `full_lit` and `literaturebase` still reference the pre-2026-08-16 `lit:<slug>` id scheme after
  LiteratureBase itself moved to `OE-LITERATURE-<slug>` — a still-open, ecosystem-wide gap from
  exactly this kind of drift.
- `bio-core-k12` and `oe-interdisciplinary-k12`, two parallel LPMs built independently, ended up
  with no shared ConceptBase ids between them at all.

Every one of those started as a reasonable-sounding "let's have our own copy" decision and turned
into a standing reconciliation debt. LocalLPM avoids that failure mode structurally: there is only
ever one `openlpm` codebase, and even running it as two instances (§1) doesn't change that — both
instances share the exact same migration files (LocalLPM-sandbox's via a symlink, §8, not a copy).
A schema change tried on LocalLPM either becomes a real migration file that lands in the one
`supabase/migrations/` history (§6), or it doesn't exist. There's no second copy of the schema to
drift out of sync with the first, because there's no second copy of anything except the data
itself — and for LocalLPM's dev-mirror instance, that data is deliberately disposable (§5); for
LocalLPM-sandbox, it was never meant to be shared in the first place (that's the point of purposes
2 and 3).

## 3. How it actually runs: the Supabase CLI's local stack

`supabase/config.toml` already exists in this repo (`project_id = "openlpm"`), which means the
Supabase CLI's local-development tooling is already half set up here — it was just never
documented or used. `QUICKSTART.md` and `SETUP_GUIDE.md` only describe the "create a project on
supabase.com" path; neither mentions `supabase start` at all. LocalLPM is what actually puts that
existing config to use.

Mechanically, `supabase start` (from the repo root, where `supabase/` lives):

1. Reads `supabase/config.toml` and launches a set of Docker containers: Postgres itself, plus
   GoTrue (auth), PostgREST (the REST API the app's `supabase-js` client actually talks to), Kong
   (API gateway), Supabase Studio (a local admin UI on port 54323), and several more (Realtime,
   Storage, an email-testing inbox, an Edge Functions runtime, an analytics/log pipeline). §10
   below covers which of these OpenLPM's app code doesn't actually use and can be skipped to
   lighten the footprint on a resource-constrained box.
2. Applies every file in `supabase/migrations/` **in filename order** against the fresh local
   Postgres instance, then runs `supabase/seed.sql` if one exists (it doesn't yet in this repo —
   `config.toml`'s `[db.seed]` points at a `./seed.sql` that has never been created, so a fresh
   `supabase start` currently seeds nothing beyond what the numbered migrations themselves insert).
3. Prints local connection info: the API URL, the Postgres connection string, a Studio URL, and
   the local anon/service-role keys.

That's it for standing an instance up empty (schema plus the original seed migrations). §5 covers
how LocalLPM's dev-mirror instance additionally gets loaded with real production data on top of
that.

## 4. Seeding schema: the real migration history, with no fixed number anywhere it can go stale

`supabase start` (and `supabase db reset`, which redoes the same thing against an already-running
stack) doesn't seed a database's *schema* from a snapshot or a dump — it runs the actual migration
files, in order, the same files that built the shared production database over time. As of this
writing that's `001_initial_schema.sql` through `024_claim_open_review_assignments.sql` — but that
number is already stale by the time this sentence is read. A separate, active work session is
doing further schema work on top of this right now (a Theories/Strands/Discussions restructure),
and OpenLPM's migration count has been climbing all year. **Nothing in this document, or in
`scripts/localLPM-setup.sh`, should ever be read as "run migrations through 024."** The actual
instruction is and stays: run every file in `supabase/migrations/`, in the order they're already
named, whatever the current highest number is. `supabase start`/`db reset` do this by
construction — they glob the directory — so the only place a stale number could sneak in is a
human writing "up to 024" in a doc or a script, which is exactly what this document and its
companion script avoid doing anywhere except as a dated example like this paragraph.

This governs *schema* on both instances, always, unconditionally — schema only ever comes from
git, never from a dump (§5.1 makes this explicit for the sync job specifically). *Data* is a
separate story that now depends on which instance and which point in its lifecycle:

- **LocalLPM-sandbox**, and LocalLPM's dev-mirror instance *before its first successful sync*: data
  is whatever the numbered migrations themselves insert — because `005_seed_projects.sql` and
  `008_swap_eva_lpm_for_sachsen.sql` are themselves ordinary numbered migrations, a fresh instance
  ends up with the same original seed projects production has (EvoMentor, Sachsen Biologie, the
  two synthetic K-12 LPMs), automatically, just by running the migration history.
- **LocalLPM's dev-mirror instance, from its first successful sync onward**: data is whatever the
  latest validated production dump contains (§5), which supersedes the original migration-seeded
  data entirely on that instance from then on.

### The one real drift risk: where `uuid-ossp` lives, and the standing fix

A genuine gotcha surfaced today (2026-09-14) by the session actively writing new OpenLPM
migrations, worth stating plainly because it's exactly the kind of thing that can pass silently on
a local mirror and then fail — or worse, silently behave differently — against the real shared
instance:

`001_initial_schema.sql` installs the `uuid-ossp` extension with an unqualified
`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`, which at the time put it in the `public` schema.
Sometime after migrations 001–017 were written, the hosted Supabase platform changed its default:
`uuid-ossp` on the shared project now lives in a separate `extensions` schema, not `public`. That
platform-level move is why migrations 018 through 024 each open with
`SET search_path = public, extensions;` — a deliberate, already-in-place fix (confirmed by reading
each file's own header comment) so `uuid_generate_v4()` keeps resolving correctly without having to
schema-qualify every call.

The risk for either LocalLPM instance: a **fresh Docker-based local Postgres/Supabase stack might
not match that same platform default.** Depending on the Supabase CLI version and its own local
Postgres image, `uuid-ossp` could install into `public` locally even though it lives in
`extensions` on the real shared instance — meaning a migration could apply cleanly locally and
then behave differently, or fail outright, against production. That's a silent-drift risk in the
one direction this whole design is supposed to prevent.

Two ways to handle this, and this document picks the more robust one rather than leaving it as a
choice:

- **(a) Verify parity once, per instance.** After the first `supabase start` on each instance,
  check where `uuid-ossp` actually landed (`scripts/localLPM-setup.sh verify` does this — see
  §12) and, if it's in `public` instead of `extensions`, move it by hand
  (`ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;`, after creating that schema if it doesn't
  exist) so the instance matches the shared instance's real layout before anyone treats it as a
  faithful mirror.
- **(b) Make every migration defend itself, regardless of which schema it lands in anywhere.**
  This is already the emerging convention (migrations 018–024), and this document makes it the
  standing rule going forward: **every new migration file, authored against either LocalLPM
  instance or anywhere else, opens with `SET search_path = public, extensions;`** before its first
  `CREATE`/`INSERT`/`uuid_generate_v4()` call. That one line makes a migration's behavior stop
  depending on which schema `uuid-ossp` happens to live in on whatever instance it runs against —
  local, shared, or some future third instance — because it explicitly puts both candidate schemas
  on the search path itself instead of relying on the ambient default.

(b) is the one to actually rely on, because it's self-defending on every future instance this
schema ever runs on, not just this one; (a) is still worth doing once per instance, as a real
verification step rather than an assumption, precisely because migrations 001–017 predate the
convention and don't carry their own defense. Both are folded into `scripts/localLPM-setup.sh`'s
verification step and into the PR-review expectation in §6 below.

## 5. Mirroring real production data: the sync job

This section addresses Dustin's 2026-09-14 addition directly: LocalLPM's dev-mirror instance
should hold a real, locally-synced copy of OpenLPM's actual production data, kept "easy, error
proof, and reliable," using Supabase's own standard dump/restore path rather than a custom sync
protocol.

### 5.1 Mechanism: `supabase db dump`, not a custom protocol

Confirmed against the CLI actually installed here (`supabase db dump --help`): `--data-only`
dumps rows without schema, `--db-url <connection-string>` dumps from any reachable Postgres
instance (not only a CLI-linked project), and `-f`/`--file` writes the result to a file. The sync
job's dump step is exactly:

```bash
supabase db dump --data-only --db-url "$PROD_READONLY_DB_URL" -f "$STAGING_FILE"
```

Schema is never part of this dump and never sourced from production — schema comes from git
migrations only, always (§4), on both instances, unconditionally. That keeps there being exactly
one source of truth for schema regardless of how the sync job behaves, which is itself part of
"error proof": a schema bug can never be silently introduced by a data sync.

Restore, once a dump is validated (§5.3), is equally standard: rebuild LocalLPM's dev-mirror
schema fresh from migrations (`supabase db reset --no-seed`, which is the same migration-history
replay §4 already describes, just re-run) and then load the validated data-only dump on top
(`psql "$LOCAL_DB_URL" -f "$CURRENT_DUMP"`). Because this instance never holds anything
irreplaceable (§1's whole reason for the two-instance split), "wipe and reload" is allowed to be
this simple — no row-level filtering, no partial merge, no risk of a filter bug quietly failing to
protect something. The simplicity here is a direct payoff of the architectural split in §1, not a
separate design choice.

### 5.2 Credentials: minimum real access, not blanket service-role

`supabase db dump --db-url` accepts any valid Postgres connection string — it does **not** require
the CLI's full `supabase link` flow, which needs a Supabase personal access token (a broad,
account-wide management-API credential, far more access than a backup job needs). The right
credential for this job is a **dedicated, read-only Postgres role**, created once, directly on the
shared production database:

```sql
-- Run ONCE by a maintainer with real admin access to the shared production
-- Supabase project (via its own SQL Editor, or psql with the project's admin
-- credentials) -- NOT something this task did or could do, since it has no
-- credentials for the real shared instance and was explicitly told not to
-- try to reach it.
CREATE ROLE locallpm_backup_reader LOGIN PASSWORD '<a real, generated password -- store only in the home server's own secret store, never in this repo>';
GRANT USAGE ON SCHEMA public, extensions TO locallpm_backup_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO locallpm_backup_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO locallpm_backup_reader;
```

The sync job's only credential is then this role's plain connection string
(`postgresql://locallpm_backup_reader:<password>@<production-host>:5432/postgres`), used
exclusively with `--db-url`, stored only where the sync script reads it from (an env file with
tight file permissions, never committed, never logged) — never the production service-role key,
never a personal access token, and never anything with write access. This matches the same
minimal-credential-exposure discipline already used elsewhere on the home server (Ask Eva's own
deploy path uses git-archive-over-SSH rather than a long-lived GitHub credential sitting on the
box) — a scoped, read-only credential that can only ever leak read access to already-mirrored
data, never write access to the real production database.

Creating this role against the real shared instance is a genuine prerequisite this task cannot
complete itself — it has no access to that database, and per this task's own instructions,
shouldn't try to reach it. It's a concrete, one-line-of-reasoning item for whoever provisions
LocalLPM for real: get a maintainer with real production admin access to run the SQL above once,
then hand the resulting connection string to the sync job's config.

### 5.3 Validate before swap: never overwrite the last known-good copy

"Error proof" is treated here as a specific, checkable property, not a general aspiration: **a
failed or partial dump must never replace the last known-good local mirror.** Concretely, the sync
job:

1. Dumps to a **staging** path, never directly to the location the restore step reads from
   (`$BACKUP_ROOT/staging/dump-<timestamp>.sql`).
2. Runs a real sanity check on that staging file before it's trusted at all:
   - **Non-zero size** — catches a totally failed or empty dump outright.
   - **A row-count cross-check on a small set of canary tables** (`projects`, `users`, `theories`)
     — query the same read-only production connection for `SELECT count(*) FROM <table>`
     immediately before dumping, then confirm the dump file's row count for that table (counted
     from its `COPY ... FROM stdin` block) matches. A real, if imperfect, check: a mismatch here
     (especially a big drop, since production data should essentially only grow on a low-traffic,
     pre-launch app) is a strong signal of a partial or corrupted dump, not routine noise.
   - **Expected structural markers present** — the dump actually contains a `COPY public.projects`
     (or equivalent `INSERT INTO`) block for each canary table, not just a plausible byte count.
3. **Only if every check passes** does the job atomically promote the staging file to "current":
   move it into a timestamped archive directory, then atomically repoint a `current` symlink at it
   (`ln -sfn <new-file> current.tmp && mv -T current.tmp current` — `mv` within the same filesystem
   is atomic, so there is never a moment where `current` points at a partially-written or
   nonexistent file).
4. **If any check fails**, the job stops immediately: the staging file moves to a `failed/`
   folder (kept briefly, for debugging why), the run is logged clearly as failed, and — critically
   — `current` is left completely untouched. The *restore* step (loading data into LocalLPM's
   dev-mirror instance) only ever runs against whatever `current` points at, and only runs at all
   if this run's own validation passed; a bad night produces "LocalLPM didn't get today's update,"
   never "LocalLPM's data is now corrupted or half-overwritten." There is never a moment with zero
   valid local backups, because the previous "current" dump is never touched until a strictly
   better one has already passed every check.

### 5.4 Retention and storage budget

An explicit policy, not unbounded accumulation: **keep the last 30 successfully validated dumps**
(roughly a month of daily granularity), pruning the oldest archived dump after each new one is
promoted, with the dump `current` points at always exempt from pruning regardless of age (so a
stretch of failed syncs never ages out the one good backup that still exists).

On size: checked directly, OpenLPM's app code makes no use of Supabase Storage anywhere
(`grep -rl "\.storage\." src` returns nothing) — production data is exclusively relational rows
(project descriptions, theories, discussions, literature references, schema elements), no
uploaded files or binary blobs. That means dump sizes should stay small — tens of megabytes at
most, even as the pre-launch dataset grows — so 30 retained dumps should land well under 1GB
total, a trivial fraction of the home server's 916GB HDD. As a cheap early-warning check rather
than a hard limit, the sync script logs a warning if the total backup directory ever exceeds 5GB,
or if a single dump exceeds 200MB — either would mean either Storage usage has started somewhere
unexpectedly (worth investigating directly, since §10 documents it as currently unused) or
something about the dump itself is behaving unexpectedly.

### 5.5 The real-data consideration, named directly

Once this pulls actual production data, "production data" needs to be read literally: if OpenLPM
has any signed-up users beyond this lab, their real account data (`public.users.email`, `name`,
whatever project content they've written) now has a second real copy sitting on the home server.
This doesn't block building the sync job, but it shouldn't be built past silently either.

What's actually checkable from here: OpenLPM's own `README.md` carries a status badge reading
"Early / Pre-Launch," and `CONTRIBUTING.md` describes the project as "early — pre-launch, single
maintainer" (both read directly, not assumed). That's real evidence that, as of this writing, a
production dump's realistic content is lab-internal seed and test data, not a wide base of outside
users' personal information. But that status is a snapshot of today, not a property of this
design, and this document shouldn't be read as guaranteeing it stays true. Concretely:

- **Whoever actually enables the sync job should re-check OpenLPM's real current user base at that
  moment**, not rely on this document's 2026-09-14 snapshot of "pre-launch."
- **The home server's own access control — who can reach the box at all, and who can read the
  backup directory specifically — needs to be scoped with real user data in mind from the day the
  sync goes live**, not revisited only after someone notices real people's data is there. This
  task doesn't own home-server access control (a different team does); this is a direct flag for
  that team, not something this document resolves.
- The backup directory should get at least the same "not internet-reachable, lab-internal access
  only" posture already recommended for LocalLPM itself (§11), and arguably a tighter one, since
  it's the one piece of this whole design most likely to eventually hold real third-party personal
  data rather than lab-generated content.

### 5.6 Scheduling: a systemd timer, matching the box's own patterns

Per the explicit instruction to use native systemd rather than a cron hack, matching how
Navidrome/Caddy and the rest of the box's own services are already run: a `localLPM-sync.service`
(oneshot, runs the sync script end to end — dump, validate, promote, restore) paired with a
`localLPM-sync.timer` (`OnCalendar=*-*-* 03:00:00`, `Persistent=true` so a run the box missed
because it was off at 3am still happens at next boot, appropriate for a home server that isn't
guaranteed to be always-on itself). Exact unit content is in `scripts/localLPM-setup.sh systemd`.

This is deliberately the **one** piece of LocalLPM that this document recommends actually enabling
unattended (`systemctl enable --now localLPM-sync.timer`), in contrast to §11's "stay on-demand,
not always-on" recommendation for LocalLPM's own compute. The distinction is real, not
inconsistent: §11 is about a dev sandbox a person is actively using, which should only run when
someone's using it; a backup that only runs when a human remembers to trigger it manually isn't
"reliable" by Dustin's own bar — unattended, scheduled execution is exactly what a systemd timer
exists for, and is the correct shape specifically for this one job.

That does raise a real mechanical question: if LocalLPM's dev-mirror containers stay stopped by
default (§11) except when someone's actively working, what does the 3am sync job restore *into*?
The sync script's own job is to handle this rather than assume the instance is already up:

1. Check whether LocalLPM's dev-mirror instance is currently running (`supabase status`).
2. If not, start it (`supabase start`, same trimmed-container invocation as §10) and remember that
   *this run* is the one that started it.
3. Dump, validate, and (if valid) restore, exactly as §5.1–§5.3 describe.
4. If this run was the one that started the instance in step 2, stop it again afterward
   (`supabase stop`) — returning it to the state it was found in. If a developer already had it
   running for active work, the sync job leaves it running, exactly as it found it, rather than
   pulling it out from under them.

This keeps the on-demand posture intact from a human's perspective (LocalLPM is "off" unless
someone's using it, most of the time) while making the backup itself fully unattended and reliable
regardless of whether anyone happens to be using LocalLPM that night.

### 5.7 Coexisting with dev/schema work on the same instance

Because LocalLPM's dev-mirror instance carries both jobs — schema experiments *and* the nightly
production mirror — the two need one explicit rule so they don't silently conflict: **the mirror
wins by default.** Absent any other signal, the scheduled sync overwrites whatever local state
exists on that instance with the latest validated production data, on its own cadence, discarding
any in-progress local schema/data experiments in the process. Anyone doing active work that
shouldn't be reset out from under them mid-experiment needs to say so explicitly:

```bash
./scripts/localLPM-setup.sh pause   # creates a marker; the next scheduled sync skips itself and logs why, rather than running
./scripts/localLPM-setup.sh resume  # removes the marker; the next scheduled sync runs normally again
```

The sync script checks for this marker (`$BACKUP_ROOT/PAUSED`) as its very first step, before
touching anything — if present, it logs a clear, visible skip ("sync paused since <timestamp>, no
restore attempted") and exits 0, not as a failure. This is a deliberate skip, not an error
condition, and doesn't affect the "never overwrite last known-good" guarantee in §5.3 either way —
a paused night simply means no new dump was attempted, and `current` stays exactly where it was.

The plain-language version of this whole section, worth stating once outside the mechanics: **by
default, expect LocalLPM's dev-mirror instance to reset itself to real production data every
night.** Treat anything built there as disposable unless you've deliberately paused the sync
first. `eva-lpm` and anything else that needs to survive belongs on LocalLPM-sandbox instead (§8),
which the sync job has no way to reach at all.

## 6. Two accounts, not one: what a single-seeded-user dev workflow would miss

A second real gotcha from today's active migration work, and directly relevant to what "a working
local dev environment" actually needs to mean: two real bugs (a cross-project data leak on
`discussion_posts`, fixed in commit `c50b560`, and a role-display bug) only became visible when
testing as a *second*, non-owner user — the class of bug that a workflow with exactly one signed-in
test account structurally cannot catch, because "am I only seeing what I'm supposed to see" isn't
a question one account can ask.

LocalLPM's local auth config already makes this cheap to do right: `[auth.email]` in
`config.toml` has `enable_signup = true` and `enable_confirmations = false`, so creating a test
account locally is a plain email+password signup with no OAuth app, no email-confirmation click,
and no dependency on GitHub/Google credentials at all — the two OAuth providers OpenLPM ships
today aren't needed for local testing. `scripts/localLPM-setup.sh seed` creates two accounts by
default (promoting one to `admin`, per `SETUP_GUIDE.md`'s existing "set your own role to admin"
step, leaving the other as an ordinary `contributor`) specifically so that "does this feature leak
data or misrepresent role across users" is something the standard LocalLPM workflow can actually
exercise, not something that only gets caught when a second real person happens to be testing at
the same time. This is now the standing LocalLPM convention, not a one-off suggestion: a schema
or feature change tried on LocalLPM should be checked as both accounts before it's considered
ready to become a migration PR.

## 7. Pulling dev changes from LocalLPM into OpenLPM

This is the part Dustin specifically asked to have spelled out, and the design goal here is
narrow on purpose: **this should not be a new, custom sync mechanism.** It should be Supabase's
own standard, already-documented local-dev workflow, made official and written down for this repo
rather than invented. Concretely:

1. **Develop against LocalLPM.** Make schema changes directly against the running local Postgres
   instance — by hand in Studio, via `supabase db query`, or by writing and applying a scratch SQL
   file locally — however's fastest for the person doing the design work. Remember to
   `./scripts/localLPM-setup.sh pause` first (§5.7) if this instance's nightly sync is enabled and
   the work needs to survive more than one night. Nothing at this stage is a migration file yet;
   it's just the local database in whatever state makes the feature work.
2. **Capture the result as a migration.** Once the schema is in the shape it should be,
   `supabase db diff -f <descriptive_name>` (confirmed against the CLI actually installed here,
   `supabase 2.116.0`: `--file`/`-f` "names and saves the complete schema diff as a new migration")
   compares the local database against the existing migration history and writes a new,
   sequentially-numbered file straight into `supabase/migrations/` — the same mechanism
   `supabase db diff` has always existed for, not something built for LocalLPM specifically.
3. **That file goes through the exact same review process every other OpenLPM migration already
   goes through.** `CONTRIBUTING.md` already says code changes go through "a normal pull request."
   A new migration file is a normal code change in this repo like any other: it gets committed,
   pushed, opened as a PR, and reviewed before merging to `main` — with the `SET search_path =
   public, extensions;` line (§4) as one concrete, checkable thing a reviewer should look for on
   any new migration from here on.
4. **Only after that PR is merged does the migration get applied to the real shared instance.**
   Today, per `SETUP_GUIDE.md`, that step is manual: open the Supabase dashboard's SQL Editor and
   run the new file. That manual step doesn't change because LocalLPM exists — LocalLPM changes
   what happens *before* a migration file exists (real local iteration instead of editing
   production directly, or writing SQL from memory) but not what happens after one is merged. A
   natural, separate follow-on once the CLI is in regular local use is switching that manual step
   to `supabase link` + `supabase db push` instead of the dashboard SQL Editor — but that's an
   optional future improvement to how a merged migration gets applied, not something this design
   depends on or is trying to bundle in.
5. **Resume the sync afterward** (`./scripts/localLPM-setup.sh resume`) if it was paused for step
   1, so LocalLPM's dev-mirror instance goes back to tracking real production data rather than
   staying frozen on whatever the experiment left behind.

The net effect: "pull dev changes from LocalLPM into OpenLPM" is just OpenLPM's existing
migration-PR workflow, starting one step earlier — from a real running local database, now backed
by real production-shaped data (§5), instead of from a blank page. Nothing about review, ordering,
or how changes reach the shared instance changes.

## 8. `eva-lpm`: LocalLPM-sandbox's first real seeded project

`eva-lpm-self-hosted-prep.md` (branch `eva-lpm-self-hosted-prep`) already worked out why this
project cannot live in OpenLPM's shared production database: that database's real RLS policy on
`projects` is `auth.uid() IS NOT NULL` — any signed-up user of the shared service can see any
project's name and description, membership or not. There is no per-project privacy flag there.
`hosting_mode = 'self-hosted'` (a real column on `projects` since migration 004, `CHECK
(hosting_mode IN ('hosted', 'self-hosted'))`) is the schema's own designed-for-this escape hatch:
a project that needs to stay gated gets its own separate Supabase project instead of a row in the
shared one. That branch's document specced out what a future self-hosted instance would need to
be. **LocalLPM-sandbox is that instance** — specifically the sandbox instance, not LocalLPM's
dev-mirror one, precisely because `eva-lpm`'s content needs to be permanent and LocalLPM's
dev-mirror instance is, by design (§5.7), disposable. `docs/eva-lpm-self-hosted-prep.md` gets a
small follow-up edit to say so by name (see §13 — that edit lands on its own branch, not this one,
because `eva-lpm-self-hosted-prep` is checked out in another active worktree and this task
shouldn't touch it directly).

### Setting up LocalLPM-sandbox as a second local instance

Since this is a one-time setup rather than something needing daily automation, this is a short,
concrete manual procedure rather than a script (the same judgment call `scripts/localLPM-setup.sh`
itself makes for the higher-stakes, must-be-reliable sync job — automate what benefits from it,
document plainly what doesn't):

```bash
mkdir -p supabase-sandbox
cp supabase/config.toml supabase-sandbox/config.toml
# Edit supabase-sandbox/config.toml: change project_id to "openlpm-sandbox", and shift every
# port in the file by e.g. +100 (api 54421, db 54422, studio 54423, etc.) so both instances can
# run at the same time without conflicting.
ln -s ../supabase/migrations supabase-sandbox/migrations
# A symlink, not a copy -- this is the same "no second copy of anything" principle from §2, applied
# to LocalLPM-sandbox's own setup. There is exactly one supabase/migrations/ directory on disk.
supabase start --workdir supabase-sandbox --exclude realtime,storage-api,imgproxy,logflare,vector
```

`--workdir` is a real, documented global flag on this CLI (confirmed via `supabase --help`) for
pointing any command at a project directory other than the current one, which is what lets one
repo checkout run two independent local Supabase projects side by side. **This exact sequence
has not been run end to end** (no Docker available in the sandbox this was written from — see
§12), so whoever provisions this for real should treat it as a precise, reviewed plan and confirm
it works as described, in particular that the CLI actually follows the `migrations` symlink the
way a normal directory would; if it doesn't, the fallback is a real (small) copy of the migrations
directory kept manually in sync, which is worse but not fatal, since LocalLPM-sandbox's schema
only needs to change on the rare occasions someone deliberately updates it, not automatically.

### How the seeding actually happens

1. `supabase/migrations-draft/DRAFT-eva-lpm-self-hosted-seed.sql` (on `eva-lpm-self-hosted-prep`)
   is a target-shape sketch, not a script to run. Its own header says so directly — the real path
   is a signed-in maintainer creating the project through the app's actual "New Project" wizard
   (`src/pages/dashboard/new-project-wizard.tsx`) against LocalLPM-sandbox, the same way every
   other real OpenLPM project has ever been created, not a raw SQL insert.
2. That gives `eva-lpm` a real `projects` row with `hosting_mode: 'self-hosted'`,
   `epistemic_status: 'in-development'`, and the seven `project_source_declarations` rows (one per
   MPI-EVA department) the sketch describes.
3. Actual department content — theories, literature, topics — still requires the manual,
   curator-checked import pass the prep doc already calls for: `eva-graph/mpi-eva-graph/` is a
   private repo, so nothing about LocalLPM makes that import automatic. What LocalLPM-sandbox
   changes is *where* that curator does the import — against a real, private, permanent OpenLPM
   instance instead of nowhere, because nowhere is what existed before this task, and an instance
   that resets nightly (LocalLPM's dev-mirror one) would be actively wrong for this.

### The access-control question this raises, addressed directly rather than left implicit

The whole reason `eva-lpm` needs to be self-hosted is that OpenLPM's `projects` table makes a
project's existence and description visible to *any authenticated user of that instance*,
membership or not. LocalLPM-sandbox also serves Ask Eva's development (job 3), with a plausibly
different audience than `eva-lpm`'s own deliberately small, invited group — anyone doing Ask Eva
development work would, by that same RLS policy, be able to see that a project called `eva-lpm`
exists and read its name and description — not its actual content, which stays properly gated by
`project_members` — but more than zero.

In plain terms: this is fine, but only because LocalLPM-sandbox as a whole is never meant to be
something anyone can sign up for. It's not a second public service — it's reachable only to
people the lab has already decided should have a LocalLPM-sandbox account at all (whoever's
doing Ask Eva development, plus anyone explicitly invited for `eva-lpm`), not the general public
or OpenLPM's wider production user base. As long as that stays true — no open self-registration,
no public network exposure (§11) — sharing this one instance between the two purposes doesn't
reopen the privacy problem `eva-lpm-self-hosted-prep.md` identified; it just means "who gets a
LocalLPM-sandbox account" is the one access lever that matters for both purposes together. That
question — who specifically gets invited, and how accounts get created — was already flagged as
open in the prep doc's own "decisions still open" list (#3) and stays open here; this section
doesn't resolve it, only makes clear it now has one real, concrete place to be decided about.

## 9. How Ask Eva's development would actually use LocalLPM-sandbox

Ask Eva (`eva-graph/ask_eva/ask.py`) exists today as a standalone Python script, not a web app: it
loads a corpus from local files (`retrieval.py`'s `load_corpus()`, driven by an `ASK_EVA_LAB_ROOT`
environment variable pointing at sibling `conceptbase`/`eva-graph` checkouts), searches it, and
sends matched context to GWDG SAIA for a grounded answer. Its system prompt currently names five
sources: ConceptBase, the MPI-EVA Foyer Exhibit's project-planning data, `mpi-eva-graph`'s
per-department sub-units, its institute-level cross-department layer, and its field-sites data.
None of those five is a live database — all five are files read straight off disk. Today, Ask Eva
has nothing OpenLPM-shaped to point at all; LocalLPM-sandbox is what gives it something, and —
because that instance is never touched by the sync job (§1, §5.7) — something stable to keep
pointing at rather than data that resets nightly.

**The concrete, minimal-lift fit, given that existing architecture:** add a sixth source to
`retrieval.py`, following the same shape every existing source already follows (load real content,
tag it with a `source` and `status`, return it in the same `Item` list `search()` already works
over), except this loader queries LocalLPM-sandbox's REST API instead of reading a file. Two new
environment variables, read the same way `ASK_EVA_LAB_ROOT` already is:

```
LOCALLPM_SANDBOX_URL=http://127.0.0.1:54421
LOCALLPM_SANDBOX_SERVICE_ROLE_KEY=<from `supabase status --workdir supabase-sandbox` on the LocalLPM-sandbox host>
```

The **service-role key, not the anon key**, is the right choice here specifically, for a reason
worth stating rather than assuming: every real read in OpenLPM's schema requires
`auth.uid() IS NOT NULL` (migration `002_require_auth_for_reads.sql`) — there's no anonymous read
path at all, by design. Ask Eva's retrieval script is a trusted, server-side, human-triggered tool
(never a browser context, never shipped to any client), which is exactly the situation the
service-role key exists for: it bypasses RLS entirely, the way a trusted backend process is meant
to. It must never be the anon key (which is meant to be public and relies on RLS to be safe) and
must never leave this script's own local environment — the same discipline this repo's own
`.gitignore` already applies to `.supabase-secrets/`, and the same "human-triggered only, never a
scheduled job" discipline `ask.py`'s own docstring already states for every GWDG-touching call it
makes.

Once that loader exists, once `eva-lpm` is actually seeded onto LocalLPM-sandbox (§8), Ask Eva can
be asked a question and have it answered partly from real (if department-unreviewed) MPI-EVA
content that's actually sitting in a real OpenLPM-shaped project — theories, discussions,
notebooks — instead of only from the flat `mpi-eva-graph` files it reads today. That's the
concrete shape of "Ask Eva develops its own new capabilities against LocalLPM internally": not a
new capability framework, one more `Item`-shaped source feeding into the same
retrieval-then-synthesize pipeline that already exists, sourced from a live, private,
project-scoped OpenLPM instance instead of a static file tree.

A second, complementary option exists and is worth naming even though it isn't the one this
document recommends building first: exposing LocalLPM-sandbox as a new MCP tool (alongside the
`openevo` MCP server this very repo's own `.mcp.json` already points at,
`curriculum-agents/tools/openevo-mcp/server.py`), so that any Claude session — not just `ask.py`
specifically — could query it directly. That's a reasonable follow-on once the `retrieval.py` path
above is working and someone wants LocalLPM-sandbox data reachable from a live coding/research
session rather than only from Ask Eva's own script, but it's a second, later integration point,
not a substitute for the first one — `ask.py` doesn't go through MCP today at all, so extending
its own existing retrieval pipeline is the smaller, more natural change to make first.

## 10. Right-sizing the local stack(s) for a resource-constrained box

Checked directly rather than assumed: OpenLPM's application code does not call Supabase Storage or
Realtime anywhere (`grep -rl "\.storage\.\|\.channel(\|realtime" src` returns nothing), and calls
exactly one Edge Function (`sparql-proxy`, invoked from `src/lib/importers/fwuLehrplan.ts`). That
means several of the containers `supabase start` launches by default aren't doing anything for
this app: `realtime`, `storage-api`, `imgproxy` (image transforms for Storage, itself unused), and
the `logflare`/`vector` analytics-log pipeline (which OpenLPM's app never queries and which is
historically one of the heavier and more failure-prone pieces of the local stack).

The CLI already has a real, tested flag for this — `supabase start --exclude <names>` (confirmed
against the installed CLI's own `--help` output, container names:
`gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`).
The recommended invocation, for **either** instance:

```
supabase start --exclude realtime,storage-api,imgproxy,logflare,vector
```

This is a runtime flag, not a change to the committed `supabase/config.toml` — it doesn't affect
anyone else running plain `supabase start` for their own local dev elsewhere, only how LocalLPM
itself gets launched. `edge-runtime` stays (needed for `sparql-proxy`), as do
`gotrue`/`postgrest`/`kong`/`postgres-meta`/`studio`/`mailpit` (auth, the REST API the app
actually talks to, the API gateway, Studio's schema introspection, Studio's UI, and local
email-testing for auth flows respectively — all either directly used or cheap enough to keep for
visibility). `supavisor` (the connection pooler) is left in rather than guessed about: `db.pooler`
is already `enabled = false` in `config.toml`, and nothing in this investigation confirmed whether
excluding the container too is safe, so this document doesn't recommend a change here it can't
back with a checked answer.

**On running two instances:** LocalLPM and LocalLPM-sandbox roughly double the container footprint
if both happen to be up at once, which matters on a box with about 11.8GB free. In practice they
shouldn't need to be simultaneously: LocalLPM-sandbox, once `eva-lpm` is seeded, changes rarely —
only when someone is specifically doing `eva-lpm` curation or Ask Eva development — and can sit
stopped the rest of the time, same posture as LocalLPM's own dev-mirror instance (§11). The two
being separate processes with separate up/down control is itself part of why this stays
manageable: neither has to run just because the other is running.

## 11. Staying on-demand, not always-on (with one deliberate exception)

The home server has already had to walk back one round of self-hosted tooling (NoCoDB, Grist,
Lens) that ended up running with unclear ownership and no real use. LocalLPM is designed
specifically not to repeat that: it has a clear name, a clear three-part purpose (§1), and a clear
dependency story (§4, §5, §8, §9 each name exactly what depends on it and how). The remaining thing
worth being deliberate about is *how it runs day to day*, given the box's own stated preference for
on-demand processes over always-on ones and its existing pattern for that
(`memo-server`/`ask-eva`'s own launcher-page convention: a person starts it when it's needed,
rather than it running continuously in the background).

`supabase start` itself is a one-shot command — it launches a set of Docker containers and
returns; those containers then keep running under Docker until `supabase stop` is run, independent
of any wrapping process. That means "systemd wrapping" for both LocalLPM instances' compute is
naturally a thin, on-demand wrapper around that start/stop pair, not a long-running always-on
service:

- A systemd **user-level oneshot unit** (not `Restart=always`, not enabled at boot) that runs
  `supabase start` on activation, for each instance — see `scripts/localLPM-setup.sh systemd` for
  the concrete unit content.
- A matching **stop unit** running `supabase stop` to tear it back down — reclaiming the RAM the
  stack uses when nobody's actively doing instance-dependent work.

Neither compute instance should be enabled at boot or left running continuously — "is LocalLPM
currently running" should be a normal, expected state to toggle, the same posture
`memo-server`/`ask-eva` already use for a dev-facing tool on the same box. The **one deliberate
exception** is the production-data sync job itself (§5.6): that one legitimately runs on an
unattended systemd timer, because a backup that only happens when someone remembers to trigger it
by hand isn't the "reliable" Dustin explicitly asked for, and the sync script itself is written to
start and stop LocalLPM's dev-mirror compute around itself rather than requiring it to be
always-on just to receive nightly updates (§5.6, steps 1–4).

## 12. What was actually verified from here, and what wasn't

This task's own instructions asked for real validation over an untested plan wherever possible.
Here's exactly what that produced, run from this worktree (`D:\dev\openevo-ccs-lab\openlpm\.claude\worktrees\agent-a5c0cab7e5d798c89`,
Windows, not the actual home server):

- **Supabase CLI: present and working.** `supabase --version` → `2.116.0` (a Node-portable install
  already on this machine's PATH). `supabase status --help`, `supabase start --help`,
  `supabase db diff --help`, `supabase db dump --help`, `supabase link --help`, and
  `supabase db pull --help` were all run for real and their output is what this document's flag
  names and command shapes (§3, §5, §7, §10) are drawn from — not guessed at.
- **Docker/Podman: absent here.** Running `supabase start` for real, from this repo's actual
  `supabase/config.toml` and its actual `supabase/migrations/`, produced a clean, specific failure
  rather than a hang or a vague error: `{"_tag":"Error","error":{"code":"LegacyDockerLifecycleInspectError","message":"failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH"}}`.
  That's the CLI correctly detecting there's no container runtime available in this sandbox and
  stopping immediately rather than doing anything destructive. It's real, useful signal about this
  environment specifically (a Windows agent worktree, not provisioned for Docker) — it says
  nothing about whether the home server's own Docker setup will work, which is untested from here
  and needs to be the first thing checked on the actual box (`scripts/localLPM-setup.sh check`
  does exactly that).
- **Not verified, because Docker wasn't available to verify it with:** the actual migration run
  against a live local Postgres, the `uuid-ossp` schema-location check (§4), the two-test-account
  seeding flow (§6), the entire dump/validate/promote/restore sync cycle (§5) including whether the
  canary row-count check behaves as described against real data, the `--workdir`-based
  second-instance setup (§8) including whether the CLI actually follows a symlinked migrations
  directory, Studio actually rendering, and the REST API actually answering queries. All of these
  are real steps in `scripts/localLPM-setup.sh`, written precisely enough to run for real, but none
  of them have actually been run. Whoever provisions this on the home server should treat the
  script and this document as a reviewed, concrete plan, not as something already proven to work
  end to end — the `--workdir` symlink mechanism in §8 specifically is the single least-certain
  piece of this whole design and deserves a deliberate smoke test before `eva-lpm` or any other
  real content goes anywhere near it.
- **Not created, and explicitly out of scope for this task:** the `locallpm_backup_reader`
  read-only role on the real shared production database (§5.2). This requires real admin access
  to that database that this task doesn't have and wasn't meant to obtain.

## 13. What this document does *not* do

- It does not provision anything on the actual home server. A different team owns that execution;
  this document and `scripts/localLPM-setup.sh` are the spec handed to them.
- It does not create the read-only production database role the sync job depends on (§5.2) — a
  real prerequisite for whoever has actual admin access to the shared production database.
- It does not touch `eva-lpm-self-hosted-prep`. That branch is checked out in another active
  worktree, so this task's edit to `docs/eva-lpm-self-hosted-prep.md` (naming LocalLPM-sandbox
  concretely, per §8) lands on its own small companion branch, `eva-lpm-self-hosted-prep-localLPM-update`,
  built off `origin/eva-lpm-self-hosted-prep`, ready to merge into that branch rather than into
  this one.
- It does not run any migration against the real shared instance, does not dump or otherwise touch
  the real shared production database, and does not touch the ongoing Theories/Strands/Discussions
  migration work another session is doing in parallel — this document is careful throughout (§4)
  not to name a fixed migration count anywhere that would go stale.
- It does not decide who gets a LocalLPM or LocalLPM-sandbox account. §8 names that as the one real
  open access-control question this design surfaces, with a recommended posture (no public
  self-registration, ever), but the actual invite list is Dustin's call, not this document's.

## Real decisions still open (for Dustin / whoever provisions this)

Kept short and in plain terms, per the standing rule that infrastructure/schema calls get made
directly in this document and only genuine judgment calls get surfaced:

1. **Who gets a login on LocalLPM and LocalLPM-sandbox, and how.** Not resolved here — see §8.
   The recommendation is: no public sign-up, ever, on either instance; accounts created or invited
   by hand. The actual list of names is a real decision, not a technical one.
2. **Home-server access control around the backup directory specifically**, once real user data
   (if OpenLPM has any signed-up users beyond this lab by the time the sync goes live) starts
   accumulating there nightly (§5.5). This task flags it; it doesn't own home-server access control
   and can't resolve it.
3. **Whether/when to switch the shared instance's migration-apply step from the manual Supabase
   dashboard SQL Editor to `supabase link` + `supabase db push`** (§7, step 4) now that the CLI is
   in real local use for LocalLPM. Not required for LocalLPM to work, genuinely optional, worth
   revisiting once LocalLPM has been in use for a while.
4. **When MPI-EVA department content (`eva-lpm`) should ever be shown beyond a small trusted
   group, even gated** — this is `eva-lpm-self-hosted-prep.md`'s own open question #1, unchanged
   by LocalLPM existing. LocalLPM-sandbox makes gating *possible*; it doesn't make the content
   department-reviewed.
