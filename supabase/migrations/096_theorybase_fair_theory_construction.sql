-- Responds to live feedback 35924e8a (2026-10-03, Dustin, Theories page):
-- "develop innovative ways to allow findability, UI/UX, and data
-- visualization of OpenEvo TheoryBase... OpenLPM as a place for
-- constructing FAIR Theories... drive cycles of TheoryBase data quality
-- improvement." Scoped in lab_manager/docs/design-notes/
-- openlpm-theorybase-fair-theory-construction-scoping-2026-10-03.md as
-- three options; Dustin asked for all three. This migration is the shared
-- schema foundation all three build on.
--
-- Three pieces, matching the three options in that design note:
--
-- 1. theorybase_snapshot -- a periodically-refreshed, read-only cache of
--    real TheoryBase content (theories/propositions/assumptions/
--    misconceptions/cross-domain-constructs), synced by
--    scripts/sync_theorybase_snapshot.mjs from the real theorybase repo.
--    TheoryBase is a private repo, so this can't be a live browser fetch
--    the way ConceptBase's import already works (concepts-page.tsx) --
--    it's a cache, refreshed by a script run with filesystem access to
--    the sibling theorybase checkout, same "local script, not a live
--    server-side secret" shape already used elsewhere in this lab.
--    Readable by any authenticated user (it's ecosystem reference
--    content, not project-private); only service_role can write it.
--
-- 2. theories gets three new columns (held_by, authorship_provenance,
--    characterization_status) plus a new child table, theory_propositions
--    -- the real decomposition TheoryBase's own theory-record.schema.json
--    requires (a Theory is "decomposable into Propositions/Assumptions"),
--    so a locally-authored theory can actually be built to the same
--    structure, not just a label and a paragraph.
--
-- 3. theory_contributions -- tracks a locally-authored theory being
--    proposed back to the real TheoryBase repo: a draft record (generated
--    client-side, matching theory-record.schema.json), its status, and
--    which branch/commit in the real theorybase checkout it landed on
--    once scripts/draft_theorybase_contribution.mjs processes it. This is
--    the "drive cycles of quality improvement" half of the ask -- content
--    flowing back out, not just in.
--
-- Same RLS shape as theories/theory_relations (migration 020):
-- project-member gated via is_project_member(), already defined.

SET search_path = public, extensions;

-- ============================================================================
-- 1. TheoryBase snapshot (read-only ecosystem cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS theorybase_snapshot (
  -- The real OE-THEORY-/OE-PROPOSITION-/OE-ASSUMPTION-/OE-MISCONCEPTION-/
  -- OE-CROSS-DOMAIN-CONSTRUCT-... id, used as-is -- never regenerated.
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'theory', 'proposition', 'assumption', 'competing_proposition',
    'misconception', 'cross_domain_construct', 'design_principle', 'curriculum_decision'
  )),
  label TEXT NOT NULL,
  short_label TEXT,
  summary TEXT,
  -- Full real record as extracted from the repo's own YAML, for detail
  -- display without a second round-trip -- same "cache the whole thing"
  -- shape as lpm_schema_elements' own ConceptBase import.
  data JSONB NOT NULL,
  -- Mirrors theory-record.schema.json's own fields, surfaced as real
  -- columns (not buried in `data`) since both findability (filter by
  -- status) and honest display (don't show a reconstruction as if it
  -- were author-stated) depend on them.
  status TEXT,
  authorship_provenance TEXT,
  characterization_status TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theorybase_snapshot_type ON theorybase_snapshot(record_type);
CREATE INDEX IF NOT EXISTS idx_theorybase_snapshot_label ON theorybase_snapshot USING gin (to_tsvector('english', label || ' ' || coalesce(summary, '')));

ALTER TABLE theorybase_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can browse the TheoryBase snapshot" ON theorybase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy on purpose: only service_role (the sync
-- script) writes this table, the same "cache table, not user content"
-- shape as every other base-repo mirror in this schema.

-- ============================================================================
-- 2. Real theory decomposition -- matching TheoryBase's own structure
-- ============================================================================

ALTER TABLE theories ADD COLUMN IF NOT EXISTS held_by TEXT[];
ALTER TABLE theories ADD COLUMN IF NOT EXISTS authorship_provenance TEXT
  CHECK (authorship_provenance IN ('native', 'openevo_reconstruction_of_external_position'));
ALTER TABLE theories ADD COLUMN IF NOT EXISTS characterization_status TEXT
  CHECK (characterization_status IN ('author_stated', 'openevo_reconstruction_unreviewed', 'openevo_reconstruction_reviewed'));

COMMENT ON COLUMN theories.held_by IS
  'Who holds this position (plain names for now -- HumanBase has no person: ids for most real researchers yet, same documented workaround used elsewhere in this ecosystem). Required before a theory can be proposed back to TheoryBase, which requires heldBy.';
COMMENT ON COLUMN theories.authorship_provenance IS
  'Mirrors theorybase theory-record.schema.json authorshipProvenance: is this the project''s own position, or a reconstruction of someone else''s published stance for comparative modeling?';
COMMENT ON COLUMN theories.characterization_status IS
  'Mirrors theorybase theory-record.schema.json characterizationStatus: has a reconstructed position ever been reviewed by its actual holder? Required (and meaningful) only when authorship_provenance is a reconstruction.';

CREATE TABLE IF NOT EXISTS theory_propositions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theory_id UUID NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('proposition', 'assumption')),
  label TEXT NOT NULL,
  statement TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theory_propositions_theory ON theory_propositions(theory_id);

ALTER TABLE theory_propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view theory propositions" ON theory_propositions
  FOR SELECT USING (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)));
CREATE POLICY "Project members can manage theory propositions" ON theory_propositions
  FOR ALL USING (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)));

-- ============================================================================
-- 3. Proposing a local theory back to the real TheoryBase repo
-- ============================================================================

CREATE TABLE IF NOT EXISTS theory_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theory_id UUID NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- 'drafted': generated here, not yet touched the real repo.
  -- 'branch_committed': scripts/draft_theorybase_contribution.mjs created
  --   a real local commit on a dedicated branch in the theorybase
  --   checkout -- not pushed, not a PR yet (needs a human's own hands,
  --   same boundary every other shared-resource write hits in this lab).
  -- 'pr_opened' / 'merged' / 'rejected': set by hand once a human actually
  --   pushes and the real GitHub review happens.
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN (
    'drafted', 'branch_committed', 'pr_opened', 'merged', 'rejected'
  )),
  -- The real theory-record.schema.json-shaped YAML text, generated from
  -- this theory's own fields at submission time -- stored so the script
  -- that commits it and the UI that shows "what was proposed" read the
  -- exact same text, not two independent derivations that could drift.
  draft_yaml TEXT NOT NULL,
  target_branch TEXT,
  target_record_id TEXT,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theory_contributions_theory ON theory_contributions(theory_id);
CREATE INDEX IF NOT EXISTS idx_theory_contributions_project ON theory_contributions(project_id);

ALTER TABLE theory_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view theory contributions" ON theory_contributions
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can propose theory contributions" ON theory_contributions
  FOR INSERT WITH CHECK (is_project_member(project_id));
-- Only the status/branch/record-id fields a human or the committing
-- script would update after the fact -- not a general free-for-all
-- rewrite of someone else's drafted contribution.
CREATE POLICY "Project members can update their theory contributions" ON theory_contributions
  FOR UPDATE USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

CREATE TRIGGER update_theory_contributions_updated_at BEFORE UPDATE ON theory_contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
