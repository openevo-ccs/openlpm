-- Responds to live feedback 36f3fe54 and f580e9a1 (2026-10-09, Dustin,
-- NetLogo LPM, Literature page): "make sure when we add these literature
-- assets that we integrate with OpenEvo's LiteratureBase and validate
-- across OpenAlex, Semantic Scholar, CrossRef and others as appropriate"
-- + "we should be able to annotate and tag additions from these
-- literature searches." Scoped in lab_manager/docs/design-notes/
-- openlpm-literaturebase-integration-2026-10-09.md. Dustin chose "both
-- directions" (checking in AND proposing back out), the same choice he
-- made for TheoryBase (migration 096) -- this migration is the direct
-- structural mirror of that one, adapted to LiteratureBase's own real
-- shape and workflow:
--
-- 1. literaturebase_snapshot -- a periodically-refreshed, read-only cache
--    of real LiteratureBase records (one YAML file per record under
--    records/*.yaml), synced by scripts/sync_literaturebase_snapshot.mjs
--    from the real literaturebase repo. Same "local script with
--    filesystem access to a sibling checkout" shape as
--    sync_theorybase_snapshot.mjs -- LiteratureBase is a public repo, but
--    its records/ directory has no single combined index to fetch live
--    from a browser, so a periodic cache is still the right shape.
--    Readable by any authenticated user; only service_role writes it.
--
-- 2. literature_references gets two new columns: literaturebase_id (set
--    automatically when a DOI match against the snapshot is found at
--    add-time, or manually if a user links one themselves) and tags
--    (project-local free-form annotation, the direct answer to f580e9a1 --
--    deliberately TEXT[], not a controlled vocabulary, matching this
--    schema's own "extensible vocabulary = TEXT, not an enum" convention
--    already used for relation_type/action_type/student_view_template).
--
-- 3. literature_contributions -- tracks a project's own literature
--    reference being proposed back to the real LiteratureBase repo: a
--    draft record (generated client-side, matching
--    literature-record.schema.json), its status, and which branch/commit
--    in the real literaturebase checkout it landed on once
--    scripts/draft_literaturebase_contribution.mjs processes it. Unlike
--    TheoryBase (append to a shared theories.yaml list), LiteratureBase
--    stores one real file per record and retired standing submissions
--    branches 2026-08-04 in favor of short-lived feature branches + PR
--    directly against main -- so landing a contribution is a new file on
--    its own branch, not a text splice into a shared file.
--
-- Same RLS shape as theory_contributions/theorybase_snapshot (migration
-- 096): project-member gated via is_project_member(), already defined.

SET search_path = public, extensions;

-- ============================================================================
-- 1. LiteratureBase snapshot (read-only ecosystem cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS literaturebase_snapshot (
  -- The real OE-LITERATURE-<slug> id, used as-is -- never regenerated.
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT[] DEFAULT '{}',
  year INTEGER,
  venue TEXT,
  doi TEXT,
  type TEXT,
  license TEXT,
  domains TEXT[] DEFAULT '{}',
  status TEXT,
  review_status TEXT,
  -- Full real record as extracted from the repo's own YAML, for detail
  -- display without a second round-trip -- same "cache the whole thing"
  -- shape as theorybase_snapshot.data.
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_literaturebase_snapshot_doi ON literaturebase_snapshot(doi);
CREATE INDEX IF NOT EXISTS idx_literaturebase_snapshot_search ON literaturebase_snapshot USING gin (to_tsvector('english', title || ' ' || coalesce(array_to_string(domains, ' '), '')));

ALTER TABLE literaturebase_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can browse the LiteratureBase snapshot" ON literaturebase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy on purpose: only service_role (the sync
-- script) writes this table, the same "cache table, not user content"
-- shape as theorybase_snapshot.

-- ============================================================================
-- 2. Checking in: link a project's own reference to a real LiteratureBase
--    record, plus free-form project tags (f580e9a1)
-- ============================================================================

ALTER TABLE literature_references ADD COLUMN IF NOT EXISTS literaturebase_id TEXT REFERENCES literaturebase_snapshot(id) ON DELETE SET NULL;
ALTER TABLE literature_references ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN literature_references.literaturebase_id IS
  'Set when this reference matches a real, already-curated LiteratureBase record (checked by DOI against literaturebase_snapshot at add-time, or linked manually) -- the "is this already a trusted source" signal feedback 36f3fe54 asked for. NULL means this reference has no known match yet, not that it is wrong.';
COMMENT ON COLUMN literature_references.tags IS
  'Project-local free-form tags, set at add-time or edited later -- feedback f580e9a1''s "annotate and tag additions."';

-- ============================================================================
-- 3. Proposing a project's own reference back to the real LiteratureBase repo
-- ============================================================================

CREATE TABLE IF NOT EXISTS literature_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  literature_reference_id UUID NOT NULL REFERENCES literature_references(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- 'drafted': generated here, not yet touched the real repo.
  -- 'branch_committed': scripts/draft_literaturebase_contribution.mjs
  --   created a real local commit on a dedicated branch in the
  --   literaturebase checkout -- not pushed, not a PR yet (needs a
  --   human's own hands, same boundary every other shared-resource write
  --   hits in this lab).
  -- 'pr_opened' / 'merged' / 'rejected': set by hand once a human actually
  --   pushes and the real GitHub review happens.
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN (
    'drafted', 'branch_committed', 'pr_opened', 'merged', 'rejected'
  )),
  -- The real literature-record.schema.json-shaped YAML text, generated
  -- from this reference's own fields at submission time -- stored so the
  -- script that commits it and the UI that shows "what was proposed" read
  -- the exact same text, not two independent derivations that could drift.
  draft_yaml TEXT NOT NULL,
  target_branch TEXT,
  target_record_id TEXT,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_literature_contributions_reference ON literature_contributions(literature_reference_id);
CREATE INDEX IF NOT EXISTS idx_literature_contributions_project ON literature_contributions(project_id);

ALTER TABLE literature_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view literature contributions" ON literature_contributions
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can propose literature contributions" ON literature_contributions
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update their literature contributions" ON literature_contributions
  FOR UPDATE USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

CREATE TRIGGER update_literature_contributions_updated_at BEFORE UPDATE ON literature_contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Opt in the project that actually asked for this
-- ============================================================================

INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)
VALUES ('d1069507-098b-5806-b12b-73ed18c30f2a', 'literaturebase', TRUE, TRUE)
ON CONFLICT (project_id, base_repo) DO NOTHING;

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
