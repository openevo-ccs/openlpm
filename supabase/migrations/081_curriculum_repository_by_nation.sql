SET search_path = public, extensions;

-- Real feedback 283570ae (Dustin Eirdosh, 2026-10-02): "now that Curriculum
-- Repositories is a project_kind, we don't need the top level 'Curriculum
-- Repositories' -- rather we should organize it by nation, so let's have a
-- Germany Curriculum Repository, a US curriculum repository, an India
-- Curriculum Repository, etc... with states being sub-projects within
-- nations."
--
-- Today: a generic 'curriculum-repositories' hub project (migration 066 /
-- scripts/import_curriculum_repository.py's own PARENT_PROJECT) sits as
-- the one top-level entry, with germany-curriculum-repository and
-- new-york-curriculum-repository both nested under IT as its children --
-- the exact flat "one top-level Curriculum Repositories tile" shape
-- Dustin's feedback asks to retire, now that project_kind =
-- 'curriculum-repository' already does the "which projects are
-- repositories" categorization the hub existed for (migration 072).
--
-- This promotes Germany to its own real top-level nation entry, adds a
-- real United States entry, and reparents New York under it as a state --
-- the nesting UI (project-switcher-page.tsx's childrenOf) is already
-- fully generic by parent_project_id, so no frontend change is needed.
-- The now-childless 'curriculum-repositories' hub itself is deliberately
-- NOT touched here -- removing a whole project is a separate, deliberate
-- step (scripts/delete_project.mjs), not something to fold into a data
-- migration.
--
-- Germany's own content is already tagged per real state internally
-- (curriculum_repository_records.jurisdiction, e.g. 'DE-TH' for
-- Thuringia) but all of it lives in this one germany-curriculum-repository
-- project -- splitting that into real per-state sub-projects the way New
-- York is its own project is a separate, larger piece of work if ever
-- wanted, not attempted here. India is a real future addition (the import
-- script's own hub description already anticipated it) -- not created yet
-- since there's no real content for it.

-- Matches germany-curriculum-repository/new-york-curriculum-repository's
-- own real seeded fields exactly (scripts/import_curriculum_repository.py)
-- rather than leaving them at the projects table's generic defaults --
-- is_private=TRUE in particular, since every curriculum-repository-kind
-- project today is invite-only (curriculum-repository-page.tsx's own
-- header comment) and the column's table default is FALSE.
INSERT INTO projects (slug, name, description, project_kind, is_private, epistemic_status, epistemic_status_note, focus_type, region_tags, created_by)
SELECT
  'united-states-curriculum-repository',
  'United States Curriculum Repository',
  'Curated US national/state curriculum-policy source material, browsable by invited OpenLPM users and linkable from any LPM project''s own content.',
  'curriculum-repository',
  TRUE,
  'field-validated-curriculum',
  'Real, sourced curriculum-policy material; individual records carry their own verificationStatus/review_status for finer-grained trust.',
  'regional',
  ARRAY['US'],
  (SELECT created_by FROM projects WHERE slug = 'curriculum-repositories')
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = 'united-states-curriculum-repository');

UPDATE projects SET parent_project_id = NULL
  WHERE slug = 'germany-curriculum-repository';

UPDATE projects SET parent_project_id = (SELECT id FROM projects WHERE slug = 'united-states-curriculum-repository')
  WHERE slug = 'new-york-curriculum-repository';

-- Carry over the old hub's own members (beyond its owner, who the INSERT
-- above already carried as created_by) to the new US entry, so nobody
-- loses access they were specifically given -- a harmless no-op if the hub
-- had no members beyond its owner.
INSERT INTO project_members (project_id, user_id, role, invited_by)
SELECT (SELECT id FROM projects WHERE slug = 'united-states-curriculum-repository'), pm.user_id, pm.role, pm.invited_by
FROM project_members pm
WHERE pm.project_id = (SELECT id FROM projects WHERE slug = 'curriculum-repositories')
ON CONFLICT (project_id, user_id) DO NOTHING;
