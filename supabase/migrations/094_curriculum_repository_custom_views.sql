-- Curriculum Repository Custom Views -- the general custom-view-layer
-- system flagged as future work in migration 072's own comment and in
-- lab_manager's curriculum-repository-distinct-ontology-2026-10-01.md,
-- scoped and decided 2026-10-03 (see lab_manager's
-- openlpm-curriculum-context-modeling-2026-10-03.md, "Curriculum Repository
-- Custom Views" section).
--
-- A custom view (e.g. "Teachers," "Translated FR") is an ordinary `projects`
-- row -- same reasoning migration 072 already used for `curriculum-repository`
-- itself: it still needs everything projects already provide (membership,
-- invites, self-join rules, deletion), and a wholly separate entity/
-- permission system was explicitly ruled out. `parent_project_id` (migration
-- 015, already recursive) points at the real Curriculum Repository it's a
-- view of.
--
-- Dustin's explicit decision on the one real open question (access model):
-- each custom view keeps its OWN separate project_members -- never
-- inherited or synced from its parent. A "teachers" view can be opened to a
-- much wider group than the underlying repository's tightly-invited
-- membership; a translated view can be shared with a different country's
-- partners without giving them the full archive. This needs no new schema
-- at all -- handle_new_project (migration 015) already auto-enrolls a new
-- row's own creator as owner, independent of any parent.
--
-- view_audience/view_language are open vocabulary (like relation_type,
-- student_view_template elsewhere in this schema) rather than enums -- a new
-- audience or language is a new entry in a small frontend registry, never a
-- migration.
SET search_path = public, extensions;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_kind_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_kind_check
  CHECK (project_kind IN ('standard', 'curriculum-repository', 'curriculum-repository-custom-view'));

COMMENT ON COLUMN projects.project_kind IS
  'standard = ordinary LPM project (full sidebar). curriculum-repository = a curated source archive (Curriculum Repositories space + its Germany/New York/future sub-repositories) -- reduced sidebar (Dashboard + the Curriculum Repository browser only), listed in its own section rather than alongside ordinary project spaces. curriculum-repository-custom-view = an audience/language-specific view of one real Curriculum Repository (parent_project_id) -- same reduced sidebar, but never listed in the main project switcher at all; only reachable from its parent''s Settings "Custom Views" card, or its own direct URL once created.';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_audience TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_language TEXT;

COMMENT ON COLUMN projects.view_audience IS
  'Free text, only meaningful on a curriculum-repository-custom-view row -- which audience this view was built for (e.g. "teachers", "researchers"). Filled from a small registry in lib/custom-views.ts rather than a DB enum, so a new audience never needs a migration.';
COMMENT ON COLUMN projects.view_language IS
  'Free text, only meaningful on a curriculum-repository-custom-view row -- which language this view was translated/adapted into (e.g. "fr", "de"). Filled from the same registry as view_audience rather than a DB enum.';

-- A real gap, caught now instead of after shipping: migration 066's own
-- "Project members can view repository records" policy gates SELECT on
-- is_project_member(project_id) -- DIRECT membership in the record's own
-- project only. A custom view's whole point is letting someone see a
-- repository's content WITHOUT being a member of the repository itself
-- (Dustin's own decision above), so without this extension, every custom
-- view's Repository browser tab would silently show "No records match" to
-- anyone who isn't also, separately, a member of the parent -- defeating
-- the feature. Membership in a curriculum-repository-custom-view whose
-- parent_project_id is this record's project_id now also admits read access
-- to that record -- read-only: INSERT/UPDATE/DELETE stay maintainer-only on
-- the repository itself, unchanged.
DROP POLICY IF EXISTS "Project members can view repository records" ON curriculum_repository_records;
CREATE POLICY "Project members or their custom views can view repository records" ON curriculum_repository_records
  FOR SELECT USING (
    is_project_member(project_id)
    OR EXISTS (
      SELECT 1 FROM projects v
      WHERE v.parent_project_id = curriculum_repository_records.project_id
        AND v.project_kind = 'curriculum-repository-custom-view'
        AND is_project_member(v.id)
    )
  );
