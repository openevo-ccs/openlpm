#!/usr/bin/env python3
"""Generates supabase/migrations/225_curriculum_repository_node_links.sql: stage-to-topic links of the four synthetic LPM spaces.

    python scripts/generate_node_links_migration.py [--input scripts/data/four-space-topic-links-2026-11-02.json]
                                                    [--out supabase/migrations/225_curriculum_repository_node_links.sql]
                                                    [--check]

Reads one checked-in input file and nothing else (no database, no network). The input holds ids, class, share, our own concept names and
the method text, and no Lehrplan wording (see scripts/extract_four_space_topic_links_input.py for how it is cut from the private test
folder). Writes the migration: the table, its row level security, one counting function, and the seed rows. The output depends on the
input only, so running this again gives the same file; `--check` compares instead of writing and exits 1 on any difference.

Every seeded row is an LLM synthesized draft awaiting review (review_status 'ai-draft'). relation_type is plain text on purpose, so a
new kind of link needs no migration: 'proposed_covers' and 'proposed_partly' are the first two values.
"""
import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "scripts" / "data" / "four-space-topic-links-2026-11-02.json"
NUMBER = "225"
DEFAULT_OUT = ROOT / "supabase" / "migrations" / f"{NUMBER}_curriculum_repository_node_links.sql"

# The space codes of the test and the slugs of the projects they stand for.
SPACE_SLUGS = {
    "bio": "bio-core-lpm-synth",
    "soc": "social-core-lpm-synth",
    "comp": "computational-core-lpm-synth",
    "int": "interdisciplinary-lpm-synth",
}
RELATION_OF_CLASS = {"covers": "proposed_covers", "partly": "proposed_partly"}
ALLOWED_KEYS = {"space", "stageId", "nodeId", "class", "share", "concepts"}


def q(value):
    """A SQL string literal."""
    return "'" + str(value).replace("'", "''") + "'"


def rationale(concepts, share):
    pct = int(round(float(share) * 100))
    return f"Shared concepts: {', '.join(concepts)}. They make up about {pct}% of the stage's concept weight."


def link_rows(doc):
    """Input document -> list of row dicts with the values as the migration writes them (all text). Raises ValueError on a bad row."""
    rows = []
    for i, link in enumerate(doc["links"]):
        extra = set(link) - ALLOWED_KEYS
        if extra:
            raise ValueError(f"row {i}: unexpected keys {sorted(extra)}")
        if link["space"] not in SPACE_SLUGS:
            raise ValueError(f"row {i}: unknown space {link['space']!r}")
        if link["class"] not in RELATION_OF_CLASS:
            raise ValueError(f"row {i}: class {link['class']!r} is not covers or partly")
        share = Decimal(str(link["share"]))
        if not Decimal("0") < share <= Decimal("1"):
            raise ValueError(f"row {i}: share {share} outside (0, 1]")
        concepts = link["concepts"]
        if not concepts or not all(isinstance(c, str) and c.strip() for c in concepts):
            raise ValueError(f"row {i}: concepts must be a list of non-empty names")
        rows.append({
            "space": link["space"],
            "space_slug": SPACE_SLUGS[link["space"]],
            "stage_id": link["stageId"],
            "node_id": link["nodeId"],
            "relation_type": RELATION_OF_CLASS[link["class"]],
            "share": format(share, "f"),
            "shared_concepts": json.dumps(concepts, ensure_ascii=False, separators=(",", ":")),
            "rationale": rationale(concepts, share),
        })
    pairs = [(r["stage_id"], r["node_id"]) for r in rows]
    if len(pairs) != len(set(pairs)):
        raise ValueError("a (stage, node) pair appears twice")
    return rows


HEAD = """-- 225: Stage-to-topic links of the four synthetic LPM spaces, as proposed drafts (Dustin, 2026-11-02).
--
-- A stage of Bio-Core, Social-Core, Computational-Core or Interdisciplinary can link to a topic or subtopic of a Curriculum Repository's
-- structure overview (curriculum_repository_structure_nodes, migration 216). Each link says which of our own concepts the two share. Every
-- link is a proposal: review_status starts at 'ai-draft', shown as "LLM synthesized draft, awaiting review". No person has checked any of them.
--
-- Seeds: __COUNT__ links of the Thueringen Lehrplan Biologie and Mensch-Natur-Technik topics (Bio-Core __BIO__, Interdisciplinary __INT__,
-- Social-Core __SOC__, Computational-Core __COMP__). Made by two independent AI labelling passes per space against that space's own concepts,
-- reading Lehrplan wording that stays on a private PC; links by shared concepts. The Lehrplan wording itself is not stored here.
--
-- Rights: a member of the space (and a platform admin) sees the rows of the space; only the space owner or an admin changes them. People
-- who see the repository but do not belong to the space get one count per node from curriculum_repository_node_link_counts(), with no
-- space name and no stage. Running this twice changes nothing. Generated by scripts/generate_node_links_migration.py.
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS curriculum_repository_node_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES curriculum_repository_structure_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'proposed_covers',
  share NUMERIC CHECK (share IS NULL OR (share >= 0 AND share <= 1)),
  shared_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  method TEXT,
  review_status TEXT NOT NULL DEFAULT 'ai-draft',
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (data_object_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_links_project ON curriculum_repository_node_links(project_id);
CREATE INDEX IF NOT EXISTS idx_node_links_node ON curriculum_repository_node_links(node_id);

COMMENT ON TABLE curriculum_repository_node_links IS
  'Which stage of a project space (data_object_id) links to which topic or subtopic of a repository structure overview (node_id). relation_type, review_status and method are open vocabularies (plain text on purpose): relation_type starts with proposed_covers and proposed_partly, review_status starts at ai-draft. shared_concepts is a JSON list of our own concept names. created_by is empty for rows that a script seeded.';
COMMENT ON COLUMN curriculum_repository_node_links.share IS
  'Share of the stage''s concept weight that the topic shares (0 to 1). Primary concepts weigh 1, reinforcing ones 0.4.';

ALTER TABLE curriculum_repository_node_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Space members and admins can view their node links" ON curriculum_repository_node_links;
CREATE POLICY "Space members and admins can view their node links" ON curriculum_repository_node_links
  FOR SELECT USING (is_admin() OR is_project_member(project_id));

DROP POLICY IF EXISTS "Space owners and admins can manage their node links" ON curriculum_repository_node_links;
CREATE POLICY "Space owners and admins can manage their node links" ON curriculum_repository_node_links
  FOR ALL
  USING (is_admin() OR has_project_role(project_id, ARRAY['owner']::project_member_role[]))
  WITH CHECK (
    (is_admin() OR has_project_role(project_id, ARRAY['owner']::project_member_role[]))
    AND EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = curriculum_repository_node_links.data_object_id AND o.project_id = curriculum_repository_node_links.project_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON curriculum_repository_node_links TO service_role;

-- One count per node for the spaces the caller does not belong to, for the nodes of one repository. It returns no space name and no
-- stage. It answers only when the caller can already see that repository (the same rule as the policy on
-- curriculum_repository_structure_nodes in migration 216).
CREATE OR REPLACE FUNCTION curriculum_repository_node_link_counts(p_repository_project_id UUID)
RETURNS TABLE (node_id UUID, links INTEGER, spaces INTEGER) AS $$
  SELECT l.node_id, COUNT(*)::INTEGER, COUNT(DISTINCT l.project_id)::INTEGER
  FROM curriculum_repository_node_links l
  JOIN curriculum_repository_structure_nodes n ON n.id = l.node_id
  WHERE n.project_id = p_repository_project_id
    AND NOT (is_admin() OR is_project_member(l.project_id))
    AND (
      is_project_member(p_repository_project_id)
      OR EXISTS (
        SELECT 1 FROM project_repository_links pl
        WHERE pl.repository_project_id = p_repository_project_id AND is_project_member(pl.project_id)
      )
    )
  GROUP BY l.node_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION curriculum_repository_node_link_counts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION curriculum_repository_node_link_counts(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION curriculum_repository_node_link_counts(UUID) TO authenticated, service_role;

-- Seeds. A row is inserted only when its space, its stage (which must belong to that space) and its node all exist.
INSERT INTO curriculum_repository_node_links (project_id, data_object_id, node_id, relation_type, share, shared_concepts, method, review_status, rationale)
SELECT p.id, o.id, n.id, v.relation_type, v.share::numeric, v.shared_concepts::jsonb, __METHOD__, 'ai-draft', v.rationale
FROM (VALUES
"""

TAIL = """
) AS v(space_slug, stage_id, node_id, relation_type, share, shared_concepts, rationale)
JOIN projects p ON p.slug = v.space_slug
JOIN lpm_data_objects o ON o.id = v.stage_id::uuid AND o.project_id = p.id
JOIN curriculum_repository_structure_nodes n ON n.id = v.node_id::uuid
ON CONFLICT (data_object_id, node_id) DO NOTHING;

DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM curriculum_repository_node_links WHERE method = __METHOD__;
  IF n < __COUNT__ THEN
    RAISE WARNING 'Expected __COUNT__ seeded node links, found %. Check which stage or node ids are missing.', n;
  ELSE
    RAISE NOTICE '% seeded node links in place', n;
  END IF;
END $$;
"""


def render_migration(doc):
    rows = link_rows(doc)
    method = q(doc["method"])
    counts = {code: sum(1 for r in rows if r["space"] == code) for code in SPACE_SLUGS}
    values = ",\n".join(
        "  (" + ", ".join(q(r[k]) for k in ("space_slug", "stage_id", "node_id", "relation_type", "share", "shared_concepts", "rationale")) + ")"
        for r in rows
    )
    text = HEAD + values + TAIL
    for token, value in (
        ("__COUNT__", str(len(rows))), ("__BIO__", str(counts["bio"])), ("__INT__", str(counts["int"])),
        ("__SOC__", str(counts["soc"])), ("__COMP__", str(counts["comp"])), ("__METHOD__", method),
    ):
        text = text.replace(token, value)
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=str(DEFAULT_INPUT))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--check", action="store_true", help="compare with the existing file instead of writing")
    args = ap.parse_args()
    doc = json.loads(Path(args.input).read_text(encoding="utf-8"))
    text = render_migration(doc)
    out = Path(args.out)
    if args.check:
        same = out.exists() and out.read_text(encoding="utf-8") == text
        print("migration matches the generator output" if same else "DIFFERENT: run the generator again")
        sys.exit(0 if same else 1)
    out.write_text(text, encoding="utf-8", newline="\n")
    print(f"{len(link_rows(doc))} links, written to {out}")


if __name__ == "__main__":
    main()
