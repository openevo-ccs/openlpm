SET search_path = public, extensions;

-- Two independent, small additions:
--
-- 1. Favorites (student view) group-sharing. Unlike Notebooks, a favorite
--    has no per-item visibility field to extend -- adding one would mean a
--    second icon next to the star on every Lernziel card, which is exactly
--    the clutter migration 040 was written to avoid. Sharing is instead a
--    single per-group-membership choice: "share my favorites with this
--    group," off by default, same private-by-default spirit as the
--    feature itself. See lab_manager's docs/design-notes/
--    openlpm-groups-feature-2026-10-02.md.
--
-- 2. Method-level favorites (real feedback 7b32d01c, Susan Hanisch,
--    2026-10-02: "add possibility to tag individual methods as
--    favorits") -- a second, separate favorites table, since a teaching
--    method is an option-list string key (prompt-builder.tsx), not a row
--    in any canonical table, unlike a Lernziel. No group-sharing for this
--    one -- nobody has asked for that yet.

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS share_favorites BOOLEAN NOT NULL DEFAULT FALSE;

-- Members manage their own share_favorites flag (the only field on their
-- own membership row they should be able to change themselves -- role-like
-- fields don't exist on group_members at all, so there's nothing else here
-- to accidentally expose).
CREATE POLICY "A user can update their own group membership" ON group_members
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Lets a fellow member of a group SEE another member's favorite rows, but
-- only for a group that member has explicitly opted into sharing with, and
-- only within that group's own project (a favorite has no project_id of
-- its own -- derived here from the favorited Lernziel's project). Matches
-- "owners/maintainers can always open a group's synthesis" via
-- can_manage_groups, same as the Notebooks extension (migration 076).
CREATE POLICY "Fellow group members can see favorites shared with that group" ON user_favorite_learning_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM group_members owner_membership
      JOIN project_groups g ON g.id = owner_membership.group_id
      JOIN lpm_data_objects obj ON obj.id = user_favorite_learning_goals.data_object_id AND obj.project_id = g.project_id
      WHERE owner_membership.user_id = user_favorite_learning_goals.user_id
        AND owner_membership.share_favorites = TRUE
        AND (is_group_member(g.id) OR can_manage_groups(g.project_id))
    )
  );

CREATE TABLE IF NOT EXISTS user_favorite_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The option list's own stable value (prompt-builder.tsx / option_lists.methods),
  -- not a foreign key -- methods are a fixed vocabulary, not a database row.
  method_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, method_key)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_methods_user ON user_favorite_methods(user_id);

ALTER TABLE user_favorite_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own favorite methods" ON user_favorite_methods
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
