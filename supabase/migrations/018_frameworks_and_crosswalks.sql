-- Finally builds RFC 0003's frameworks/framework_tags/framework_crosswalks
-- data model, which was formally Accepted 2026-09-06 but never migrated
-- (verified directly: no migration since has touched it, and the proposal
-- itself still says "migration TBD pending review"). Generalized beyond the
-- Basiskonzepte-only scope RFC-0003 originally described, per the
-- 2026-09-13 restructure: the same versioned, crosswalkable mechanism now
-- also serves subject-area and grade-band/educational-stage taxonomies,
-- which didn't exist as a concept when RFC-0003 was written. Confirmed with
-- Lab Manager (cross-repo governance) before building, since other
-- OpenEvo-ecosystem repos may eventually want to reuse this rather than each
-- inventing their own grade-band/subject vocabulary -- ConceptBase's own
-- schema already reserves a `subjectSchema`/`gradeSchema` slot for exactly
-- this, marked "Phase 3, not yet built" (conceptbase/schemas/common.defs.yaml).
--
-- Deliberately does NOT touch lpm_schema_elements or migrate the existing
-- Basiskonzepte data into these new tables -- that's real, already-live
-- content the Jena pilot depends on today. That migration is a separate,
-- carefully-verified step alongside the Concepts page rebuild (next phase of
-- this restructure), not bundled into this purely-additive schema pass.
--
-- uuid-ossp now lives in the `extensions` schema on this project (a
-- platform-level move since migrations 001-017 were applied -- their own
-- unqualified uuid_generate_v4() calls only ever worked because they ran
-- before that move). Setting search_path explicitly rather than qualifying
-- every call, so this migration reads the same as its predecessors.
SET search_path = public, extensions;

CREATE TYPE framework_type AS ENUM ('concept-taxonomy', 'subject-area', 'grade-band');

CREATE TABLE IF NOT EXISTS frameworks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Nullable: a small number of ecosystem-shared frameworks (seeded below)
  -- are visible to every project rather than each project re-importing its
  -- own copy -- RFC-0003's own explicit provision for this.
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  framework_type framework_type NOT NULL,
  framework_key TEXT NOT NULL UNIQUE CHECK (framework_key ~ '^[a-z0-9-]+$'),
  label TEXT NOT NULL,
  source TEXT,
  version_note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS framework_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  framework_id UUID NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  tag_key TEXT NOT NULL,
  label TEXT NOT NULL,
  parent_tag_id UUID REFERENCES framework_tags(id) ON DELETE SET NULL,
  definition TEXT,
  -- Used by grade-band (chronological order) and concept-taxonomy (a
  -- curator's intended reading order among siblings); left null for
  -- subject-area, which has no inherent order among sibling terms.
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (framework_id, tag_key)
);

CREATE TYPE framework_crosswalk_confidence AS ENUM ('exact', 'approximate', 'structural', 'none');

-- SKOS's own mapping vocabulary -- what KIND of correspondence, orthogonal
-- to how confident we are in it (framework_crosswalk_confidence above). A
-- subject-area crosswalk needs both questions answered separately: "Biology
-- narrowMatch Life Sciences" is a different claim than "Biology exactMatch
-- Biologie," not just a lower-confidence version of the same claim.
-- Grade-band and concept-taxonomy crosswalks can just use exactMatch/
-- broadMatch and ignore the extra expressiveness subject-area needs.
CREATE TYPE framework_crosswalk_relation AS ENUM ('exactMatch', 'broadMatch', 'narrowMatch', 'relatedMatch');

CREATE TABLE IF NOT EXISTS framework_crosswalks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_tag_id UUID NOT NULL REFERENCES framework_tags(id) ON DELETE CASCADE,
  to_tag_id UUID NOT NULL REFERENCES framework_tags(id) ON DELETE CASCADE,
  relation_type framework_crosswalk_relation NOT NULL DEFAULT 'exactMatch',
  -- A `none` row (considered, no real counterpart found) is a legitimate,
  -- real assertion -- RFC-0003's own precedent, not an omission to fill in
  -- later.
  confidence framework_crosswalk_confidence NOT NULL,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (from_tag_id <> to_tag_id),
  UNIQUE (from_tag_id, to_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_frameworks_project ON frameworks(project_id);
CREATE INDEX IF NOT EXISTS idx_frameworks_type ON frameworks(framework_type);
CREATE INDEX IF NOT EXISTS idx_framework_tags_framework ON framework_tags(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_tags_parent ON framework_tags(parent_tag_id);
CREATE INDEX IF NOT EXISTS idx_framework_crosswalks_from ON framework_crosswalks(from_tag_id);
CREATE INDEX IF NOT EXISTS idx_framework_crosswalks_to ON framework_crosswalks(to_tag_id);

-- ============================================================================
-- RLS -- same is_project_member()/has_project_role() convention as every
-- other project-scoped table (migration 004), extended for the nullable
-- project_id (a NULL-project row is a shared reference framework: readable
-- by anyone signed in, writable by nobody through the app -- seeded below by
-- this migration, running as the table owner, not through RLS).
-- ============================================================================

ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_crosswalks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view frameworks" ON frameworks
  FOR SELECT USING (auth.uid() IS NOT NULL AND (project_id IS NULL OR is_project_member(project_id)));
CREATE POLICY "Maintainers can create project frameworks" ON frameworks
  FOR INSERT WITH CHECK (project_id IS NOT NULL AND has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can update project frameworks" ON frameworks
  FOR UPDATE USING (project_id IS NOT NULL AND has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can delete project frameworks" ON frameworks
  FOR DELETE USING (project_id IS NOT NULL AND has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Signed-in users can view framework tags" ON framework_tags
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM frameworks f WHERE f.id = framework_id AND (f.project_id IS NULL OR is_project_member(f.project_id))
    )
  );
CREATE POLICY "Maintainers can manage framework tags" ON framework_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM frameworks f WHERE f.id = framework_id
        AND f.project_id IS NOT NULL
        AND has_project_role(f.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM frameworks f WHERE f.id = framework_id
        AND f.project_id IS NOT NULL
        AND has_project_role(f.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

CREATE POLICY "Signed-in users can view framework crosswalks" ON framework_crosswalks
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM framework_tags t JOIN frameworks f ON f.id = t.framework_id
      WHERE t.id = from_tag_id AND (f.project_id IS NULL OR is_project_member(f.project_id))
    )
  );
CREATE POLICY "Maintainers can manage framework crosswalks" ON framework_crosswalks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM framework_tags t JOIN frameworks f ON f.id = t.framework_id
      WHERE t.id = from_tag_id AND f.project_id IS NOT NULL
        AND has_project_role(f.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM framework_tags t JOIN frameworks f ON f.id = t.framework_id
      WHERE t.id = from_tag_id AND f.project_id IS NOT NULL
        AND has_project_role(f.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

CREATE TRIGGER update_frameworks_updated_at BEFORE UPDATE ON frameworks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed: one ecosystem-shared, age-anchored grade-band reference framework.
--
-- Grounded directly in Wikipedia's "Educational stage" article (fetched
-- 2026-09-13) and UNESCO's ISCED levels: grade COUNT diverges even for
-- identical age ranges (Germany's own Gymnasium track has run both an
-- 8-year and a 9-year secondary model across different states and years --
-- Bavaria's current G9 reform is exactly Dustin's "13 grades beyond
-- kindergarten" case; China and Japan both use 6+3+3; India moved to a
-- 5+3+3+4 model in 2020), so age, not grade count, is the only anchor that
-- actually crosswalks across systems. Each project's own real local grade
-- scheme (Bavaria's 13 grades, a US K-12 scheme, etc.) registers as its own
-- `grade-band` framework and crosswalks its bands to this reference scale --
-- not built here, since no such local scheme exists in this migration's
-- scope yet.
-- ============================================================================

INSERT INTO frameworks (project_id, framework_type, framework_key, label, source, version_note) VALUES
  (NULL, 'grade-band', 'isced-age-bands-v1', 'ISCED-aligned age bands (reference)',
   'UNESCO International Standard Classification of Education (ISCED); Wikipedia "Educational stage"',
   'Reference crosswalk target only -- not any single country''s actual grade scheme. Project-local grade-band frameworks should crosswalk to this by age, not by grade count.');

INSERT INTO framework_tags (framework_id, tag_key, label, definition, sort_order)
SELECT f.id, v.tag_key, v.label, v.definition, v.sort_order
FROM frameworks f, (VALUES
  ('isced-0', 'ISCED 0 -- Early childhood', 'Ages approximately 3-5. Pre-primary education.', 0),
  ('isced-1', 'ISCED 1 -- Primary', 'Ages approximately 6-11.', 1),
  ('isced-2', 'ISCED 2 -- Lower secondary', 'Ages approximately 12-14.', 2),
  ('isced-3', 'ISCED 3 -- Upper secondary', 'Ages approximately 15-18/19. Covers the widest real-world variation in grade count for the same age span (e.g. an 8-year vs. 9-year Gymnasium track).', 3),
  ('isced-4-plus', 'ISCED 4+ -- Post-secondary', 'Post-secondary non-tertiary and tertiary (undergraduate and beyond). Combined into one band here since this reference exists for K-12 crosswalking; split further only if a real project needs it.', 4)
) AS v(tag_key, label, definition, sort_order)
WHERE f.framework_key = 'isced-age-bands-v1';

-- ============================================================================
-- Seed: one starter subject-area taxonomy, exactly the worked example
-- Dustin gave (Biology -> part of -> Life Sciences -> part of -> Science),
-- as a single framework's own internal hierarchy (parent_tag_id), not a
-- crosswalk -- crosswalks are for reconciling two DIFFERENT frameworks
-- (e.g. two projects' own vocabularies), which doesn't apply yet since this
-- is the only subject-area framework that exists. Real cross-framework
-- crosswalk rows get added once a second real vocabulary actually needs
-- reconciling against this one, not fabricated here as a demo.
-- ============================================================================

INSERT INTO frameworks (project_id, framework_type, framework_key, label, source, version_note) VALUES
  (NULL, 'subject-area', 'starter-subject-areas-v1', 'Starter subject-area taxonomy (reference)',
   NULL,
   'A small starting hierarchy, extensible per-project the same way grade-bands are. Not a complete or authoritative subject classification -- the first real subject-area vocabulary anywhere in the OpenEvo ecosystem, seeded to unblock the project-creation wizard.');

INSERT INTO framework_tags (framework_id, tag_key, label, parent_tag_id)
SELECT f.id, 'science', 'Science', NULL FROM frameworks f WHERE f.framework_key = 'starter-subject-areas-v1';

INSERT INTO framework_tags (framework_id, tag_key, label, parent_tag_id)
SELECT f.id, 'life-sciences', 'Life Sciences', t.id
FROM frameworks f JOIN framework_tags t ON t.framework_id = f.id AND t.tag_key = 'science'
WHERE f.framework_key = 'starter-subject-areas-v1';

INSERT INTO framework_tags (framework_id, tag_key, label, parent_tag_id)
SELECT f.id, 'biology', 'Biology', t.id
FROM frameworks f JOIN framework_tags t ON t.framework_id = f.id AND t.tag_key = 'life-sciences'
WHERE f.framework_key = 'starter-subject-areas-v1';

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
