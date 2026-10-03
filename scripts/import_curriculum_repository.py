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
        # 2026-10-02: the 3 states with real, deep research (same 6 KoMet
        # subjects checked in each, already directly compared against each
        # other) get their own real sub-project, matching how New York
        # already works -- a record whose inferred jurisdiction is EXACTLY
        # one of these keys (a clean single-state tag, not a multi-state
        # comparison) is routed there instead of staying on the flat
        # national project. The other 13 states stay jurisdiction-tagged
        # inside the national project for now (background depth only,
        # per deutsche_lp/README.md) -- splitting them out is real future
        # work, not attempted here.
        "state_projects": {
            "DE-SN": {"slug": "saxony-curriculum-repository", "name": "Saxony Curriculum Repository", "region_tags": ["DE-SN"]},
            "DE-TH": {"slug": "thuringia-curriculum-repository", "name": "Thuringia Curriculum Repository", "region_tags": ["DE-TH"]},
            "DE-ST": {"slug": "saxony-anhalt-curriculum-repository", "name": "Saxony-Anhalt Curriculum Repository", "region_tags": ["DE-ST"]},
        },
    },
    "nys-lpm": {
        "path": LAB_ROOT / "nys_lp",  # same pending local rename as deutsche_lp
        "project_slug": "new-york-curriculum-repository",
        "project_name": "New York Curriculum Repository",
        "region_tags": ["US-NY"],
        "default_jurisdiction": "US-NY",
    },
    "india-lpm": {
        "path": LAB_ROOT / "india_lp",
        "project_slug": "india-curriculum-repository",
        "project_name": "India Curriculum Repository",
        "region_tags": ["IN"],
        "default_jurisdiction": "IN",
        # Karnataka (confirmed CC BY-SA 4.0 -- safe to build out in real
        # depth), Maharashtra (restrictive -- deliberately kept thin,
        # institutional-actor-level only), and Kerala (restrictive but
        # uncontested -- added 2026-10-02 at a partner's request, also kept
        # to structural/citation-level detail, no quoted textbook text)
        # all get real sub-projects, per Dustin's 2026-10-02 calls -- the
        # access-tier model doing its job across three real, different
        # cases, not a gap to fix later.
        "state_projects": {
            "IN-KA": {"slug": "karnataka-curriculum-repository", "name": "Karnataka Curriculum Repository", "region_tags": ["IN-KA"]},
            "IN-MH": {"slug": "maharashtra-curriculum-repository", "name": "Maharashtra Curriculum Repository", "region_tags": ["IN-MH"]},
            "IN-KL": {"slug": "kerala-curriculum-repository", "name": "Kerala Curriculum Repository", "region_tags": ["IN-KL"]},
        },
    },
}

GERMAN_STATE_ISO = {
    "baden_wuerttemberg": "DE-BW", "bayern": "DE-BY", "berlin": "DE-BE",
    "brandenburg": "DE-BB", "bremen": "DE-HB", "hamburg": "DE-HH",
    "hessen": "DE-HE", "mecklenburg_vorpommern": "DE-MV", "niedersachsen": "DE-NI",
    "nordrhein_westfalen": "DE-NW", "rheinland_pfalz": "DE-RP", "saarland": "DE-SL",
    "sachsen": "DE-SN", "sachsen-anhalt": "DE-ST", "schleswig_holstein": "DE-SH",
    "thuringia": "DE-TH",
}

INDIA_STATE_ISO = {
    "karnataka": "IN-KA", "maharashtra": "IN-MH", "kerala": "IN-KL",
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
    # Collect every jurisdiction/jurisdictionScope tag found ANYWHERE in the
    # record, not just a top-level field. This matters a lot in practice:
    # coherence-finding/latent-connection/synthetic-curriculum-redesign
    # records (deutsche_lp's richest, most distinctive content) carry no
    # top-level jurisdiction field at all -- only per-grounding-object tags
    # nested under `objects`/`groundedIn`-shaped arrays -- so the original
    # top-level-only check silently fell through to `default_jurisdiction`
    # ("DE") for every one of them, regardless of which state they were
    # actually about. Reuses find_recursive, the same helper already used
    # for accessTier/licenseOrRightsNote, for the same reason: a record is
    # only correctly describable by what's really inside it, not by whether
    # a tag happens to sit at the top level or several layers down.
    found = set()
    for key in ("jurisdiction", "jurisdictionScope"):
        for value in find_recursive(record, key):
            if isinstance(value, list):
                found.update(v for v in value if isinstance(v, str) and v)
            elif isinstance(value, str) and value:
                found.add(value)
    if found:
        # A single distinct tag -> a genuine single-jurisdiction record,
        # returned as-is. Two or more -> a genuine cross-jurisdiction
        # comparison (e.g. a Sachsen/Sachsen-Anhalt/Thueringen three-way
        # finding) -- joined, sorted for determinism, deliberately left
        # unable to exact-match any single state_projects key, so it stays
        # on the national project rather than being misfiled under just one
        # of the states it's actually comparing.
        return ", ".join(sorted(found))
    parts = file_path.parts
    if "land" in parts:
        state = parts[parts.index("land") + 1]
        if state in GERMAN_STATE_ISO:
            return GERMAN_STATE_ISO[state]
    if "state" in parts:
        state = parts[parts.index("state") + 1]
        if state == "ny":
            return "US-NY"
        if state in INDIA_STATE_ISO:
            return INDIA_STATE_ISO[state]
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


def effective_state_key(jurisdiction, default_jurisdiction):
    """Reduces a (possibly comma-joined) jurisdiction tag to a single
    state_projects routing key, where that's actually what the record is
    about. A record tagged only the bare national default alongside one
    real state (e.g. "IN, IN-KL" -- a national-vs-one-state comparison) is
    routed to that one state: the national side is context/baseline, not a
    second peer being compared, the same way this repo's own Karnataka
    coherence-finding keeps NCERT in prose rather than as a competing
    jurisdiction. A genuine multi-STATE comparison (e.g. "DE-SN, DE-ST,
    DE-TH", no bare national code involved) has no single reduction and
    stays at the national project, since picking one state would misfile
    a comparison that is genuinely about several.
    """
    parts = [p.strip() for p in jurisdiction.split(",")]
    non_national = [p for p in parts if p != default_jurisdiction]
    if len(non_national) == 1:
        return non_national[0]
    return jurisdiction


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
        jur_counts = {}
        for r in records:
            jur_counts[r["jurisdiction"]] = jur_counts.get(r["jurisdiction"], 0) + 1
        print(f"  jurisdictions: {dict(sorted(jur_counts.items(), key=lambda kv: -kv[1]))}")
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


def upsert_records(key, records):
    # 2026-10-03: lowered from 200 after a real, reproducible failure --
    # Germany's 95-record national batch (sent as one single request at
    # CHUNK=200, since 95 < 200) consistently failed with a 401 "Invalid
    # API key" error, 3 times in a row at the exact same point, while a
    # tiny single-record write to the same table succeeded immediately
    # after. Some of these records carry a lot of text (full policy-brief
    # write-ups, multi-paragraph excerpts), so the combined payload for a
    # 95-record batch can be large. A request that size being rejected by
    # something ahead of the actual database logic (a gateway/edge layer),
    # with a misleading generic auth-shaped error instead of a clear "too
    # large" one, is a known failure shape for exactly this kind of setup
    # -- smaller batches cost nothing (still one script run, just more
    # requests) and directly test/avoid that.
    CHUNK = 20
    for i in range(0, len(records), CHUNK):
        chunk = records[i:i + CHUNK]
        rest(
            "POST", "curriculum_repository_records", key,
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            params={"on_conflict": "source_repo,source_record_id"},
            json=chunk,
        )
        print(f"  upserted {i + len(chunk)}/{len(records)}")


def apply_import(by_repo, owner_email):
    key = load_service_role_key()
    owner = rest("GET", f"users?email=eq.{owner_email}&select=id", key)
    if not owner:
        sys.exit(f"No OpenLPM user found with email {owner_email} -- create/confirm the account first.")
    owner_id = owner[0]["id"]

    # 2026-10-02: no more shared "Curriculum Repositories" hub project --
    # migration 081 already retired that (feedback 283570ae: nations are
    # real top-level entries, states nest under their own nation, not under
    # a generic hub). Each repo's main project is created top-level
    # (parent_project_id left unset/null) to match; get_or_create_project
    # only INSERTs when a slug is genuinely new, so this is a no-op for
    # germany-curriculum-repository/new-york-curriculum-repository, which
    # already exist live with parent_project_id already fixed by 081.
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
                "project_kind": "curriculum-repository",
            }, owner_id,
        )
        print(f"{cfg['project_name']}: {project_id}")

        state_projects = cfg.get("state_projects", {})
        national_records = []
        state_records = {}  # jurisdiction key -> list of records
        for r in records:
            key = effective_state_key(r["jurisdiction"], cfg["default_jurisdiction"])
            state_cfg = state_projects.get(key)
            if state_cfg:
                state_records.setdefault(key, []).append(r)
            else:
                national_records.append(r)

        for r in national_records:
            r["project_id"] = project_id
        if national_records:
            upsert_records(key, national_records)

        for jurisdiction, state_cfg in state_projects.items():
            recs = state_records.get(jurisdiction, [])
            if not recs:
                print(f"  {state_cfg['name']}: no records with jurisdiction == {jurisdiction!r}, skipping")
                continue
            state_project_id = get_or_create_project(
                key, state_cfg["slug"], {
                    "name": state_cfg["name"],
                    "epistemic_status": "field-validated-curriculum",
                    "epistemic_status_note": "Real, sourced curriculum-policy material; individual records carry their own verificationStatus/review_status for finer-grained trust.",
                    "is_private": True,
                    "focus_type": "regional",
                    "region_tags": state_cfg["region_tags"],
                    "parent_project_id": project_id,
                    "project_kind": "curriculum-repository",
                }, owner_id,
            )
            print(f"  {state_cfg['name']}: {state_project_id} ({len(recs)} records)")
            for r in recs:
                r["project_id"] = state_project_id
            upsert_records(key, recs)


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
