#!/usr/bin/env python3
"""Generates the migration that adds the topic-level structure of 44 public Lehrplan PDFs (Hessen, Nordrhein-Westfalen, Sachsen, Sachsen-Anhalt) to the
Curriculum Repository.

    python scripts/generate_lehrplan_topic_nodes_migration.py [migration number]

Input: scripts/data/lehrplan_topic_nodes_2026-11-16.json. It holds the headings (short labels as printed), our own-words summaries, page numbers
and the checksum of each PDF. It holds no passage of the original documents. The PDFs stay in a private folder outside every repository.

Each document becomes a tree: edition > grade band > topic. Every node is an LLM synthesized draft awaiting review (review_status ai-draft, German:
LLM-erzeugter Entwurf, Prüfung ausstehend) at the summary-only tier. No subject expert has read any of it. Rights columns follow migration 224:
the rights holder is the issuing ministry, the status stays not-assessed.

The migration creates the two missing state spaces (Hessen, Nordrhein-Westfalen) under the Germany space, adds the nodes with ON CONFLICT DO NOTHING
and ends with a count check, so running it twice changes nothing.
"""
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "scripts" / "data" / "lehrplan_topic_nodes_2026-11-16.json"
DEFAULT_NUMBER = 248
# Susan Hanisch's account, the second owner of the Germany space and of the Thuringia space (read from live data, 2026-11-16). Dustin asked for her as co-owner of the two new spaces.
CO_OWNER_ID = "96f8939c-9249-49c5-b676-1f043cfd1a6a"

NEW_PROJECTS = [
    ("hesse-curriculum-repository", "Hesse Curriculum Repository", "DE-HE"),
    ("north-rhine-westphalia-curriculum-repository", "North Rhine-Westphalia Curriculum Repository", "DE-NW"),
]
PROJECT_NOTE = ("AI-drafted from public curriculum documents and summarised in our own words. No subject expert has reviewed any entry. "
                "Each entry names the document and the pages it was read from.")
RIGHTS_NOTE = ("Summary in our own words. The heading is a short label taken from the official curriculum document. No person has assessed whether the "
               "heading may be reused outside the lab, so the space stays invite-only.")


def q(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def main():
    number = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_NUMBER
    data = json.loads(DATA.read_text(encoding="utf-8"))
    origin = data["origin"]
    docs = data["documents"]
    rows_by_depth = {0: [], 1: [], 2: []}
    counts = {}
    for d in docs:
        for n in d["nodes"]:
            depth = {"edition": 0, "grade_band": 1, "topic": 2}[n["level"]]
            row = [d["project_slug"], n["node_key"], n["parent_key"], n["level"], n["subject"], n["school_type"], n["grade_band"], str(n["sort_order"]),
                   n["label_de"], n["label_en"], n["summary_de"], n["summary_en"], n["source_pages"], d["source_url"], d["retrieved_on"], d["sha256"],
                   json.dumps(n["facts"], ensure_ascii=False, separators=(",", ":")), d["ministry"]]
            rows_by_depth[depth].append("  (" + ", ".join(q(x) for x in row) + ")")
            counts[d["project_slug"]] = counts.get(d["project_slug"], 0) + 1
    total = sum(len(v) for v in rows_by_depth.values())
    n_topics = len(rows_by_depth[2])
    parts = [f"""-- {number}: Topic-level structure of 44 public Lehrplan PDFs in the Curriculum Repository (Dustin, 2026-11-16: topic level for all plans, summary-only access).
--
-- Documents: {len(docs)} editions from Hessen (HE), Nordrhein-Westfalen (NW), Sachsen (SN) and Sachsen-Anhalt (ST), subjects chemistry, physics, geography, informatics, history, politics, economics-politics and integrated social studies.
-- Each edition is a tree: edition > grade band > topic. A topic is a Lernbereich, Inhaltsfeld, Kompetenzschwerpunkt or Themenfeld, depending on the Land. Nodes carry
-- the heading as printed (a short label), an English label, a German and an English summary in our own words, the page numbers as printed in the document,
-- the source address, the retrieval date and the checksum of the PDF. The PDFs stay in a private folder outside every repository.
-- {total} nodes: {len(rows_by_depth[0])} editions, {len(rows_by_depth[1])} grade bands, {n_topics} topics.
--
-- Hessen and Nordrhein-Westfalen had no state space yet. Both are created here under the Germany space (same pattern as Saxony, Saxony-Anhalt and Thuringia),
-- private, with the Germany space's creator and Susan Hanisch as owners. Saxony and Saxony-Anhalt already hold nodes from the FWU Lehrplan ontology (CC BY-SA 4.0, migration 195). The
-- new nodes use their own edition keys (ending in -pdf), so they sit beside the ontology nodes and replace nothing.
--
-- Every node is an LLM synthesized draft awaiting review (review_status ai-draft; German: LLM-erzeugter Entwurf, Prüfung ausstehend) at the summary-only tier.
-- No subject expert has read any node. Rights columns follow migration 224: the rights holder is the issuing ministry, no licence is claimed and the status stays
-- not-assessed. Running this twice changes nothing. Generated by scripts/generate_lehrplan_topic_nodes_migration.py from scripts/data/lehrplan_topic_nodes_2026-11-16.json.
SET search_path = public, extensions;

INSERT INTO projects (slug, name, epistemic_status, epistemic_status_note, is_private, focus_type, region_tags, parent_project_id, project_kind, created_by)
SELECT v.slug, v.name, 'in-development', {q(PROJECT_NOTE)}, true, 'regional', ARRAY[v.region_tag], g.id, 'curriculum-repository', g.created_by
FROM (VALUES
""" + ",\n".join(f"  ({q(s)}, {q(nm)}, {q(rt)})" for s, nm, rt in NEW_PROJECTS) + f"""
) AS v(slug, name, region_tag)
JOIN projects g ON g.slug = 'germany-curriculum-repository'
ON CONFLICT (slug) DO NOTHING;

-- The creator is enrolled as owner by the project trigger. Susan Hanisch is added as a second owner (Dustin's decision, 2026-11-16).
INSERT INTO project_members (project_id, user_id, role, invited_by)
SELECT p.id, u.id, 'owner', g.created_by
FROM projects p
JOIN projects g ON g.slug = 'germany-curriculum-repository'
JOIN users u ON u.id = {q(CO_OWNER_ID)}::uuid
WHERE p.slug IN ({", ".join(q(s) for s, _, _ in NEW_PROJECTS)})
ON CONFLICT (project_id, user_id) DO NOTHING;
"""]
    cols = ("project_id, node_key, parent_id, level, subject, school_type, grade_band, sort_order, label_de, label_en, summary_de, summary_en, source_pages, source_url, "
            "retrieved_on, source_sha256, facts, access_tier, review_status, origin, rights_holder, license_or_rights_note, rights_status")
    for depth in (0, 1, 2):
        join_parent = "LEFT JOIN" if depth == 0 else "JOIN"
        parts.append(
            f"INSERT INTO curriculum_repository_structure_nodes ({cols})\n"
            "SELECT p.id, v.node_key, parent.id, v.level, v.subject, v.school_type, v.grade_band, v.sort_order::integer, v.label_de, v.label_en, v.summary_de, v.summary_en,\n"
            f"       v.source_pages, v.source_url, v.retrieved_on::date, v.sha, v.facts::jsonb, 'summary-only', 'ai-draft', {q(origin)}, v.rights_holder, {q(RIGHTS_NOTE)}, 'not-assessed'\n"
            "FROM (VALUES\n" + ",\n".join(rows_by_depth[depth]) + "\n"
            ") AS v(project_slug, node_key, parent_key, level, subject, school_type, grade_band, sort_order, label_de, label_en, summary_de, summary_en, source_pages, source_url, retrieved_on, sha, facts, rights_holder)\n"
            "JOIN projects p ON p.slug = v.project_slug\n"
            f"{join_parent} curriculum_repository_structure_nodes parent ON parent.project_id = p.id AND parent.node_key = v.parent_key\n"
            "ON CONFLICT (project_id, node_key) DO NOTHING;\n")
    parts.append(f"""DO $$
DECLARE added integer; orphans integer; spaces integer; owners integer;
BEGIN
  SELECT count(*) INTO added FROM curriculum_repository_structure_nodes WHERE origin = {q(origin)};
  SELECT count(*) INTO orphans FROM curriculum_repository_structure_nodes WHERE origin = {q(origin)} AND level <> 'edition' AND parent_id IS NULL;
  SELECT count(*) INTO spaces FROM projects p JOIN projects g ON g.id = p.parent_project_id AND g.slug = 'germany-curriculum-repository'
    WHERE p.slug IN ({", ".join(q(s) for s, _, _ in NEW_PROJECTS)});
  SELECT count(*) INTO owners FROM project_members m JOIN projects p ON p.id = m.project_id
    WHERE p.slug IN ({", ".join(q(s) for s, _, _ in NEW_PROJECTS)}) AND m.role = 'owner' AND m.user_id = {q(CO_OWNER_ID)}::uuid;
  IF added <> {total} OR orphans <> 0 OR spaces <> {len(NEW_PROJECTS)} OR owners <> {len(NEW_PROJECTS)} THEN
    RAISE EXCEPTION 'migration {number}: % nodes (expected {total}), % without a parent, % new state spaces under Germany (expected {len(NEW_PROJECTS)}), % co-owner rows (expected {len(NEW_PROJECTS)})', added, orphans, spaces, owners;
  END IF;
END $$;
""")
    out = list((ROOT / "supabase" / "migrations").glob(f"{number}_*.sql"))
    path = out[0] if out else ROOT / "supabase" / "migrations" / f"{number}_lehrplan_topic_nodes_he_nw_sn_st.sql"
    path.write_text("\n".join(parts), encoding="utf-8", newline="\n")
    print(f"wrote {path.name}: {total} nodes ({n_topics} topics), {len(docs)} editions; per space: {counts}")


if __name__ == "__main__":
    main()
