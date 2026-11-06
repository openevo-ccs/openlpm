#!/usr/bin/env python3
"""Read-only check of the stage-to-topic links against the live database, before migration 225 is pushed.

    python scripts/verify_four_space_node_links.py [--input scripts/data/four-space-topic-links-2026-11-02.json] [--drop-report <file>]
    python scripts/verify_four_space_node_links.py --after-push

For every row of the input file it checks that
  * the stage (lpm_data_objects.id) exists and belongs to the space that the row's `space` code names
    (bio = bio-core-lpm-synth, soc = social-core-lpm-synth, comp = computational-core-lpm-synth, int = interdisciplinary-lpm-synth),
  * the node (curriculum_repository_structure_nodes.id) exists and sits in a Curriculum Repository (not in a project space),
  * no (stage, node) pair appears twice.
Then it replays what the migration's INSERT does, in Python, against the same live rows: every id parsed as a uuid, the share as a
number, the concepts as JSON, the joins to projects, stages and nodes. A dry run of `supabase db push` cannot catch a wrong id type or a
missing ::uuid cast, which is why this replay exists.

With --after-push it checks the database after migration 225 was pushed instead: the table holds exactly the rows of the input file, per space,
all of them ai-draft, and the counting function answers.

Only GET requests are sent (the counting function is a read-only POST). The service-role key is read inside this script (SUPABASE_SERVICE_ROLE_KEY or
.supabase-secrets/service-role-key.txt) and is never printed. Exit code 1 when any row fails.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_node_links_migration import SPACE_SLUGS, link_rows  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
URL = "https://tfynvjjxyluzorigyfsp.supabase.co/rest/v1/"
DEFAULT_INPUT = ROOT / "scripts" / "data" / "four-space-topic-links-2026-11-02.json"


def load_key():
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env.strip()
    for base in (ROOT, ROOT.parent / "openlpm"):
        p = base / ".supabase-secrets" / "service-role-key.txt"
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    sys.exit("No service_role key: set SUPABASE_SERVICE_ROLE_KEY or fill .supabase-secrets/service-role-key.txt")


def get(key, table, query):
    req = urllib.request.Request(URL + table + "?" + query, headers={"apikey": key, "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def count_rows(key, query):
    """Exact row count of a table query, from the Content-Range header."""
    req = urllib.request.Request(URL + query, headers={"apikey": key, "Authorization": "Bearer " + key, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return int(r.headers["Content-Range"].split("/")[1])


def after_push(key, rows):
    projects = {p["slug"]: p for p in get(key, "projects", "select=id,slug&slug=in.(" + ",".join(SPACE_SLUGS.values()) + ")")}
    want = Counter(r["space"] for r in rows)
    ok = True
    total = count_rows(key, "curriculum_repository_node_links?select=id")
    print(f"rows in the table: {total} (input file: {len(rows)})")
    ok &= total == len(rows)
    for code, slug in SPACE_SLUGS.items():
        n = count_rows(key, f"curriculum_repository_node_links?select=id&project_id=eq.{projects[slug]['id']}")
        print(f"  {slug}: {n} (expected {want[code]})")
        ok &= n == want[code]
    drafts = count_rows(key, "curriculum_repository_node_links?select=id&review_status=eq.ai-draft")
    print(f"rows with review_status ai-draft: {drafts}")
    ok &= drafts == total
    repo = get(key, "projects", "select=id&slug=eq.thuringia-curriculum-repository")[0]["id"]
    req = urllib.request.Request(URL + "rpc/curriculum_repository_node_link_counts", method="POST", data=json.dumps({"p_repository_project_id": repo}).encode(),
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        out = json.loads(r.read().decode("utf-8"))
    print(f"counting function answers (service role is not a member of any space, so it returns the nodes' counts): {len(out)} nodes")
    print("ALL GOOD" if ok else "MISMATCH")
    return ok


def chunks(items, n):
    for i in range(0, len(items), n):
        yield items[i:i + n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=str(DEFAULT_INPUT))
    ap.add_argument("--drop-report", help="write the failing rows to this JSON file")
    ap.add_argument("--after-push", action="store_true", help="check the database after migration 225 was pushed")
    args = ap.parse_args()
    doc = json.loads(Path(args.input).read_text(encoding="utf-8"))
    rows = link_rows(doc)
    key = load_key()
    if args.after_push:
        try:
            sys.exit(0 if after_push(key, rows) else 1)
        except urllib.error.HTTPError as e:
            sys.exit(f"The database answered {e.code}: migration 225 is probably not pushed yet.")

    projects = {p["slug"]: p for p in get(key, "projects", "select=id,slug,name&slug=in.(" + ",".join(SPACE_SLUGS.values()) + ")")}
    missing_spaces = [s for s in SPACE_SLUGS.values() if s not in projects]
    if missing_spaces:
        sys.exit(f"Spaces not found in the database: {missing_spaces}")

    stage_ids = sorted({r["stage_id"] for r in rows})
    node_ids = sorted({r["node_id"] for r in rows})
    stages, nodes = {}, {}
    for part in chunks(stage_ids, 50):
        for s in get(key, "lpm_data_objects", "select=id,project_id,object_type,title,grade_band,status&id=in.(" + ",".join(part) + ")"):
            stages[s["id"]] = s
    for part in chunks(node_ids, 50):
        for n in get(key, "curriculum_repository_structure_nodes", "select=id,project_id,level,node_key&id=in.(" + ",".join(part) + ")"):
            nodes[n["id"]] = n
    repo_ids = {n["project_id"] for n in nodes.values()}
    repos = {p["id"]: p for p in get(key, "projects", "select=id,slug,project_kind&id=in.(" + ",".join(sorted(repo_ids)) + ")")} if repo_ids else {}

    failures = []
    seen = Counter()
    for r in rows:
        problems = []
        space_project = projects[SPACE_SLUGS[r["space"]]]
        stage = stages.get(r["stage_id"])
        node = nodes.get(r["node_id"])
        if stage is None:
            problems.append("stage id not found")
        elif stage["project_id"] != space_project["id"]:
            problems.append(f"stage belongs to another project than {SPACE_SLUGS[r['space']]}")
        if node is None:
            problems.append("node id not found")
        else:
            repo = repos.get(node["project_id"], {})
            if repo.get("project_kind") != "curriculum-repository":
                problems.append(f"node sits in project kind {repo.get('project_kind')!r} ({repo.get('slug')})")
        seen[(r["stage_id"], r["node_id"])] += 1
        if seen[(r["stage_id"], r["node_id"])] > 1:
            problems.append("duplicate (stage, node) pair")
        if problems:
            failures.append({"space": r["space"], "stageId": r["stage_id"], "nodeId": r["node_id"], "problems": problems})

    print(f"input rows: {len(rows)}   stages found: {len(stages)}/{len(stage_ids)}   nodes found: {len(nodes)}/{len(node_ids)}")
    print("rows per space:", dict(Counter(r["space"] for r in rows)))
    print("stage status:", dict(Counter(s["status"] for s in stages.values())), " stage type:", dict(Counter(s["object_type"] for s in stages.values())))
    print("node level:", dict(Counter(n["level"] for n in nodes.values())), " node repositories:", dict(Counter(repos.get(n["project_id"], {}).get("slug") for n in nodes.values())))
    print(f"failing rows: {len(failures)}")
    for f in failures:
        print("  ", f["space"], f["stageId"], f["nodeId"], "->", "; ".join(f["problems"]))
    if args.drop_report:
        Path(args.drop_report).write_text(json.dumps(failures, indent=1), encoding="utf-8")

    # Replay of the migration's INSERT ... SELECT ... FROM (VALUES ...) v JOIN projects / lpm_data_objects / nodes.
    failing = {(f["stageId"], f["nodeId"]) for f in failures}
    inserted, conflicts = 0, set()
    for r in rows:
        if (r["stage_id"], r["node_id"]) in failing:
            continue
        uuid.UUID(r["stage_id"])  # ::uuid
        uuid.UUID(r["node_id"])  # ::uuid
        Decimal(r["share"])  # ::numeric
        json.loads(r["shared_concepts"])  # ::jsonb
        project = projects[SPACE_SLUGS[r["space"]]]  # JOIN projects p ON p.slug = v.space_slug
        stage = stages[r["stage_id"]]
        assert stage["project_id"] == project["id"]  # JOIN lpm_data_objects o ON o.id = v.stage_id::uuid AND o.project_id = p.id
        assert r["node_id"] in nodes  # JOIN curriculum_repository_structure_nodes n ON n.id = v.node_id::uuid
        key_ = (stage["id"], r["node_id"])  # UNIQUE (data_object_id, node_id), ON CONFLICT DO NOTHING
        if key_ in conflicts:
            continue
        conflicts.add(key_)
        inserted += 1
    print(f"replay of the INSERT: {inserted} rows would be inserted, {len(rows) - len(failing) - inserted} would be skipped as conflicts")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
