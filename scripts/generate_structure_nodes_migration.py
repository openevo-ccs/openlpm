#!/usr/bin/env python3
"""Generates supabase/migrations/216_curriculum_structure_nodes.sql: the structure overview of the Curriculum Repositories.

    python scripts/generate_structure_nodes_migration.py [--out supabase/migrations/216_curriculum_structure_nodes.sql]

Reads (read only): the unit records already in the repositories (mandateType curriculum-unit, migration 195 and the India records), the two
Thueringen edition records, the pilot tree (scripts/data/thueringen_lehrplan_structure_tree_2026_11_02.json) and the checked drafts of
labels and summaries (scripts/data/thueringen_structure_drafts_2026_11_02.json). Writes one migration that creates the two tables and
seeds them. Every node is an AI draft (review_status 'ai-draft') at the summary-only tier. Ids are derived from the node key, so the
migration can run twice and changes nothing the second time.

Needs .supabase-secrets/service-role-key.txt (or SUPABASE_SERVICE_ROLE_KEY).
"""
import argparse
import collections
import json
import os
import re
import sys
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://tfynvjjxyluzorigyfsp.supabase.co/rest/v1/"
NS = uuid.UUID("6f0c1c1e-5b0e-4f55-9d57-2c1f3e7a9a11")
THURINGIA = "thuringia-curriculum-repository"
EDITIONS = {  # grade band of the pilot tree -> (edition record, subject key, German label, English label)
    "5/6": ("DELP-EVENT-thueringen-mnt-gymnasium-2026-erprobungsfassung", "mnt", "Mensch-Natur-Technik, Gymnasium · Erprobungsfassung 2026",
            "Human–Nature–Technology (MNT), Gymnasium · trial edition 2026"),
    "bio": ("DELP-EVENT-thueringen-biologie-gymnasium-2026-erprobungsfassung", "biologie", "Biologie, Gymnasium · Erprobungsfassung 2026",
            "Biology, Gymnasium · trial edition 2026"),
}
SUBJECT_LABELS = {
    "biologie": ("Biologie", "Biology"), "informatik": ("Informatik", "Computer science"), "mnt": ("Mensch-Natur-Technik", "Human–Nature–Technology"),
    "science": (None, "Science"), "social-science": (None, "Social science"), "computer-science": (None, "Computer science"),
}
TIER = "summary-only"


def key():
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env.strip()
    for base in (ROOT, ROOT.parent / "openlpm"):
        p = base / ".supabase-secrets" / "service-role-key.txt"
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    sys.exit("No service_role key found.")


def get(path, k):
    out, off = [], 0
    while True:
        req = urllib.request.Request(URL + path + f"&limit=1000&offset={off}", headers={"apikey": k, "Authorization": "Bearer " + k})
        page = json.load(urllib.request.urlopen(req, timeout=90))
        out += page
        if len(page) < 1000:
            return out
        off += 1000


def slug(text, limit=48):
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")).strip("-")
    return s[:limit].strip("-") or "x"


def q(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def band_of(content):
    a, b = content.get("gradeFrom"), content.get("gradeTo")
    if a is None:
        return None
    return str(a) if a == b or b is None else (f"{a}/{b}" if b - a == 1 else f"{a}-{b}")


def band_sort(band):
    m = re.match(r"\d+", band or "")
    return int(m.group()) if m else 99


def natural(s):
    return [(0, int(t), "") if t.isdigit() else (1, 0, t) for t in re.findall(r"\d+|\D+", str(s or ""))]


class Builder:
    def __init__(self):
        self.nodes = []  # dicts
        self.seen = set()

    def add(self, project_slug, node_key, level, parent_key, **kw):
        k = (project_slug, node_key)
        if k in self.seen:
            raise SystemExit(f"duplicate node key {k}")
        self.seen.add(k)
        node = {"project_slug": project_slug, "node_key": node_key, "level": level, "parent_key": parent_key,
                "id": str(uuid.uuid5(NS, f"{project_slug}/{node_key}")),
                "parent_id": str(uuid.uuid5(NS, f"{project_slug}/{parent_key}")) if parent_key else None, "facts": {}, "sort_order": 0}
        node.update(kw)
        self.nodes.append(node)
        return node


def short_edition(edition):
    """A readable (German, English) tail for the edition label. The full line stays in facts.edition."""
    e = (edition or "").strip()
    if e.lower().startswith("online edition"):
        day = re.search(r"\d{4}-\d{2}-\d{2}", e)
        return (f"Online-Ausgabe, gelesen am {day.group()}", f"online edition, read {day.group()}") if day else ("Online-Ausgabe", "online edition")
    revised = re.match(r"^(\d{4}), Überarbeitung (\d{4})", e)
    if revised:
        return (f"{revised.group(1)}, Überarbeitung {revised.group(2)}", f"{revised.group(1)}, revised {revised.group(2)}")
    acronym = re.search(r"\(([A-Z]{2,8})\)", e)
    if acronym and not re.match(r"^\d", e):
        return (acronym.group(1), acronym.group(1))
    year = re.match(r"^(\d{4})", e)
    if "Erprobungsfassung" in e and year:
        return (f"{year.group(1)} (Erprobungsfassung)", f"{year.group(1)} (trial edition)")
    if year and "(" in e:
        return (year.group(1), year.group(1))
    short = e if len(e) <= 60 else e[:57] + "..."
    return (short, short)


def edition_label(subject, school, edition):
    de, en = SUBJECT_LABELS.get(subject, (subject, subject))
    tail_de, tail_en = short_edition(edition)
    part = f", {school}" if school else ""
    return (f"{de or en}{part}{' · ' + tail_de if tail_de else ''}", f"{en}{part}{' · ' + tail_en if tail_en else ''}", bool(de))


def build_units(b, units, project_slug_of):
    groups = collections.defaultdict(list)
    for r in units:
        c = r["content"]
        slugp = project_slug_of[r["project_id"]]
        edition = c.get("lehrplanEdition") or (c.get("issuingBody") or "")[:80]
        groups[(slugp, c.get("jurisdiction") or r["jurisdiction"], c.get("subject") or "unknown", c.get("schoolType") or "", edition)].append(r)
    for (slugp, jur, subject, school, edition), rs in sorted(groups.items()):
        ek = f"{jur}/{slug(subject)}/{slug(school)}/{slug(edition, 40)}"
        lde, len_, has_de = edition_label(subject, school, edition)
        b.add(slugp, ek, "edition", None, subject=subject, school_type=school or None, label_de=lde if has_de else None, label_en=len_,
              origin="unit-records-195", sort_order=0, facts={"units": len(rs), "edition": edition})
        bands = collections.defaultdict(list)
        for r in rs:
            bands[band_of(r["content"]) or "?"].append(r)
        for band, brs in sorted(bands.items(), key=lambda kv: band_sort(kv[0])):
            bk = f"{ek}/{slug(band)}"
            b.add(slugp, bk, "grade_band", ek, subject=subject, school_type=school or None, grade_band=band, label_de=f"Klassenstufe {band}" if has_de else None,
                  label_en=f"Grade {band}", origin="unit-records-195", sort_order=band_sort(band))
            for i, r in enumerate(sorted(brs, key=lambda r: natural(r["content"].get("unitNumber") or r["title"]))):
                c = r["content"]
                tail = r["title"].split(": ", 1)[1] if ": " in r["title"] else r["title"]
                facts = {k: c[k] for k in ("unitNumber", "hours", "courseLevel", "topicTags") if c.get(k) is not None}
                b.add(slugp, f"{bk}/{slug(r['source_record_id'], 70)}", "unit", bk, subject=subject, school_type=school or None, grade_band=band,
                      record_source_id=r["source_record_id"], label_de=c.get("labelDe"), label_en=tail, summary_en=c.get("description"),
                      source_url=c.get("sourceUrl"), source_pages=(c.get("sourcePage") or None), facts=facts, origin="unit-records-195", sort_order=i)


def build_pilot(b, tree, drafts, edition_urls):
    if len(tree) != len(drafts):
        raise SystemExit("drafts and tree differ in length")
    by_edition = collections.OrderedDict()
    for node, draft in zip(tree, drafts):
        if node["band"] != draft["band"]:
            raise SystemExit(f"band mismatch {node['band']} {draft['band']}")
        by_edition.setdefault("5/6" if node["band"] == "5/6" else "bio", []).append((node, draft))
    for ed, items in by_edition.items():
        rec, subject, lde, len_ = EDITIONS[ed]
        ek = f"DE-TH/{subject}-gymnasium-2026"
        b.add(THURINGIA, ek, "edition", None, subject=subject, school_type="Gymnasium", edition_source_id=rec, label_de=lde, label_en=len_,
              source_url=edition_urls.get(rec), origin="evomentor-goals-2026-11-02", facts={"coverage": "topics that have goals in EvoMentor Thüringen"})
        bands = collections.OrderedDict()
        for node, draft in items:
            bands.setdefault(node["band"], []).append((node, draft))
        for band, bitems in bands.items():
            bk = f"{ek}/{slug(band)}"
            b.add(THURINGIA, bk, "grade_band", ek, subject=subject, school_type="Gymnasium", grade_band=band, label_de=f"Klassenstufe {band}",
                  label_en=f"Grade {band}", origin="evomentor-goals-2026-11-02", sort_order=band_sort(band))
            for ti, (node, draft) in enumerate(bitems):
                tk = f"{bk}/{slug(draft['topic_de'])}"
                b.add(THURINGIA, tk, "topic", bk, subject=subject, school_type="Gymnasium", grade_band=band, label_de=draft["topic_de"],
                      label_en=draft["label_en"], summary_de=draft["summary_de"], summary_en=draft["summary_en"], origin="evomentor-goals-2026-11-02",
                      sort_order=ti, facts={"goals_in_evomentor": node["n"], "match": [band, node["topic"]]})
                for si, (sub, sdraft) in enumerate(zip(node["subtopics"], draft["subtopics"])):
                    pages = ", ".join(str(x) for x in sub["pages"]) if sub["pages"] else None
                    b.add(THURINGIA, f"{tk}/{slug(sdraft['label_de'] if sub['label'] else 'ohne-titel')}-{si}", "subtopic", tk, subject=subject,
                          school_type="Gymnasium", grade_band=band, label_de=sdraft["label_de"], label_en=sdraft["label_en"],
                          summary_de=sdraft["summary_de"], summary_en=sdraft["summary_en"], source_pages=f"p. {pages}" if pages else None,
                          origin="evomentor-goals-2026-11-02", sort_order=si,
                          facts={"goals_in_evomentor": sub["n"], "match": [band, node["topic"], sub["label"]]})


DDL = """-- 216: Structure overview of the Curriculum Repositories (Dustin, 2026-11-01: "why can't a state's curriculum be browsed?").
--
-- One tree per curriculum document, stored in the repository: edition > grade band > topic > subtopic (or unit). Every node carries a
-- German and an English label and summary, a page reference, an access tier (summary-only: headings as short labels, everything else in our
-- own words), and a review status that starts at 'ai-draft'. No node has been checked by a person. Goals of a project that are filed under a
-- node are listed in curriculum_repository_node_goals, so the browse page can show goal counts per project.
--
-- Seeds: (1) the 18 topics and 84 subtopics of the Thueringen Lehrplan Biologie and Mensch-Natur-Technik that EvoMentor Thueringen has goals
-- for (scripts/build_lehrplan_structure_tree.py, openlpm PR 163), with their goal links; (2) one node per unit record that migration 195 and the
-- India records already hold, grouped by subject, school type, edition and grade band. The unit records themselves stay as they are.
-- Running this twice changes nothing. Generated by scripts/generate_structure_nodes_migration.py.
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS curriculum_repository_structure_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  parent_id UUID REFERENCES curriculum_repository_structure_nodes(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  subject TEXT,
  school_type TEXT,
  grade_band TEXT,
  edition_record_id UUID REFERENCES curriculum_repository_records(id) ON DELETE SET NULL,
  record_id UUID REFERENCES curriculum_repository_records(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label_de TEXT,
  label_en TEXT,
  summary_de TEXT,
  summary_en TEXT,
  source_pages TEXT,
  source_url TEXT,
  retrieved_on DATE,
  source_sha256 TEXT,
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_tier TEXT NOT NULL DEFAULT 'summary-only' CHECK (access_tier IN ('full-text-stored', 'excerpt-only', 'summary-only', 'citation-only')),
  review_status TEXT NOT NULL DEFAULT 'ai-draft',
  reviewed_by TEXT,
  reviewed_on DATE,
  review_note TEXT,
  origin TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, node_key),
  CHECK (label_de IS NOT NULL OR label_en IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_structure_nodes_project ON curriculum_repository_structure_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_structure_nodes_parent ON curriculum_repository_structure_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_structure_nodes_record ON curriculum_repository_structure_nodes(record_id);

COMMENT ON TABLE curriculum_repository_structure_nodes IS
  'How a curriculum document is organised (edition > grade band > topic > subtopic or unit), in our own words with German and English labels. level, review_status and origin are open vocabularies (plain text on purpose). review_status: ai-draft, checked-against-source, expert-reviewed.';
COMMENT ON COLUMN curriculum_repository_structure_nodes.access_tier IS
  'Same four values as curriculum_repository_records. summary-only: headings as short labels, summaries in our own words, never a copy of the paragraphs.';

CREATE TABLE IF NOT EXISTS curriculum_repository_node_goals (
  node_id UUID NOT NULL REFERENCES curriculum_repository_structure_nodes(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (node_id, data_object_id)
);
CREATE INDEX IF NOT EXISTS idx_node_goals_project ON curriculum_repository_node_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_node_goals_object ON curriculum_repository_node_goals(data_object_id);

ALTER TABLE curriculum_repository_structure_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_repository_node_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Repository and linked project members can view structure nodes" ON curriculum_repository_structure_nodes;
CREATE POLICY "Repository and linked project members can view structure nodes" ON curriculum_repository_structure_nodes
  FOR SELECT USING (
    is_project_member(project_id)
    OR EXISTS (
      SELECT 1 FROM project_repository_links pl
      WHERE pl.repository_project_id = curriculum_repository_structure_nodes.project_id AND is_project_member(pl.project_id)
    )
  );
DROP POLICY IF EXISTS "Maintainers can manage structure nodes" ON curriculum_repository_structure_nodes;
CREATE POLICY "Maintainers can manage structure nodes" ON curriculum_repository_structure_nodes
  FOR ALL USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

DROP POLICY IF EXISTS "Project members can view their goals under structure nodes" ON curriculum_repository_node_goals;
CREATE POLICY "Project members can view their goals under structure nodes" ON curriculum_repository_node_goals
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Project maintainers can manage their goal links to structure nodes" ON curriculum_repository_node_goals;
CREATE POLICY "Project maintainers can manage their goal links to structure nodes" ON curriculum_repository_node_goals
  FOR ALL USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

DROP TRIGGER IF EXISTS update_structure_nodes_updated_at ON curriculum_repository_structure_nodes;
CREATE TRIGGER update_structure_nodes_updated_at
  BEFORE UPDATE ON curriculum_repository_structure_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON curriculum_repository_structure_nodes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON curriculum_repository_node_goals TO service_role;
"""

COLUMNS = ["id", "project_slug", "node_key", "parent_id", "level", "subject", "school_type", "grade_band", "edition_source_id", "record_source_id",
           "sort_order", "label_de", "label_en", "summary_de", "summary_en", "source_pages", "source_url", "facts", "origin"]


def emit_nodes(nodes):
    rows = []
    for n in nodes:
        vals = [q(n["id"]), q(n["project_slug"]), q(n["node_key"]), q(n["parent_id"]), q(n["level"]), q(n.get("subject")), q(n.get("school_type")),
                q(n.get("grade_band")), q(n.get("edition_source_id")), q(n.get("record_source_id")), str(int(n["sort_order"])), q(n.get("label_de")),
                q(n.get("label_en")), q(n.get("summary_de")), q(n.get("summary_en")), q(n.get("source_pages")), q(n.get("source_url")),
                q(json.dumps(n["facts"], ensure_ascii=False)), q(n["origin"])]
        rows.append("  (" + ", ".join(vals) + ")")
    # one statement per chunk keeps each statement readable; parents are inserted before children
    out = []
    for i in range(0, len(rows), 200):
        out.append(
            "INSERT INTO curriculum_repository_structure_nodes (id, project_id, node_key, parent_id, level, subject, school_type, grade_band, "
            "edition_record_id, record_id, sort_order, label_de, label_en, summary_de, summary_en, source_pages, source_url, facts, access_tier, review_status, origin)\n"
            "SELECT v.id::uuid, p.id, v.node_key, v.parent_id::uuid, v.level, v.subject, v.school_type, v.grade_band,\n"
            "       (SELECT r.id FROM curriculum_repository_records r WHERE r.project_id = p.id AND r.source_record_id = v.edition_source_id),\n"
            "       (SELECT r.id FROM curriculum_repository_records r WHERE r.project_id = p.id AND r.source_record_id = v.record_source_id),\n"
            "       v.sort_order::integer, v.label_de, v.label_en, v.summary_de, v.summary_en, v.source_pages, v.source_url, v.facts::jsonb,\n"
            f"       '{TIER}', 'ai-draft', v.origin\nFROM (VALUES\n" + ",\n".join(rows[i:i + 200]) + "\n) AS v(" + ", ".join(COLUMNS) + ")\n"
            "JOIN projects p ON p.slug = v.project_slug\nON CONFLICT (project_id, node_key) DO NOTHING;\n"
        )
    return "\n".join(out)


def emit_goal_links(pilot_nodes):
    rows = []
    for n in pilot_nodes:
        m = n["facts"].get("match")
        if n["level"] == "subtopic":
            rows.append(f"  ({q(n['node_key'])}, {q(m[0])}, {q(m[1])}, {q(m[2])})")
    return (
        "INSERT INTO curriculum_repository_node_goals (node_id, data_object_id, project_id)\n"
        "SELECT n.id, o.id, o.project_id\nFROM (VALUES\n" + ",\n".join(rows) + "\n) AS m(node_key, band, thema, unterthema)\n"
        f"JOIN curriculum_repository_structure_nodes n ON n.node_key = m.node_key AND n.project_id = (SELECT id FROM projects WHERE slug = '{THURINGIA}')\n"
        "JOIN lpm_data_objects o ON o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))\n"
        "  AND o.status = 'accepted' AND o.grade_band = m.band\n"
        "  AND COALESCE(o.content ->> 'thema', '') = m.thema AND COALESCE(o.content ->> 'unterthema', '') = m.unterthema\n"
        "ON CONFLICT DO NOTHING;\n"
    )


def emit_check(expected_nodes, expected_links):
    return (
        "DO $$\nDECLARE nodes integer; links integer;\nBEGIN\n"
        "  SELECT count(*) INTO nodes FROM curriculum_repository_structure_nodes;\n"
        "  SELECT count(*) INTO links FROM curriculum_repository_node_goals n JOIN projects p ON p.id = n.project_id WHERE p.slug = 'evomentor-thuringia';\n"
        f"  IF nodes < {expected_nodes} OR links < {int(expected_links * 0.9)} THEN\n"
        f"    RAISE EXCEPTION 'migration 216: % structure nodes (expected {expected_nodes}), % goal links in EvoMentor Thueringen (expected about {expected_links})', nodes, links;\n"
        "  END IF;\nEND $$;\n"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "supabase" / "migrations" / "216_curriculum_structure_nodes.sql"))
    ap.add_argument("--dump-json", help="also write the rows as the app would receive them (for a browser check before the migration is pushed)")
    args = ap.parse_args()
    k = key()
    projects = get("projects?select=id,slug&project_kind=eq.curriculum-repository", k)
    full_slug = {p["id"]: p["slug"] for p in projects}
    ids = ",".join(p["id"] for p in projects)
    recs = get(f"curriculum_repository_records?select=id,project_id,source_record_id,title,jurisdiction,content&record_type=eq.institutional-mandate-record&project_id=in.({ids})", k)
    units = [r for r in recs if (r["content"] or {}).get("mandateType") == "curriculum-unit"]
    th = next(p["id"] for p in projects if p["slug"] == THURINGIA)
    wanted = [e[0] for e in EDITIONS.values()]
    edition_recs = get(f"curriculum_repository_records?select=source_record_id,content&project_id=eq.{th}&source_record_id=in.({','.join(wanted)})", k)
    edition_urls = {r["source_record_id"]: (r["content"] or {}).get("sourceUrl") for r in edition_recs}
    if len(edition_urls) != 2:
        sys.exit(f"edition records found: {list(edition_urls)}")

    tree = json.loads((ROOT / "scripts/data/thueringen_lehrplan_structure_tree_2026_11_02.json").read_text(encoding="utf-8"))
    drafts = json.loads((ROOT / "scripts/data/thueringen_structure_drafts_2026_11_02.json").read_text(encoding="utf-8"))

    b = Builder()
    build_pilot(b, tree, drafts, edition_urls)
    pilot = list(b.nodes)
    # the Thueringen Informatik unit records join the same repository but a different edition node
    build_units(b, units, full_slug)
    expected_links = sum(sub["n"] for node in tree for sub in node["subtopics"])
    sql = DDL + "\n-- Seeds\n" + emit_nodes(b.nodes) + "\n" + emit_goal_links(pilot) + "\n" + emit_check(len(b.nodes), expected_links)
    Path(args.out).write_text(sql, encoding="utf-8")
    if args.dump_json:
        rec_id = {(r["project_id"], r["source_record_id"]): r["id"] for r in recs}
        proj_id = {p["slug"]: p["id"] for p in projects}
        rows = []
        for n in b.nodes:
            pj = proj_id[n["project_slug"]]
            rows.append({"id": n["id"], "project_id": pj, "node_key": n["node_key"], "parent_id": n["parent_id"], "level": n["level"],
                         "subject": n.get("subject"), "school_type": n.get("school_type"), "grade_band": n.get("grade_band"),
                         "edition_record_id": rec_id.get((pj, n.get("edition_source_id"))), "record_id": rec_id.get((pj, n.get("record_source_id"))),
                         "sort_order": n["sort_order"], "label_de": n.get("label_de"), "label_en": n.get("label_en"),
                         "summary_de": n.get("summary_de"), "summary_en": n.get("summary_en"), "source_pages": n.get("source_pages"),
                         "source_url": n.get("source_url"), "retrieved_on": None, "source_sha256": None, "facts": n["facts"], "access_tier": TIER,
                         "review_status": "ai-draft", "reviewed_by": None, "reviewed_on": None, "review_note": None, "origin": n["origin"],
                         "created_at": None, "updated_at": None})
        goals_rows = []
        by_triple = {tuple(n["facts"]["match"]): n["id"] for n in pilot if n["level"] == "subtopic"}
        for gslug in ("evomentor-thuringia", "evomentor-thuringia-sandbox"):
            gp = get(f"projects?select=id,name&slug=eq.{gslug}", k)[0]
            for g in get(f"lpm_data_objects?select=id,grade_band,content&project_id=eq.{gp['id']}&status=eq.accepted", k):
                node_id = by_triple.get((g["grade_band"], g["content"].get("thema") or "", g["content"].get("unterthema") or ""))
                if node_id:
                    goals_rows.append({"node_id": node_id, "project_id": gp["id"], "project": {"name": gp["name"]}})
        Path(args.dump_json).write_text(json.dumps({"nodes": rows, "goals": goals_rows}, ensure_ascii=False), encoding="utf-8")
    by = collections.Counter((n["project_slug"].replace("-curriculum-repository", ""), n["level"]) for n in b.nodes)
    print(f"{len(b.nodes)} nodes, expected goal links {expected_links} (live project)")
    for kk, v in sorted(by.items()):
        print("  ", kk, v)


if __name__ == "__main__":
    main()
