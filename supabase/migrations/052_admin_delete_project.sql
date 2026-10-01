SET search_path = public, extensions;

-- Real feature request (2026-10-01): Dustin wants an actual "delete a
-- project" button -- both for himself (the system admin page) and for a
-- project's own owner (its Dashboard page) -- rather than no in-app way to
-- remove one at all, not even a disposable test project, without a raw
-- service_role write outside the app (exactly the gap three throwaway test
-- projects from this same day's verification work ran into).
--
-- Two additive DELETE policies, same split as every other capability this
-- app already has: a project's own owner can delete THEIR OWN project (not
-- maintainer -- this is more destructive than anything else maintainer can
-- already do, so the bar is higher), and the system admin (is_admin(),
-- migration 049) can delete ANY project, matching the reach migration 049
-- already gave admins over users/project_members/project_join_rules but
-- stopped short of projects itself.
--
-- Every project-scoped table already cascades on projects.id ON DELETE
-- CASCADE (migrations 004/010/011/013/018/019/020/027/030/035 etc.) --
-- deleting a project genuinely removes its own content, not just the row.
-- Two real exceptions, both ON DELETE SET NULL, not CASCADE:
--   - projects.parent_project_id (migration 015): deleting a Project Space
--     does NOT delete the sub-projects inside it -- they'd silently become
--     orphaned, top-level projects instead. Both UIs that call this (the
--     admin Projects section, the Dashboard page's Danger Zone) check for
--     sub-projects first and refuse to proceed while any exist, rather than
--     relying on this DB behavior.
--   - feedback.project_id (migration 026): feedback about a deleted project
--     stays around, just no longer scoped to a project -- deliberately kept,
--     not lost, same reasoning that row already had before this migration.
CREATE POLICY "Owners can delete their own project" ON projects
  FOR DELETE USING (has_project_role(id, ARRAY['owner']::project_member_role[]));
CREATE POLICY "Admins can delete any project" ON projects
  FOR DELETE USING (is_admin());
