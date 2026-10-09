SET search_path = public, extensions;

-- OpenLPM Dashboard Custom Views. Real feedback 63321a17 (Dustin,
-- EvoMentor Thuringia): replace the single, all-or-nothing "Preview as
-- student" toggle (migration 045) with named, admin-managed views, each
-- assignable to a specific person, an existing Group (migration 075), or a
-- role/join-method class, and each either optional-to-switch-to or
-- forced-default.
--
-- `kind` and the assignment table's `target_type` are plain TEXT, not a
-- Postgres ENUM -- same open-vocabulary convention this schema already
-- uses for relation_type/action_type/student_view_template, and chosen
-- here specifically so a new view kind or a new way to target people
-- never needs its own schema migration, only a new value. Known values
-- today: kind IN ('standard', 'template'); target_type IN ('user',
-- 'group', 'role', 'join_method').

CREATE TABLE IF NOT EXISTS project_dashboard_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- 'standard': the normal researcher sidebar, narrowed to page_keys.
  -- 'template': one whole, hand-built alternate page set, named by
  -- template_id (student-view-templates.ts's registry -- today just
  -- 'jena-biologiedidaktik-de'). The two are deliberately not mixed: a
  -- template's pages aren't generic building blocks a checklist can pick
  -- from, so a 'template' view ignores page_keys entirely and a 'standard'
  -- view ignores template_id entirely (enforced below).
  kind TEXT NOT NULL DEFAULT 'standard',
  -- 'standard' kind only. Keys match the shared page registry
  -- (src/lib/dashboard-view-pages.ts) that both the sidebar and the
  -- settings-page checklist read from -- a page added to that registry
  -- later becomes checkable here with no schema change.
  page_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- 'template' kind only.
  template_id TEXT,
  -- At most one default per project (enforced below). Whoever doesn't
  -- match a more specific assignment (person/group/role/join-method) falls
  -- back to this view, if one is set -- otherwise they fall back to the
  -- full researcher view, same as every project that never defines any
  -- views at all.
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  -- Forced = no switcher, this is what they see, full stop. Optional =
  -- they can switch to it or away from it. Never actually locks an
  -- owner/maintainer's own session regardless of this flag or what
  -- they're assigned to -- enforced in application code
  -- (resolveViewerViews), matching this app's existing, deliberate
  -- invariant that an instructor's own session can never be accidentally
  -- locked into a simplified view.
  is_forced BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (kind = 'standard' AND template_id IS NULL)
    OR (kind = 'template' AND template_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_dashboard_views_one_default
  ON project_dashboard_views (project_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_project_dashboard_views_project
  ON project_dashboard_views(project_id);

CREATE TABLE IF NOT EXISTS project_dashboard_view_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  view_id UUID NOT NULL REFERENCES project_dashboard_views(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  -- 'user' -> a users.id; 'group' -> a project_groups.id; 'role' -> a
  -- project_member_role value; 'join_method' -> 'self_join_rule' or
  -- 'direct' (joined_via IS NULL -- added or invited rather than
  -- self-joined). Resolved in application code rather than a DB FK, since
  -- the column's meaning depends on target_type -- same convention
  -- project_join_rules' own rule_type + value pair already uses.
  target_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (view_id, target_type, target_value)
);

CREATE INDEX IF NOT EXISTS idx_project_dashboard_view_assignments_view
  ON project_dashboard_view_assignments(view_id);

ALTER TABLE project_dashboard_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_dashboard_view_assignments ENABLE ROW LEVEL SECURITY;

-- Every project member can see the views and who they're assigned to --
-- same "roster-adjacent info visible to any member" precedent Groups
-- (migration 075) uses, and unlike project_join_rules/project_invites
-- (owner/maintainer only): a member has to read the whole assignment list
-- to work out which view applies to THEM, not just a row naming them by
-- id.
CREATE POLICY "Project members can view dashboard views" ON project_dashboard_views
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Owners and maintainers can create dashboard views" ON project_dashboard_views
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can update dashboard views" ON project_dashboard_views
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can delete dashboard views" ON project_dashboard_views
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Project members can view dashboard view assignments" ON project_dashboard_view_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_dashboard_views v WHERE v.id = view_id AND is_project_member(v.project_id))
  );
CREATE POLICY "Owners and maintainers can create dashboard view assignments" ON project_dashboard_view_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_dashboard_views v
      WHERE v.id = view_id AND has_project_role(v.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );
CREATE POLICY "Owners and maintainers can delete dashboard view assignments" ON project_dashboard_view_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_dashboard_views v
      WHERE v.id = view_id AND has_project_role(v.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

-- Seed: the existing Jena pilot template becomes the first real named
-- view, reproducing today's exact behavior (every self-joined
-- non-manager sees it, unconditionally, no opt-out) so evomentor-thuringia
-- doesn't change behavior the moment this ships. Not marked is_default --
-- today, anyone who DIDN'T self-join (added directly) sees the full
-- researcher view, and that stays true; is_forced=true is what reproduces
-- "no opt-out" for the self-joined audience specifically.
DO $$
DECLARE
  v_project_id UUID;
  v_view_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NOT NULL THEN
    INSERT INTO project_dashboard_views (project_id, name, kind, template_id, is_default, is_forced)
    VALUES (v_project_id, 'Jena Biologiedidaktik (Deutsch)', 'template', 'jena-biologiedidaktik-de', FALSE, TRUE)
    RETURNING id INTO v_view_id;

    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'join_method', 'self_join_rule');
  END IF;
END $$;

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
