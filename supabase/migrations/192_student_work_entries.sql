SET search_path = public, extensions;

-- Student work for the Uni Jena Biologiedidaktik semester project (WS 2026/27).
-- Susan Hanisch's seminar 2 (9 Nov 2026) asks each student to pick a topic,
-- find matching learning goals in the Thuringia curriculum, judge the Basiskonzept
-- links the tool suggests (technical correctness, contribution to own
-- subject knowledge, didactic relevance), name cross-cutting themes, and hand
-- the result in on Moodle. Until now the tool only held stars on Lernziele
-- (user_favorite_learning_goals) and prompt experiments. Nothing stored the
-- judgments or reflections, and students had no file to hand in.
--
-- Two tables:
--
-- student_work_entries: one row per answer. `kind` and `entry_key` are plain
-- TEXT (open vocabulary, same convention as relation_type and
-- project_dashboard_views.kind), so a later seminar task adds a new kind with
-- no migration. Known kinds today: topic, grade_bands, link_judgment,
-- link_proposal, topic_basiskonzept, cross_cutting, reflection, meta.
--
-- student_activity_events: a private timeline of what the student opened and
-- did. It is separate from activity_log, which every project member can read
-- on the project dashboard. Students see their own events and put them in
-- the process file they hand in; instructors can read all of them.
--
-- Group sharing reuses the choice students already make on their group
-- membership (group_members.share_favorites, migration 077). Reflections and
-- the participant code never leave the student, shared or not.

CREATE TABLE IF NOT EXISTS student_work_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id, kind, entry_key)
);

CREATE INDEX IF NOT EXISTS idx_student_work_entries_project_user ON student_work_entries(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_student_work_entries_project_kind ON student_work_entries(project_id, kind);

ALTER TABLE student_work_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own work entries" ON student_work_entries
  FOR ALL
  USING (user_id = auth.uid() AND is_project_member(project_id))
  WITH CHECK (user_id = auth.uid() AND is_project_member(project_id));

CREATE POLICY "Owners and maintainers can read all work entries" ON student_work_entries
  FOR SELECT USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Fellow group members can read work shared with their group" ON student_work_entries
  FOR SELECT USING (
    kind NOT IN ('reflection', 'meta')
    AND EXISTS (
      SELECT 1
      FROM group_members owner_membership
      JOIN project_groups g ON g.id = owner_membership.group_id
      WHERE owner_membership.user_id = student_work_entries.user_id
        AND owner_membership.share_favorites = TRUE
        AND g.project_id = student_work_entries.project_id
        AND is_group_member(g.id)
    )
  );

CREATE TABLE IF NOT EXISTS student_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_activity_events_project_user ON student_activity_events(project_id, user_id, created_at);

ALTER TABLE student_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students record their own activity" ON student_activity_events
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_project_member(project_id));

CREATE POLICY "Students read their own activity" ON student_activity_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owners and maintainers can read all activity events" ON student_activity_events
  FOR SELECT USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Instructors can see which Lernziele each student starred. The favorites table
-- is otherwise private to its owner (migration 040) with an opt-in group
-- share (migration 077). The students' welcome page says plainly that the
-- instructor can see their starred Lernziele, judgments and groups, so the
-- class overview needs this read path. Scoped to the instructor's own
-- project through the starred Lernziel's project.
CREATE POLICY "Owners and maintainers can read favorites in their project" ON user_favorite_learning_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lpm_data_objects obj
      WHERE obj.id = user_favorite_learning_goals.data_object_id
        AND has_project_role(obj.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES
-- (service_role included since migration 124).
