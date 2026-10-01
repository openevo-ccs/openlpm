-- Curriculum Repository: a new project-scoped content type for curated
-- national/regional curriculum-policy source material (institutional actors,
-- policy timelines, mandates, coherence findings, crosswalks, etc.) ported
-- from the deutsche-lpm/nys-lpm sibling repos -- plus linking at three
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
-- Deliberately NOT modeled as more lpm_data_objects rows (the precedent set
-- by 053_eva_lpm_seed.sql, which mapped CASE document types onto the
-- existing strand/substrand/performance_indicator/assessment_item
-- vocabulary). That mapping made sense there because CASE items are
-- genuinely curriculum content. An institutional actor or a policy timeline
-- event is not -- it's a source-document fact, structurally closer to this
-- app's own standards_documents (019) than to anything in lpm_data_objects.
--
-- Renumbered 062 -> 066 (real version-number collision with a concurrent
-- session's own migration today -- see that session's 063_relink_
-- basiskonzept_subconcept_tags_fix.sql). Every CREATE POLICY/TRIGGER below
-- is now written drop-first so this file is safe to re-run regardless of
-- how far an earlier, differently-numbered push attempt got -- CREATE TABLE/
-- INDEX were already IF NOT EXISTS; policies and the trigger were not,
-- which is exactly what failed in this same session's other concurrent
-- migration (065_project_color.sql, "column already exists"). Also fixes a
-- real wrong assumption in the original version of this file's closing
-- comment: service_role gets NOTHING automatically in this project (confirmed
-- directly from 047/048/051/054, every one of which grants it something
-- explicit) -- "Data API grants extend automatically via 006's ALTER DEFAULT
-- PRIVILEGES" was true for the anon/authenticated roles the app itself uses,
-- not for service_role, which scripts/import_curriculum_repository.py needs
-- for its own writes. Added those grants at the bottom, narrowly, matching
-- 047/048/051/054's own precedent.
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
  jurisdiction TEXT,
  source_repo TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  title TEXT NOT NULL,
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
-- Level 1 -- project-to-repository.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_repository_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  jurisdiction TEXT,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (project_id <> repository_project_id),
  UNIQUE (project_id, repository_project_id, jurisdiction)
);

-- ============================================================================
-- Level 2 -- record-to-content ("browse + connect").
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
-- Level 3 -- shared vocabulary.
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

DROP POLICY IF EXISTS "Project members can view repository records" ON curriculum_repository_records;
CREATE POLICY "Project members can view repository records" ON curriculum_repository_records
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Maintainers can create repository records" ON curriculum_repository_records;
CREATE POLICY "Maintainers can create repository records" ON curriculum_repository_records
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can update repository records" ON curriculum_repository_records;
CREATE POLICY "Maintainers can update repository records" ON curriculum_repository_records
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can delete repository records" ON curriculum_repository_records;
CREATE POLICY "Maintainers can delete repository records" ON curriculum_repository_records
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

DROP POLICY IF EXISTS "Either side's members can view project repository links" ON project_repository_links;
CREATE POLICY "Either side's members can view project repository links" ON project_repository_links
  FOR SELECT USING (is_project_member(project_id) OR is_project_member(repository_project_id));
DROP POLICY IF EXISTS "Maintainers can create project repository links" ON project_repository_links;
CREATE POLICY "Maintainers can create project repository links" ON project_repository_links
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can delete project repository links" ON project_repository_links;
CREATE POLICY "Maintainers can delete project repository links" ON project_repository_links
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

DROP POLICY IF EXISTS "Project members can view repository links" ON curriculum_repository_links;
CREATE POLICY "Project members can view repository links" ON curriculum_repository_links
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Project members can create repository links" ON curriculum_repository_links;
CREATE POLICY "Project members can create repository links" ON curriculum_repository_links
  FOR INSERT WITH CHECK (is_project_member(project_id));
DROP POLICY IF EXISTS "Project members can delete their own repository links" ON curriculum_repository_links;
CREATE POLICY "Project members can delete their own repository links" ON curriculum_repository_links
  FOR DELETE USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Project members can view repository record tags" ON curriculum_repository_record_tags;
CREATE POLICY "Project members can view repository record tags" ON curriculum_repository_record_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM curriculum_repository_records r WHERE r.id = repository_record_id AND is_project_member(r.project_id))
  );
DROP POLICY IF EXISTS "Maintainers can manage repository record tags" ON curriculum_repository_record_tags;
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

DROP TRIGGER IF EXISTS update_curriculum_repository_records_updated_at ON curriculum_repository_records;
CREATE TRIGGER update_curriculum_repository_records_updated_at
  BEFORE UPDATE ON curriculum_repository_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- service_role grants -- this project grants nothing to service_role
-- automatically (confirmed against 047/048/051/054); scripts/
-- import_curriculum_repository.py needs these specific, narrow ones to
-- create the two repository project spaces and upsert records into them.
-- ============================================================================

GRANT INSERT ON public.projects TO service_role;
GRANT INSERT ON public.project_members TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.curriculum_repository_records TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.project_repository_links TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.curriculum_repository_links TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.curriculum_repository_record_tags TO service_role;
