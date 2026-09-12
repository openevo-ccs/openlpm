-- lpm_schema_elements got a project_id column in migration 004 (moving it onto
-- the per-project role system every other content table uses), but its lone
-- UPDATE policy from migration 001 was never revisited: it still checks the
-- legacy global `users.role IN ('admin', 'editor')` column, which no signup
-- path or trigger has ever set (handle_new_auth_user() only ever defaults
-- `role` to 'contributor' -- see migration 003/013). Net effect: .update() on
-- this table RLS-blocks for every real user, including a project owner/
-- maintainer the UI's own canManage check says should be able to edit
-- (schema-page.tsx) -- PostgREST returns success with 0 rows changed, no
-- error, so the re-import-from-ConceptBase flow silently no-ops instead of
-- updating anything. Replacing with the same has_project_role(owner/
-- maintainer) convention migration 004 already established for `projects`
-- and every project-scoped management action since.
DROP POLICY IF EXISTS "Editors can update schema elements" ON lpm_schema_elements;
CREATE POLICY "Owners and maintainers can update schema elements" ON lpm_schema_elements
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
