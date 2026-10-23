-- Fourth and final piece of the strategy locked 2026-10-23
-- (lab_manager/docs/design-notes/
-- openlpm-literature-collections-and-analytics-strategy-2026-10-23.md,
-- decision 3): "a real disagreement about what a paper shows routes
-- through the existing formal dispute mechanism (the same one used for
-- theory-level disputes like Kampourakis), not a new system."
--
-- The real dispute mechanism (openevo-graph/edges/disputes) is a
-- carefully curated, git-based graph of typed edges between named
-- position/divergence/question ids -- not a live-writable database table,
-- and not something this app should auto-generate entries into (inventing
-- og:position/og:divergence ids without that graph's own curation context
-- would produce low-quality or malformed entries into a shared scholarly
-- resource). So "wiring this in" means the same shape every other
-- shared-resource write in this app already uses (literature_contributions,
-- migration 111; theory_contributions, migration 096): capture a
-- structured flag here, as a draft, and let a human actually decide
-- whether/how it becomes a real dispute-graph edge.
--
-- Reuses evidence_links' own stance vocabulary (migration 066:
-- supports/challenges/contextualizes) for the flag's own "how does this
-- relate" field, so a researcher sees one consistent vocabulary across
-- this app's two separate literature-to-content annotation features
-- rather than two different three-way enums that mean almost the same
-- thing.

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS literature_dispute_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  literaturebase_id TEXT NOT NULL REFERENCES literaturebase_snapshot(id) ON DELETE CASCADE,
  -- Mirrors evidence_links.evidence_type's own three values (migration
  -- 066) -- what kind of tension this flag is raising about the paper.
  stance TEXT NOT NULL DEFAULT 'challenges' CHECK (stance IN ('supports', 'challenges', 'contextualizes')),
  -- Free text: what specific claim, paper, or curriculum content this is
  -- in tension with. Deliberately not a foreign key -- the thing in
  -- tension might be another LiteratureBase record, a specific line in a
  -- Curriculum Repository record, or something not yet represented as a
  -- row anywhere in this app at all.
  target_description TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN (
    'flagged', 'reviewed', 'promoted_to_dispute_graph', 'dismissed'
  )),
  -- Set by hand once/if a maintainer actually turns this into a real
  -- openevo-graph/edges/disputes/*.yaml edge -- the file path, for a
  -- direct link, same spirit as literature_contributions.target_branch.
  dispute_graph_file TEXT,
  flagged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_literature_dispute_flags_project ON literature_dispute_flags(project_id);
CREATE INDEX IF NOT EXISTS idx_literature_dispute_flags_literaturebase ON literature_dispute_flags(literaturebase_id);

ALTER TABLE literature_dispute_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view dispute flags" ON literature_dispute_flags
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can raise a dispute flag" ON literature_dispute_flags
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update their project's dispute flags" ON literature_dispute_flags
  FOR UPDATE USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

CREATE TRIGGER update_literature_dispute_flags_updated_at BEFORE UPDATE ON literature_dispute_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
