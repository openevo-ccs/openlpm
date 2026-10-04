SET search_path = public, extensions;

-- Real gap found while building a way for an ordinary LPM project (e.g.
-- evomentor-thuringia) to show which Curriculum Repository document(s) its
-- own content was built from, and flag when the Repository has since
-- published a newer edition -- triggered by a real incident 2026-10-04
-- (see lab_manager's germany-curriculum-repository-vs-evomentor-thuringia-
-- relation-2026-10-04.md): EvoMentor Thuringia's content and the Germany
-- Curriculum Repository are built from the same real documents by the same
-- people, through two pipelines that never reference each other, so a
-- curriculum update has to be independently noticed and fixed in both
-- places.
--
-- Migration 066 already built the full "browse + connect" infrastructure
-- for exactly this (project_repository_links, curriculum_repository_links,
-- curriculum_repository_record_tags) -- confirmed live, zero rows in any
-- of the three tables anywhere in the database. The reason it was never
-- useful from the CONTENT side: curriculum_repository_records' own SELECT
-- policy only ever admitted members of the record's own project (the
-- Repository itself). A plain evomentor-thuringia member -- which is
-- almost everyone who'd actually want to see this, since Repository
-- membership and pilot-project membership don't overlap in practice -- has
-- no read access to the very records their own project's content would
-- point at. The existing "browse + connect" UI works today only because
-- it's used from the Repository's OWN page, by someone who is a Repository
-- member connecting content from a project they are ALSO a member of.
--
-- Fix: once a project declares itself grounded in a repository
-- (project_repository_links, the PROJECT-level link -- migration 066's own
-- "Level 1"), its members can read every record in that repository, not
-- just ones already individually linked. This also means a newly
-- published successor edition becomes visible automatically the moment it
-- exists, without needing its own separate content-link first -- exactly
-- the case that matters for a "newer edition available" flag to have
-- anything real to point at.
CREATE POLICY "Project-repository-link members can view records" ON curriculum_repository_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_repository_links pl
      WHERE pl.repository_project_id = curriculum_repository_records.project_id
        AND is_project_member(pl.project_id)
    )
  );

COMMENT ON POLICY "Project-repository-link members can view records" ON curriculum_repository_records IS
  'Lets a project''s own members read a Curriculum Repository''s records once that project has declared itself grounded in it (project_repository_links), without requiring separate membership in the Repository itself. Postgres combines this with the existing "Project members can view repository records" policy as OR -- a Repository''s own members keep their existing access unchanged.';
