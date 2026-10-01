-- Curriculum Repository: a new project-scoped content type for curated
-- national/regional curriculum-policy source material (institutional actors,
-- policy timelines, mandates, coherence findings, crosswalks, etc.) ported
-- from the deutsche_lp/nys_lp/india_lp sibling repos -- plus linking at three
-- different levels, since a single flat link table can't honestly represent
-- how a project actually relates to a repository:
--
--   1. PROJECT level  -- "this whole LPM project is grounded in this
--      repository (optionally just one jurisdiction within it)" --
--      project_repository_links. Coarse, declarative, visible on the
--      project's own page -- the same role project_source_declarations (019)
--      already plays for free-text sources, extended to point at a real
--      repository record set instead of just a URL.
--   2. RECORD level  -- "this specific strand/substrand connects to this
--      specific repository record, and here's why" -- curriculum_repository_
--      links. Fine-grained, human-authored, carries a rationale. This is the
--      "browse + connect" feature itself.
--   3. VOCABULARY level  -- "this repository record sits at this grade-band /
--      subject-area tag" -- curriculum_repository_record_tags, reusing the
--      exact frameworks/framework_tags system (018) every project already
--      crosswalks against. This is what lets a browsing UI show "everything
--      in my project's grade band" across a repository WITHOUT a human
--      having drawn an explicit connection for each item first.
--
-- A fourth level -- repository-to-repository, e.g. a Saxony mandate
-- crosswalked against a New York one -- needs no new table: it's exactly
-- what a 'curriculum-crosswalk' record_type row already natively expresses
-- (its content JSONB carries both sides' source_record_ids, same shape the
-- source schema already validates), so the import script just carries those
-- records over like any other -- see curriculum_repository_records below.
--
-- record_type values match the 9 schema filenames deutsche_lp/nys_lp/
-- india_lp already use (schema/*.schema.json in each repo), so the import
-- script can carry the source repo's own type name across unchanged.
-- access_tier/license_or_rights_note reuse the exact 4-value vocabulary
-- 044_source_access_tier.sql already established for standards_documents and
-- project_source_declarations -- same question ("how much of this are we
-- allowed to keep"), same answer shape, every time it's asked anywhere in
-- this app.
--
-- Deliberately NOT modeled as more lpm_data_objects rows (the precedent set
-- by 053_eva_lpm_seed.sql, which mapped CASE document types onto the
-- existing strand/substrand/performance_indicator/assessment_item
-- vocabulary). That mapping made sense there because CASE items are
-- genuinely curriculum content. An institutional actor or a policy timeline
-- event is not -- it's a source-document fact, structurally closer to this
-- app's own standards_documents (019) than to anything in lpm_data_objects.
SET search_path = public, extensions;

-- ============================================================================
-- The records themselves.
-- ============================================================================

CREATE TABLE IF NOT EXISTS curriculum_repository_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'institutional-actor', 'institutional-mandate', 'policy-timeline-event',
    'coherence-finding', 'latent-connection', 'curriculum-crosswalk',
    'synthetic-curriculum-redesign', 'policy-principle', 'policy-brief-manifest'
  )),
  -- ISO-3166-1/-2-style, same free-text convention project_jurisdictions
  -- already uses (019) -- no controlled geography vocabulary exists yet.
  jurisdiction TEXT,
  -- Traceability back to the source repo this was ported from -- a
  -- 'deutsche_lp'/'nys_lp'/'india_lp' slug today; not FK'd anywhere, since
  -- those are sibling repos, not rows in this database.
  source_repo TEXT NOT NULL,
  -- The record's own id field in its source repo's YAML, preserved so a
  -- re-import can detect "this record already exists" instead of
  -- duplicating, and so a reviewer can find the original file.
  source_record_id TEXT NOT NULL,
  -- Each of the 9 schemas names its own identifying field differently
  -- (an actor's name, a timeline event's headline, a mandate's title) --
  -- flattened here into one display label so the browsing UI never needs to
  -- know all 9 shapes just to render a list.
  title TEXT NOT NULL,
  -- The full original record, validated schema and all, preserved as-is.
  -- This table is a browsing/linking surface over that content, not a
  -- reinterpretation of it. A 'curriculum-crosswalk' record's own two sides
  -- (level 4 above) live inside this JSONB exactly as the source schema
  -- already shapes them.
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_tier TEXT NOT NULL DEFAULT 'citation-only' CHECK (access_tier IN (
    'full-text-stored', 'excerpt-only', 'summary-only', 'citation-only'
  )),
  license_or_rights_note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_repo, source_record_id)
);

-- ============================================================================
-- Level 1 -- project-to-repository. One LPM project can ground itself in
-- more than one repository (e.g. a comparative US/Germany unit), and more
-- than one LPM project can point at the same repository -- hence its own
-- table rather than a single column on `projects`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_repository_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The LPM project declaring the grounding.
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The curriculum-repository project space (e.g. "Germany Curriculum
  -- Repository") being drawn on. Both sides are ordinary `projects` rows --
  -- a repository space is not a different kind of entity at the schema
  -- level, just a project whose content happens to live in
  -- curriculum_repository_records instead of lpm_data_objects.
  repository_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Optional narrowing, e.g. 'DE-SN' -- "this project draws specifically on
  -- Saxony," not all 16 Länder the repository happens to hold. Null means
  -- the whole repository.
  jurisdiction TEXT,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (project_id <> repository_project_id),
  UNIQUE (project_id, repository_project_id, jurisdiction)
);

-- ============================================================================
-- Level 2 -- record-to-content. The "browse + connect" feature: a project
-- member links their own project's curriculum content to a specific
-- repository record, without needing write access to the repository itself.
-- Kept separate from lpm_connections (010) rather than widened into it --
-- that table's own header comment scopes it to "two data objects," and a
-- Kohärenzfäden-style UI built around it shouldn't have to learn a second
-- kind of endpoint.
--
-- Ownership: the link row belongs to the LINKING project (project_id below),
-- same convention lpm_connections already uses -- its RLS only checks the
-- connection's own project_id, not what the endpoints belong to. This table
-- follows that same precedent deliberately: a member can only ever pick a
-- repository_record_id they can already see (gated separately by
-- curriculum_repository_records' own SELECT policy below), so the link
-- table doesn't need to re-check cross-project visibility itself.
-- ============================================================================

CREATE TABLE IF NOT EXISTS curriculum_repository_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  repository_record_id UUID NOT NULL REFERENCES curriculum_repository_records(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'relates_to',
  rationale TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (data_object_id, repository_record_id, relation_type)
);

-- ============================================================================
-- Level 3 -- shared vocabulary. Tags a repository record against the same
-- frameworks (018) every LPM project already crosswalks its own content
-- against (grade-band, subject-area), so "show me everything in my
-- project's grade band across this repository" works by query, not by
-- requiring a human to have drawn an explicit Level-2 link for every item
-- first. Mirrors project_subject_area_tags' shape exactly (019).
-- ============================================================================

CREATE TABLE IF NOT EXISTS curriculum_repository_record_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_record_id UUID NOT NULL REFERENCES curriculum_repository_records(id) ON DELETE CASCADE,
  framework_tag_id UUID NOT NULL REFERENCES framework_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (repository_record_id, framework_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_repository_records_project ON curriculum_repository_records(project_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_records_type ON curriculum_repository_records(record_type);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_records_source ON curriculum_repository_records(source_repo, source_record_id);
CREATE INDEX IF NOT EXISTS idx_project_repository_links_project ON project_repository_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_repository_links_repository ON project_repository_links(repository_project_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_links_project ON curriculum_repository_links(project_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_links_object ON curriculum_repository_links(data_object_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_links_record ON curriculum_repository_links(repository_record_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_record_tags_record ON curriculum_repository_record_tags(repository_record_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_repository_record_tags_tag ON curriculum_repository_record_tags(framework_tag_id);

ALTER TABLE curriculum_repository_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_repository_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_repository_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_repository_record_tags ENABLE ROW LEVEL SECURITY;

-- Same is_project_member() convention as every other content table (004) --
-- a 'viewer'-role invite is enough to read, matching the "invite-only,
-- per-person browsing" decision this table was built for.
CREATE POLICY "Project members can view repository records" ON curriculum_repository_records
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Maintainers can create repository records" ON curriculum_repository_records
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can update repository records" ON curriculum_repository_records
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can delete repository records" ON curriculum_repository_records
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Visible from either side -- a repository's own members can see which LPM
-- projects reference it, not only the referencing project's own members.
CREATE POLICY "Either side's members can view project repository links" ON project_repository_links
  FOR SELECT USING (is_project_member(project_id) OR is_project_member(repository_project_id));
CREATE POLICY "Maintainers can create project repository links" ON project_repository_links
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can delete project repository links" ON project_repository_links
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Project members can view repository links" ON curriculum_repository_links
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create repository links" ON curriculum_repository_links
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete their own repository links" ON curriculum_repository_links
  FOR DELETE USING (is_project_member(project_id));

CREATE POLICY "Project members can view repository record tags" ON curriculum_repository_record_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM curriculum_repository_records r WHERE r.id = repository_record_id AND is_project_member(r.project_id))
  );
CREATE POLICY "Maintainers can manage repository record tags" ON curriculum_repository_record_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM curriculum_repository_records r WHERE r.id = repository_record_id
        AND has_project_role(r.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_repository_records r WHERE r.id = repository_record_id
        AND has_project_role(r.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

CREATE TRIGGER update_curriculum_repository_records_updated_at
  BEFORE UPDATE ON curriculum_repository_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
