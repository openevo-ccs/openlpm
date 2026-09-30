SET search_path = public, extensions;

-- Builds the real cross-project admin page scoped in
-- lab_manager/docs/design-notes/openlpm-system-wide-admin-page-scoping-2026-09-30.md
-- (feedback 908d1311). Three things, all additive:
--
-- 1. A reusable is_admin() helper, SECURITY DEFINER same as is_project_member()
--    (migration 004) and is_portfolio_owner() (migration 009) -- needed because,
--    unlike migration 033's feedback policies (which check users.role from a
--    DIFFERENT table's policy), the new policies below need a users.role check
--    from policies ON users itself. A plain inline EXISTS subquery there would
--    have the policy re-enter its own table's RLS and recurse, exactly the
--    failure migration 009 already fixed once for portfolios/portfolio_shares.
--
-- 2. Additive SELECT/UPDATE/DELETE policies on project_members, project_join_rules,
--    and projects, so an admin can see and manage every project's membership and
--    self-join rules from one page, not just the projects they happen to belong
--    to. Postgres ORs multiple permissive policies together, so every existing
--    policy (owner/maintainer, member-of, self-join-eligible, etc.) keeps working
--    unchanged for everyone else -- these only ever ADD visibility/reach, never
--    remove any.
--
-- 3. users.blocked_at -- a new, genuinely new capability (nothing like it existed
--    before): a reversible sign-in lock. NULL means not blocked. Enforcement is
--    client-side (src/state/session.tsx signs a blocked user back out the moment
--    it notices blocked_at is set) -- deliberately the simpler of two real options
--    weighed in the design note, not the stronger "revoke via Supabase Auth admin
--    API" approach, which would need a new Edge Function and the service_role key
--    in a trusted server context. Proportionate to a low-stakes internal tool;
--    the real residual tradeoff (an already-issued access token stays valid until
--    its own natural ~1hr expiry) is accepted and documented, not hidden.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- users: migration 001's "Users can update own profile" (auth.uid() = id) can't
-- cover an admin blocking/unblocking SOMEONE ELSE's row.
CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE USING (is_admin());

-- project_members: migration 004's own policies only ever cover a project's own
-- members (SELECT) or its owners/maintainers (INSERT/UPDATE/DELETE) -- none of
-- those make an admin, as such, able to see or manage a project they don't
-- belong to at all.
CREATE POLICY "Admins can view all project membership" ON project_members
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update any membership" ON project_members
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can remove any membership" ON project_members
  FOR DELETE USING (is_admin());

-- project_join_rules: migration 035's policies are owner/maintainer-only, same
-- reasoning as project_members above.
CREATE POLICY "Admins can view all join rules" ON project_join_rules
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can create any join rule" ON project_join_rules
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can delete any join rule" ON project_join_rules
  FOR DELETE USING (is_admin());

-- projects: needed so the admin directory can show a project's name even for a
-- private project (migration 025) the admin isn't a member of and didn't create.
CREATE POLICY "Admins can view all projects" ON projects
  FOR SELECT USING (is_admin());

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
