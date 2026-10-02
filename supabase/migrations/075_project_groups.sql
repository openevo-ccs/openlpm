SET search_path = public, extensions;

-- OpenLPM "Groups": a real middle tier between "just me" and "the whole
-- project" -- decided with Dustin 2026-10-02 (see lab_manager's
-- docs/design-notes/openlpm-groups-feature-2026-10-02.md). A project owner
-- turns this on; project members then self-organize into one or more
-- groups, each with its own shared view built from members' own
-- Notebooks/Favorites (added in migrations 076/077). Deleting a group only
-- ever removes the grouping itself -- never a member's own content.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS groups_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Who, BESIDES owner/maintainer (who can always create/delete a group, same
-- unconditional-admin pattern as membership/join-rule management
-- elsewhere), may also create or delete one. Empty by default -- most
-- projects that turn Groups on will want only owner/maintainer managing the
-- group list itself, while every member (any role) can still join one.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS group_creator_roles project_member_role[] NOT NULL DEFAULT ARRAY[]::project_member_role[];

CREATE TABLE IF NOT EXISTS project_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_groups_project ON project_groups(project_id);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- ============================================================================
-- Helper functions (SECURITY DEFINER, mirrors is_project_member/project_role
-- from migration 004) -- needed so a policy on another table can check
-- group membership or group-management rights without recursing into
-- group_members'/project_groups' own RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- True for an owner/maintainer of the group's own project (who can always
-- manage groups) OR someone holding one of that project's configured
-- group_creator_roles. Owners/maintainers also use this to open any group's
-- synthesis view without joining it (decided 2026-10-02) -- see its use in
-- migrations 076/077.
-- `= ANY((SELECT array_col FROM ...))` (an earlier, broken draft of this
-- function) parses as "equal to ANY row returned by the subquery," where
-- each row's single column must itself be the SAME scalar type being
-- compared -- not as array-membership, even though the subquery's column
-- happens to hold an array. Confirmed live by Dustin's own migration run,
-- 2026-10-02: "operator does not exist: project_member_role =
-- project_member_role[]". Referencing the array column directly inside an
-- EXISTS (not through a bare scalar subquery passed to ANY) is what makes
-- Postgres treat it as a real array value instead.
CREATE OR REPLACE FUNCTION can_manage_groups(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT has_project_role(p_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = p_project_id AND project_role(p_project_id) = ANY(p.group_creator_roles)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE project_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Every project member can see the group list -- needed to even offer
-- "join" as a choice. Matches project_members' own "any member sees the
-- whole team" precedent (migration 004).
CREATE POLICY "Project members can view groups" ON project_groups
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Permitted roles can create groups" ON project_groups
  FOR INSERT WITH CHECK (can_manage_groups(project_id));
CREATE POLICY "Permitted roles can delete groups" ON project_groups
  FOR DELETE USING (can_manage_groups(project_id));

-- Any project member can see a group's roster (who's in it already) -- same
-- reasoning as project_members: you need to see who's there to decide
-- whether to join. A user can always join/leave themselves; a permitted
-- role can also add/remove someone directly (e.g. moving a confused
-- student into the right group) -- additive, same pattern
-- project_join_rules uses alongside direct invites (migration 035).
CREATE POLICY "Project members can view group rosters" ON group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_groups g WHERE g.id = group_id AND is_project_member(g.project_id))
  );
CREATE POLICY "A user can join a group themselves" ON group_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM project_groups g WHERE g.id = group_id AND is_project_member(g.project_id))
  );
CREATE POLICY "Permitted roles can add anyone to a group" ON group_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM project_groups g WHERE g.id = group_id AND can_manage_groups(g.project_id))
  );
CREATE POLICY "A user can leave a group themselves" ON group_members
  FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Permitted roles can remove anyone from a group" ON group_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM project_groups g WHERE g.id = group_id AND can_manage_groups(g.project_id))
  );

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
