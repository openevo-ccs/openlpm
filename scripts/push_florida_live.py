#!/usr/bin/env python3
"""
One-shot, safe push of florida-lpm into the live OpenLPM Supabase database.

Written because the live write itself is blocked from inside a Claude Code
session (a harness-level permission classifier denies direct Supabase writes
-- confirmed, not a bug to work around), so this needs to be run by hand. It
does three things in order, stopping immediately if any step fails, so a
single command gives a real go/no-go answer instead of three separate manual
steps:

  1. VALIDATE  -- runs florida-lpm's own scripts/validate_records.py. Refuses
     to continue if any record fails schema validation, has a dangling
     cross-reference, or duplicates an id.
  2. APPLY     -- runs scripts/import_curriculum_repository.py --apply, which
     upserts all records for ALL configured repos (deutsche-lpm, nys-lpm,
     india-lpm, florida-lpm) -- same as every previous run of that script;
     this is additive/idempotent (upsert on source_repo+source_record_id),
     never deletes anything.
  3. VERIFY    -- queries the live database directly afterward and prints the
     real row count for the florida-curriculum-repository project, broken
     down by record_type, so success is confirmed by checking the database's
     own state, not by trusting the apply step's exit code alone.

Usage (from the openlpm/ directory):
    python scripts/push_florida_live.py
    python scripts/push_florida_live.py --skip-validate   # only if you already just validated
    python scripts/push_florida_live.py --dry-run         # steps 1 and 3 only, step 2 stays a dry run

Safe to re-run. Exits non-zero on any failure, with a clear message about
which step failed and why.
"""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FLORIDA_LPM = ROOT / "curriculum-sources" / "florida-lpm"


def run(cmd, cwd):
    print(f"\n$ {' '.join(cmd)}  (in {cwd})")
    result = subprocess.run(cmd, cwd=cwd)
    return result.returncode


def load_service_role_key():
    import os
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env.strip()
    secret_path = ROOT / ".supabase-secrets" / "service-role-key.txt"
    if secret_path.exists():
        return secret_path.read_text().strip()
    return None


def verify_live():
    import requests
    key = load_service_role_key()
    if not key:
        print("\nVERIFY step skipped: no service_role key found "
              f"(expected at {ROOT / '.supabase-secrets' / 'service-role-key.txt'} "
              "or $SUPABASE_SERVICE_ROLE_KEY).")
        return False

    supabase_url = "https://tfynvjjxyluzorigyfsp.supabase.co"
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    projects = requests.get(
        f"{supabase_url}/rest/v1/projects",
        headers=headers,
        params={"slug": "eq.florida-curriculum-repository", "select": "id,name,slug"},
    )
    if not projects.ok:
        print(f"\nVERIFY step failed: GET projects -> {projects.status_code} {projects.text}")
        return False
    rows = projects.json()
    if not rows:
        print("\nVERIFY FAILED: no project with slug 'florida-curriculum-repository' exists live. "
              "The apply step did not create it (or failed silently) -- check the APPLY output above.")
        return False
    project = rows[0]
    print(f"\nVERIFY: project exists live -> id={project['id']} name={project['name']!r}")

    records = requests.get(
        f"{supabase_url}/rest/v1/curriculum_repository_records",
        headers=headers,
        params={"project_id": f"eq.{project['id']}", "select": "record_type"},
    )
    if not records.ok:
        print(f"\nVERIFY step failed: GET curriculum_repository_records -> {records.status_code} {records.text}")
        return False
    rows = records.json()
    by_type = {}
    for r in rows:
        by_type[r["record_type"]] = by_type.get(r["record_type"], 0) + 1
    print(f"VERIFY: {len(rows)} records live under this project:")
    for t, n in sorted(by_type.items()):
        print(f"   {t:30s} {n}")
    expected_types = {
        "coherence-finding-record", "curriculum-crosswalk-record",
        "institutional-actor-record", "institutional-mandate-record",
        "policy-controversy-record", "policy-principle-record",
        "policy-timeline-event",
    }
    missing = expected_types - set(by_type)
    if missing:
        print(f"\nVERIFY WARNING: expected record types not found live: {sorted(missing)} "
              "-- check the APPLY output above for a silent skip.")
        return False
    print("\nVERIFY OK -- all 7 expected record types are present live.")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-validate", action="store_true", help="Skip step 1 (only if you just validated)")
    ap.add_argument("--dry-run", action="store_true", help="Run steps 1 and 3 only; step 2 stays a dry run (no live write)")
    args = ap.parse_args()

    if not args.skip_validate:
        print("=== STEP 1/3: VALIDATE florida-lpm's own records ===")
        rc = run([sys.executable, "scripts/validate_records.py"], cwd=FLORIDA_LPM)
        if rc != 0:
            sys.exit(f"\nABORTED: validate_records.py failed (exit {rc}). Fix the reported issue(s) before pushing live.")
    else:
        print("=== STEP 1/3: VALIDATE skipped (--skip-validate) ===")

    print("\n=== STEP 2/3: APPLY (writes to the live Supabase database) ===")
    apply_cmd = [sys.executable, "scripts/import_curriculum_repository.py"]
    if not args.dry_run:
        apply_cmd.append("--apply")
    apply_cmd += ["--owner-email", "dustin.eirdosh@eva.mpg.de"]
    rc = run(apply_cmd, cwd=ROOT)
    if rc != 0:
        sys.exit(f"\nABORTED: import_curriculum_repository.py failed (exit {rc}). "
                  "Nothing further will run -- see its own output above for the cause.")

    print("\n=== STEP 3/3: VERIFY against the live database ===")
    if args.dry_run:
        print("(--dry-run was set, so nothing was actually written -- verify would only confirm "
              "whether a PREVIOUS live push already succeeded, not this run.)")
    ok = verify_live()
    if not ok and not args.dry_run:
        sys.exit("\nFAILED: the push ran, but live verification did not find what was expected. "
                  "Do not assume this worked -- check the output above.")

    print("\nDone.")


if __name__ == "__main__":
    main()
