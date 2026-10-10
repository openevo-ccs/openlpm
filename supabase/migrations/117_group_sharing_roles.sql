SET search_path = public, extensions;

-- Real feedback (Dustin, 2026-10-09, row 771f5fa2): "the groups page on
-- this researcher view should enable selected roles to determine the
-- functions ... of users within groups." The Groups feature (migrations
-- 075-077) already lets an owner restrict WHO may create/delete a group
-- (group_creator_roles) -- the one real gap is that once a group exists,
-- ANY member can unilaterally share their own Notebook or Favorites into
-- it, with no way for an owner to restrict that. This adds the same kind
-- of role list for sharing specifically, mirroring group_creator_roles'
-- own shape and the can_manage_groups() pattern.
--
-- NULL (not an empty array) means "unrestricted" -- every current and
-- newly-enabled project keeps today's real behavior (any member can
-- share) unless an owner explicitly sets a role list. An empty array is a
-- real, different, more restrictive state (owner/maintainer only, via the
-- same unconditional-admin fallback can_manage_groups already uses) --
-- distinguishing NULL from [] here is what keeps turning this on from
-- silently changing behavior for every group already in use.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS group_sharing_roles project_member_role[];

CREATE OR REPLACE FUNCTION can_share_in_group(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    has_project_role(p_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    OR NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = p_project_id AND p.group_sharing_roles IS NOT NULL)
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = p_project_id AND project_role(p_project_id) = ANY(p.group_sharing_roles)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Notebooks: the existing blanket "owner manages their own portfolio"
-- policy gets one extra condition on writes -- setting visibility to
-- 'group' (or editing an already-group-visible portfolio) now also needs
-- can_share_in_group. Every other write (private/shared/project
-- visibility, content edits, delete) is completely unaffected.
DROP POLICY IF EXISTS "Owners manage their own portfolios" ON portfolios;
CREATE POLICY "Owners manage their own portfolios" ON portfolios
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (visibility IS DISTINCT FROM 'group' OR can_share_in_group(project_id))
  );

-- Favorites group-sharing: turning share_favorites OFF is always a user's
-- own call (no permission needed to stop sharing); turning it ON now
-- needs can_share_in_group for that group's project.
DROP POLICY IF EXISTS "A user can update their own group membership" ON group_members;
CREATE POLICY "A user can update their own group membership" ON group_members
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      share_favorites = FALSE
      OR EXISTS (SELECT 1 FROM project_groups g WHERE g.id = group_id AND can_share_in_group(g.project_id))
    )
  );
