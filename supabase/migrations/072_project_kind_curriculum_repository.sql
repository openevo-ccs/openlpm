-- project_kind: marks a project as a Curriculum Repository (a curated
-- source archive) rather than an ordinary LPM project -- real feedback
-- 8e9545c6 ("Curriculum Repositories needs its own distinct section, it
-- is not just a project space, but a unique part of the OpenLPM ontology")
-- and d9522fb3 ("they won't have theories, literature, review, etc.
-- necessarily -- we need to carefully consider this").
--
-- Scoped directly from a 2026-10-01 conversation with Dustin: a Curriculum
-- Repository stays a `projects` row -- it still needs everything projects
-- already provide (membership, invites, self-join rules, the admin
-- directory, deletion) and rebuilding all of that as a wholly separate
-- entity/permission system was explicitly ruled out for now, as a bigger,
-- riskier build than this session should take on unilaterally. What
-- genuinely changes is which sidebar tabs render (src/pages/dashboard/
-- project-layout.tsx) and which section of each project listing it
-- appears in (project-switcher-page.tsx, admin-users-page.tsx) -- real,
-- structural differences, not just a label.
--
-- Deliberately the same shape as student_view_template (045) -- a plain
-- project-level flag that picks an alternate UI treatment. Dustin asked
-- explicitly that this be thought about alongside that mechanism: he
-- wants an eventual general system for creating/curating/finding/managing
-- "custom view layers" for any project space (student_view_template is
-- the first real instance of that idea; this is the second -- see
-- lab_manager/docs/design-notes/curriculum-repository-distinct-ontology-
-- 2026-10-01.md). That generalization is its own future design
-- conversation and is NOT built here -- project_kind stays a narrow,
-- single-purpose column today, not a preview of that bigger system's API.
SET search_path = public, extensions;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_kind TEXT NOT NULL DEFAULT 'standard'
  CHECK (project_kind IN ('standard', 'curriculum-repository'));

COMMENT ON COLUMN projects.project_kind IS
  'standard = ordinary LPM project (full sidebar). curriculum-repository = a curated source archive (Curriculum Repositories space + its Germany/New York/future sub-repositories) -- reduced sidebar (Dashboard + the Curriculum Repository browser only), listed in its own section rather than alongside ordinary project spaces.';

-- Backfill the 3 real projects already live under this ontology (migration
-- 066/067's own import target).
UPDATE projects SET project_kind = 'curriculum-repository'
  WHERE slug IN ('curriculum-repositories', 'germany-curriculum-repository', 'new-york-curriculum-repository');
