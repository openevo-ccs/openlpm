SET search_path = public, extensions;

-- Lets a project owner mark their whole project space private: invisible to
-- anyone who isn't a member, not just its content -- every content table
-- already correctly scopes reads to is_project_member() (migrations 004 and
-- 022's discussion_posts fix) -- but the project row's own existence, name,
-- and description, which migration 004 deliberately made visible to any
-- signed-in user ("a browsable directory"). This is the one real gap that
-- was standing in for "OpenLPM has no way to host a genuinely private
-- project" -- concretely, why 'eva-lpm' was removed rather than kept as a
-- seed project (008_swap_eva_lpm_for_sachsen.sql): claiming it here would
-- have exposed a real, not-yet-decided MPI-EVA project to every OpenLPM
-- user, with no way to prevent that.
--
-- Deliberately a separate concept from hosting_mode ('hosted' vs.
-- 'self-hosted', migration 004) -- that column describes where the data
-- physically runs, this one describes who can see it exists. Conflating
-- "private" with "needs its own separate infrastructure" is what made this
-- look like it required a whole self-hosted copy of the app; it only ever
-- needed this one column and one policy.

ALTER TABLE projects ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;
CREATE POLICY "Public projects are visible to all; private ones to members and their creator" ON projects
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      is_private = FALSE
      OR is_project_member(id)
      -- Also check created_by directly, not just membership: the row's own
      -- INSERT...RETURNING is evaluated before the AFTER INSERT trigger
      -- (on_project_created, migration 004) has enrolled the creator as a
      -- project_members row, so a brand-new private project's creator
      -- wouldn't reliably see their own just-created row back without this.
      OR created_by = auth.uid()
    )
  );
