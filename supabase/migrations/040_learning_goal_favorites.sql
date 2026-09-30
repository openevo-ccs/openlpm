SET search_path = public, extensions;

-- A real gap found while matching OpenLPM's Learning Goals against
-- EvoMentor DE's own real, field-used app: EvoMentor lets a teacher star a
-- Lernziel and filter/scope by "nur Favoriten" (including as a prompt-
-- generator scope option, "Meine Favoriten") -- OpenLPM has no favoriting
-- concept anywhere. Needed for the new student-facing view to genuinely
-- match that real, proven pattern rather than drop it. Per-user, not
-- per-project-shared -- a favorite is a personal working-set marker, same
-- private-by-default spirit as Notebooks.

CREATE TABLE IF NOT EXISTS user_favorite_learning_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, data_object_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorite_learning_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_object ON user_favorite_learning_goals(data_object_id);

ALTER TABLE user_favorite_learning_goals ENABLE ROW LEVEL SECURITY;

-- A user can only ever see/manage their own favorites -- never shared,
-- never visible to other project members, no project-membership check
-- needed since a favorite pointing at a data object the user can no
-- longer see is simply unreachable through the normal UI query pattern
-- (joined against lpm_data_objects, which has its own RLS).
CREATE POLICY "Users manage their own favorites" ON user_favorite_learning_goals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
