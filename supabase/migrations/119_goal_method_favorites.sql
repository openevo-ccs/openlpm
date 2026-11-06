SET search_path = public, extensions;

-- Real feedback 3f22dcd5 (Susan Hanisch, 2026-10-09): "the option to tag
-- favorite methods is not supposed to apply to the general method (like
-- 'Diskussion' in this example) but to the specific method suggestion
-- related to the learning goal given here." The existing
-- user_favorite_methods table (migration 077) favorites a method NAME
-- globally -- fine for the Lernziele sidebar's own filter checkboxes
-- (unchanged by this migration) and the Prompt Generator's general methods
-- checklist (also unchanged), but wrong for the per-Lernziel suggestion
-- star inside the "Didaktische Strategien" section, which needs its own
-- (learning goal, method) scoped favorite instead of reusing the global
-- key.
CREATE TABLE IF NOT EXISTS user_favorite_goal_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  -- Same "not a foreign key, methods are a fixed vocabulary string" choice
  -- user_favorite_methods already made (migration 077's own comment).
  method_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, data_object_id, method_key)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_goal_methods_user ON user_favorite_goal_methods(user_id);
-- Drives "which of my favorited methods are relevant to these selected
-- learning goals" in the Prompt Generator -- a lookup by data_object_id
-- across a user's own favorites.
CREATE INDEX IF NOT EXISTS idx_user_favorite_goal_methods_object ON user_favorite_goal_methods(user_id, data_object_id);

ALTER TABLE user_favorite_goal_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own goal-method favorites" ON user_favorite_goal_methods
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
