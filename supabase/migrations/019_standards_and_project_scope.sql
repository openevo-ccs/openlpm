-- Builds the rest of RFC 0003 (standards document versioning) plus RFC
-- 0004's structured-project-scope idea, both formally Accepted 2026-09-06,
-- neither ever migrated (verified directly against all prior migrations).
-- One deliberate change from RFC-0004's original design: it proposed a
-- single nullable `jurisdiction` string per project; the 2026-09-13
-- restructure needs "one or more states within or across one or more
-- countries," which a single string can't express -- so this uses a real
-- one-to-many table instead. `working_languages` (already live since
-- migration 015) is left untouched -- it already does the multi-language
-- job correctly.
--
-- uuid-ossp lives in the `extensions` schema on this project -- see
-- migration 018's comment for why. Same fix here.
SET search_path = public, extensions;

-- ============================================================================
-- Standards documents: real version lineage for an ingested curriculum/
-- standards source, per RFC-0003 section 3.
-- ============================================================================

CREATE TABLE IF NOT EXISTS standards_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  jurisdiction TEXT,
  subject TEXT,
  school_type TEXT,
  grade_range TEXT,
  version_label TEXT NOT NULL,
  -- Whether a jurisdiction requires this document or a school/teacher may
  -- optionally choose it -- Dustin's explicit ask that a framework's status
  -- as mandated-vs-optional be stated plainly, not left ambiguous.
  adoption_status TEXT NOT NULL DEFAULT 'mandated' CHECK (adoption_status IN ('mandated', 'optional')),
  source_file TEXT,
  format TEXT,
  license_or_rights_note TEXT,
  supersedes_document_id UUID REFERENCES standards_documents(id) ON DELETE SET NULL,
  adopted_at DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- An ingested learning objective always knows which document-version it
-- came from; supersession is derived from the document chain above, not
-- duplicated onto every row.
ALTER TABLE lpm_data_objects ADD COLUMN IF NOT EXISTS standards_document_id UUID REFERENCES standards_documents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS standards_item_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_item_id UUID REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  to_item_id UUID REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  -- Open, growing enum seeded from RFC-0003's own real Thuringia
  -- 2024-2026 diff categories -- collapsing to a single generic "modified"
  -- would hide which changes are substantive vs. cosmetic.
  change_type TEXT NOT NULL CHECK (change_type IN (
    'content-added', 'content-removed', 'wording-refinement',
    'wording-simplification', 'example-changed', 'restructured', 'grade-band-split'
  )),
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Either side may be null (pure addition or pure removal), but not both.
  CHECK (num_nonnulls(from_item_id, to_item_id) >= 1)
);

CREATE TABLE IF NOT EXISTS standards_item_framework_relevance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  framework_tag_id UUID NOT NULL REFERENCES framework_tags(id) ON DELETE CASCADE,
  relevance INTEGER NOT NULL CHECK (relevance BETWEEN 1 AND 3),
  justification TEXT,
  related_tag_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (item_id, framework_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_standards_documents_project ON standards_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_data_objects_standards_document ON lpm_data_objects(standards_document_id);
CREATE INDEX IF NOT EXISTS idx_standards_item_changes_from ON standards_item_changes(from_item_id);
CREATE INDEX IF NOT EXISTS idx_standards_item_changes_to ON standards_item_changes(to_item_id);
CREATE INDEX IF NOT EXISTS idx_standards_item_framework_relevance_item ON standards_item_framework_relevance(item_id);
CREATE INDEX IF NOT EXISTS idx_standards_item_framework_relevance_tag ON standards_item_framework_relevance(framework_tag_id);

ALTER TABLE standards_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_item_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_item_framework_relevance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view standards documents" ON standards_documents
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can manage standards documents" ON standards_documents
  FOR ALL USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can view standards item changes" ON standards_item_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lpm_data_objects o WHERE o.id IN (from_item_id, to_item_id) AND is_project_member(o.project_id)
    )
  );
CREATE POLICY "Project members can manage standards item changes" ON standards_item_changes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id IN (from_item_id, to_item_id) AND is_project_member(o.project_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id IN (from_item_id, to_item_id) AND is_project_member(o.project_id))
  );

CREATE POLICY "Project members can view framework relevance tags" ON standards_item_framework_relevance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = item_id AND is_project_member(o.project_id))
  );
CREATE POLICY "Project members can manage framework relevance tags" ON standards_item_framework_relevance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = item_id AND is_project_member(o.project_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = item_id AND is_project_member(o.project_id))
  );

-- ============================================================================
-- Structured project scope: geography, grade-band framework link,
-- subject-area tags, and source/rights declarations -- everything the new
-- "Start new project" wizard needs to collect, per Dustin's explicit list.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_jurisdictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- ISO-3166-1 alpha-2 (e.g. 'DE'), and ISO-3166-2-style region code when
  -- the project's scope is one or more states/provinces within a country
  -- (e.g. 'DE-BY' for Bavaria). Deliberately plain text, not FK'd to a
  -- geography table -- no controlled geography vocabulary exists anywhere
  -- in this ecosystem yet, matching RFC-0004's own "no controlled
  -- vocabulary imposed yet" precedent for jurisdiction/subject/school_type.
  country_code TEXT NOT NULL,
  region_code TEXT,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, country_code, region_code)
);

-- Which grade-band framework (seeded reference, another project's real
-- scheme, or a custom one) this project's own content is sequenced against.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS grade_framework_id UUID REFERENCES frameworks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS project_subject_area_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  framework_tag_id UUID NOT NULL REFERENCES framework_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, framework_tag_id)
);

-- What's being imported, in what format, and confirmation of rights to use
-- it -- captured per-source since a project may draw on more than one.
-- Same shape as the existing project_base_links table.
CREATE TABLE IF NOT EXISTS project_source_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  format TEXT,
  license_or_rights_note TEXT,
  url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_jurisdictions_project ON project_jurisdictions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_subject_area_tags_project ON project_subject_area_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_project_subject_area_tags_tag ON project_subject_area_tags(framework_tag_id);
CREATE INDEX IF NOT EXISTS idx_project_source_declarations_project ON project_source_declarations(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_grade_framework ON projects(grade_framework_id);

ALTER TABLE project_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_subject_area_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_source_declarations ENABLE ROW LEVEL SECURITY;

-- These three are project-identity facts, same governance level as
-- region_tags/theme_tags on `projects` itself -- readable by any member,
-- editable only by owners/maintainers (mirrors project_base_links exactly).
CREATE POLICY "Project members can view jurisdictions" ON project_jurisdictions
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Maintainers can manage jurisdictions" ON project_jurisdictions
  FOR ALL USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Project members can view subject area tags" ON project_subject_area_tags
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Maintainers can manage subject area tags" ON project_subject_area_tags
  FOR ALL USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Project members can view source declarations" ON project_source_declarations
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Maintainers can manage source declarations" ON project_source_declarations
  FOR ALL USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
