SET search_path = public, extensions;

-- Real feedback 4c7f4471 (Dustin Eirdosh, 2026-10-20), confirmed via RLS
-- role-impersonation (an owner/admin account resolved all 3 region project
-- ids fine, a plain viewer account resolved zero): a plain project viewer
-- (not an owner/admin) sees no real-world curriculum connections in the
-- Sachsen/Thueringen + New York/California custom views, and the "Add
-- connection" picker shows nothing either.
--
-- Every curriculum-repository-kind project is seeded is_private = TRUE
-- (081_curriculum_repository_by_nation.sql's own comment: "invite-only").
-- 025_project_privacy.sql's SELECT policy on `projects` only admits a
-- private project's own members (or creator) -- so a viewer who is a
-- member of evomentor-thuringia, but never individually invited to e.g.
-- germany-curriculum-repository, can't read that repository's own
-- `projects` row at all. listRepositoryRecordsForRegionSlugs (src/lib/
-- supabase/curriculum-repository.ts) resolves its region slugs to ids by
-- querying `projects` first -- that query comes back empty, so every
-- record lookup that follows is empty too, even though 105_project_
-- repository_link_members_can_view_records.sql already unlocked the
-- records themselves for exactly this case.
--
-- Fix: same shape as 105's own fix, one level up -- once a project
-- declares itself grounded in a repository (project_repository_links),
-- its members can also read the repository's own `projects` row, not
-- just the records inside it. Postgres combines this with 025's existing
-- policy as OR, so a repository's own members and a private repository's
-- other existing readers keep their access unchanged.
CREATE POLICY "Project-repository-link members can view the repository project row" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_repository_links pl
      WHERE pl.repository_project_id = projects.id
        AND is_project_member(pl.project_id)
    )
  );

COMMENT ON POLICY "Project-repository-link members can view the repository project row" ON projects IS
  'Lets a project''s own members read a linked Curriculum Repository''s own projects row (needed to resolve its slug to an id) once that project has declared itself grounded in it via project_repository_links -- mirrors 105''s record-level fix one table up.';
