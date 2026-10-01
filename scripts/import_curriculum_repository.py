#!/usr/bin/env python3
"""Imports deutsche-lpm/nys-lpm curriculum-policy records into OpenLPM's
Curriculum Repository tables (see supabase/migrations/066_curriculum_repository.sql).

Written in Python rather than matching this folder's usual .mjs convention
deliberately -- the source repos' own record tooling (validate_records.py)
already uses PyYAML, and the records' real complexity (folded scalars,
YAML anchors, deeply nested per-object accessTier fields) is safer to parse
with a proven library than to add a new Node dependency just for a one-off
import. Everything downstream is plain REST against Supabase's PostgREST
API, same credential-loading convention as resolve_feedback.mjs/
pull_feedback.mjs (service_role key from .supabase-secrets/service-role-key.txt
or $SUPABASE_SERVICE_ROLE_KEY).

Each of the 9 deutsche-lpm/nys-lpm record schemas names its record_type via
its own file-level `$schema:` pointer (e.g.
`../../../schema/policy-timeline-event.schema.json` -> "policy-timeline-event"),
so record_type is read off that rather than guessed from folder names.
`accessTier`/`licenseOrRightsNote` live at different nesting depths
depending on record type (top-level on policy-timeline-event and
institutional-mandate-record; nested per grounding-object on
coherence-finding/latent-connection/synthetic-curriculum-redesign-record;
absent entirely on types that carry no quoted source text). This walks the
whole record recursively and takes the MOST CONSERVATIVE tier found
anywhere in it -- a record is only as safe as its most exposed fragment.
A record with no accessTier anywhere defaults to 'citation-only', the
safest tier, matching this migration's own column default.

Usage:
    python scripts/import_curriculum_repository.py                  # dry run (default) -- parses everything, writes a preview JSON, touches nothing live
    python scripts/import_curriculum_repository.py --apply           # actually creates the 3 projects + upserts every record, live
    python scripts/import_curriculum_repository.py --apply --owner-email you@example.org

Safe to re-run: records upsert on (source_repo, source_record_id), so a
second run after a source repo is edited just updates existing rows rather
than duplicating them.
"""
import argparse
import json
import os
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LAB_ROOT = ROOT.parent
SUPABASE_URL = "https://tfynvjjxyluzorigyfsp.supabase.co"

ACCESS_TIER_ORDER = ["full-text-stored", "excerpt-only", "summary-only", "citation-only"]

REPOS = {
    "deutsche-lpm": {
        "path": LAB_ROOT / "deutsche_lp",  # local folder rename still pending (file lock) -- GitHub side already renamed
        "project_slug": "germany-curriculum-repository",
        "project_name": "Germany Curriculum Repository",
        "region_tags": ["DE"],
        "default_jurisdiction": "DE",
    },
    "nys-lpm": {
        "path": LAB_ROOT / "nys_lp",  # same pending local rename as deutsche_lp
        "project_slug": "new-york-curriculum-repository",
        "project_name": "New York Curriculum Repository",
        "region_tags": ["US-NY"],
        "default_jurisdiction": "US-NY",
    },
}

PARENT_PROJECT = {
    "slug": "curriculum-repositories",
    "name": "Curriculum Repositories",
    "description": (
        "Curated national/regional curriculum-policy source material, ported from "
        "the deutsche-lpm/nys-lpm (and future india-lpm) sibling repos, browsable by "
        "invited OpenLPM users and linkable from any LPM project's own content."
    ),
}

GERMAN_STATE_ISO = {
    "baden_wuerttemberg": "DE-BW", "bayern": "DE-BY", "berlin": "DE-BE",
    "brandenburg": "DE-BB", "bremen": "DE-HB", "hamburg": "DE-HH",
    "hessen": "DE-HE", "mecklenburg_vorpommern": "DE-MV", "niedersachsen": "DE-NI",
    "nordrhein_westfalen": "DE-NW", "rheinland_pfalz": "DE-RP", "saarland": "DE-SL",
    "sachsen": "DE-SN", "sachsen-anhalt": "DE-ST", "schleswig_holstein": "DE-SH",
    "thuringia": "DE-TH",
}


def load_service_role_key():
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env.strip()
    secret_path = ROOT / ".supabase-secrets" / "service-role-key.txt"
    if secret_path.exists():
        return secret_path.read_text().strip()
    sys.exit(
        f"No service_role key found.\n\n"
        f"Get it once from the Supabase dashboard -> Project Settings -> API -> "
        f"\"service_role\" secret key, then either save it to {secret_path} or set "
        f"SUPABASE_SERVICE_ROLE_KEY for this one run."
    )


def infer_jurisdiction(record, file_path, default_jurisdiction):
    if record.get("jurisdiction"):
        return record["jurisdiction"]
    scope = record.get("jurisdictionScope")
    if isinstance(scope, list) and scope:
        return ", ".join(scope)
    if isinstance(scope, str) and scope:
        return scope
    parts = file_path.parts
    if "land" in parts:
        state = parts[parts.index("land") + 1]
        if state in GERMAN_STATE_ISO:
            return GERMAN_STATE_ISO[state]
    if "state" in parts:
        state = parts[parts.index("state") + 1]
        if state == "ny":
            return "US-NY"
    return default_jurisdiction


def find_recursive(obj, key):
    """Yields every value found anywhere under `key` in a nested dict/list."""
    if isinstance(obj, dict):
        if key in obj and obj[key]:
            yield obj[key]
        for v in obj.values():
            yield from find_recursive(v, key)
    elif isinstance(obj, list):
        for item in obj:
            yield from find_recursive(item, key)


def most_conservative_tier(tiers):
    if not tiers:
        return "citation-only"
    # ACCESS_TIER_ORDER is already most-permissive -> least-permissive;
    # the record's overall tier is the LEAST permissive tier found anywhere
    # in it, since any one over-exposed fragment makes the whole record
    # only as safe as that fragment.
    return max(tiers, key=lambda t: ACCESS_TIER_ORDER.index(t) if t in ACCESS_TIER_ORDER else len(ACCESS_TIER_ORDER))


def record_type_from_schema_ref(schema_ref):
    if not schema_ref:
        return None
    name = Path(schema_ref).name  # e.g. "policy-timeline-event.schema.json"
    if name.endswith(".schema.json"):
        return name[: -len(".schema.json")]
    return None


def parse_file(file_path, source_repo, default_jurisdiction, warnings):
    try:
        doc = yaml.safe_load(file_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        warnings.append(f"{file_path}: YAML parse error: {e}")
        return []
    if not isinstance(doc, dict):
        warnings.append(f"{file_path}: top-level is not a mapping, skipped")
        return []

    record_type = record_type_from_schema_ref(doc.get("$schema"))
    if not record_type:
        warnings.append(f"{file_path}: no resolvable $schema, skipped")
        return []

    list_keys = [k for k, v in doc.items() if k != "$schema" and isinstance(v, list)]
    if len(list_keys) != 1:
        warnings.append(f"{file_path}: expected exactly one list-valued key, found {list_keys or 'none'}, skipped")
        return []
    records = doc[list_keys[0]]

    out = []
    for r in records:
        if not isinstance(r, dict) or "id" not in r or "label" not in r:
            warnings.append(f"{file_path}: a record is missing id/label, skipped: {str(r)[:80]}")
            continue
        tiers = list(find_recursive(r, "accessTier"))
        notes = list(find_recursive(r, "licenseOrRightsNote"))
        out.append({
            "project_id": None,  # filled in once the target project exists
            "record_type": record_type,
            "jurisdiction": infer_jurisdiction(r, file_path, default_jurisdiction),
            "source_repo": source_repo,
            "source_record_id": r["id"],
            "title": r["label"],
            "content": r,
            "access_tier": most_conservative_tier(tiers),
            "license_or_rights_note": notes[0] if notes else None,
        })
    return out


def collect_all():
    warnings = []
    by_repo = {}
    for source_repo, cfg in REPOS.items():
        repo_path = cfg["path"]
        if not repo_path.exists():
            warnings.append(f"{repo_path} does not exist -- skipping {source_repo} entirely")
            by_repo[source_repo] = []
            continue
        files = sorted(repo_path.glob("**/records/*.yaml"))
        records = []
        for f in files:
            records.extend(parse_file(f, source_repo, cfg["default_jurisdiction"], warnings))
        by_repo[source_repo] = records
    return by_repo, warnings


def summarize(by_repo):
    for source_repo, records in by_repo.items():
        print(f"\n{source_repo}: {len(records)} records")
        by_type = {}
        for r in records:
            by_type.setdefault(r["record_type"], 0)
            by_type[r["record_type"]] += 1
        for t, n in sorted(by_type.items()):
            print(f"  {t:35s} {n}")
        tier_counts = {}
        for r in records:
            tier_counts[r["access_tier"]] = tier_counts.get(r["access_tier"], 0) + 1
        print(f"  access tiers: {tier_counts}")


def rest(method, path, key, **kwargs):
    import requests
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        **kwargs.pop("headers", {}),
    }
    res = requests.request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, **kwargs)
    if not res.ok:
        sys.exit(f"{method} {path} failed: {res.status_code} {res.text}")
    return res.json() if res.text else None


def get_or_create_project(key, slug, fields, owner_user_id):
    existing = rest("GET", f"projects?slug=eq.{slug}&select=id", key)
    if existing:
        return existing[0]["id"]
    created = rest(
        "POST", "projects", key,
        headers={"Prefer": "return=representation"},
        json={"slug": slug, "created_by": owner_user_id, **fields},
    )
    # No explicit project_members insert here: the on_project_created trigger
    # (004_projects_branches_portfolios.sql) already auto-enrolls created_by
    # as owner. Confirmed live -- an explicit insert here 409s on the
    # trigger's own row.
    return created[0]["id"]


def apply_import(by_repo, owner_email):
    key = load_service_role_key()
    owner = rest("GET", f"users?email=eq.{owner_email}&select=id", key)
    if not owner:
        sys.exit(f"No OpenLPM user found with email {owner_email} -- create/confirm the account first.")
    owner_id = owner[0]["id"]

    parent_id = get_or_create_project(
        key, PARENT_PROJECT["slug"], key_fields := {
            "name": PARENT_PROJECT["name"],
            "description": PARENT_PROJECT["description"],
            "epistemic_status": "field-validated-curriculum",
            "epistemic_status_note": "Real, sourced curriculum-policy material; individual records carry their own verificationStatus/review_status for finer-grained trust.",
            "is_private": True,
            "focus_type": "regional",
        }, owner_id,
    )
    print(f"Parent project 'Curriculum Repositories': {parent_id}")

    for source_repo, cfg in REPOS.items():
        records = by_repo.get(source_repo, [])
        if not records:
            print(f"Skipping {source_repo}: no records parsed")
            continue
        project_id = get_or_create_project(
            key, cfg["project_slug"], {
                "name": cfg["project_name"],
                "epistemic_status": "field-validated-curriculum",
                "epistemic_status_note": "Real, sourced curriculum-policy material; individual records carry their own verificationStatus/review_status for finer-grained trust.",
                "is_private": True,
                "focus_type": "regional",
                "region_tags": cfg["region_tags"],
                "parent_project_id": parent_id,
            }, owner_id,
        )
        print(f"{cfg['project_name']}: {project_id}")
        for r in records:
            r["project_id"] = project_id

        CHUNK = 200
        for i in range(0, len(records), CHUNK):
            chunk = records[i:i + CHUNK]
            rest(
                "POST", "curriculum_repository_records", key,
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": "source_repo,source_record_id"},
                json=chunk,
            )
            print(f"  upserted {i + len(chunk)}/{len(records)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually write to Supabase (default is dry-run)")
    ap.add_argument("--owner-email", default="dustin.eirdosh@eva.mpg.de", help="Real OpenLPM account to own the new project spaces")
    ap.add_argument("--preview-out", default=str(ROOT / "scripts" / "curriculum_repository_preview.json"))
    args = ap.parse_args()

    by_repo, warnings = collect_all()
    summarize(by_repo)

    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  {w}")

    if not args.apply:
        preview = {k: v for k, v in by_repo.items()}
        Path(args.preview_out).write_text(json.dumps(preview, indent=2, default=str), encoding="utf-8")
        print(f"\nDry run only -- nothing written to Supabase. Full preview: {args.preview_out}")
        print("Re-run with --apply to actually create the project spaces and upsert these records.")
        return

    apply_import(by_repo, args.owner_email)
    print("\nDone.")


if __name__ == "__main__":
    main()
