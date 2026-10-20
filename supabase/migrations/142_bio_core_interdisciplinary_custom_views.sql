-- Two pieces for the two synthetic LPMs' new German/US custom views
-- (bio-core-sachsen-thueringen-de, bio-core-us-ny-ca-en,
-- interdisciplinary-sachsen-thueringen-de, interdisciplinary-us-ny-ca-en --
-- see src/lib/student-view-templates.ts's own CURRICULUM_CONNECTIONS_VIEWS):
--
-- 1. curriculum_repository_links never got an UPDATE policy (migration 066
--    only gave it SELECT/INSERT/DELETE) -- the single-editable-rationale-
--    per-connection design these views need (2026-10-20 decision) can't
--    actually edit an existing note without one. Added narrower than
--    066's own INSERT/DELETE (is_project_member): using migration 135's
--    is_project_editor() instead, matching that migration's own, more
--    recent tightened convention for content-write policies rather than
--    the older, looser one this table started with.
-- 2. The 4 real project_dashboard_views rows (migration 109) + role-based
--    assignments, so a project member (not just its owner/maintainer, who
--    already see every defined view via the "Preview as" control) gets
--    these as a real option in their own view switcher.

SET search_path = public, extensions;

DROP POLICY IF EXISTS "Editors can update repository link rationale" ON curriculum_repository_links;
CREATE POLICY "Editors can update repository link rationale" ON curriculum_repository_links
  FOR UPDATE USING (is_project_editor(project_id)) WITH CHECK (is_project_editor(project_id));

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_inter_project UUID;
  v_view_id UUID;
  v_role TEXT;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';

  -- Bio-Core: Sachsen/Thüringen (DE)
  INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
  SELECT v_bio_project, 'Sachsen/Thüringen (Deutsch)', 'template', 'bio-core-sachsen-thueringen-de'
  WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_bio_project AND template_id = 'bio-core-sachsen-thueringen-de');
  SELECT id INTO v_view_id FROM project_dashboard_views WHERE project_id = v_bio_project AND template_id = 'bio-core-sachsen-thueringen-de';
  FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'role', v_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Bio-Core: New York / California (EN)
  INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
  SELECT v_bio_project, 'New York / California (US)', 'template', 'bio-core-us-ny-ca-en'
  WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_bio_project AND template_id = 'bio-core-us-ny-ca-en');
  SELECT id INTO v_view_id FROM project_dashboard_views WHERE project_id = v_bio_project AND template_id = 'bio-core-us-ny-ca-en';
  FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'role', v_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Interdisciplinary: Sachsen/Thüringen (DE)
  INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
  SELECT v_inter_project, 'Sachsen/Thüringen (Deutsch)', 'template', 'interdisciplinary-sachsen-thueringen-de'
  WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_inter_project AND template_id = 'interdisciplinary-sachsen-thueringen-de');
  SELECT id INTO v_view_id FROM project_dashboard_views WHERE project_id = v_inter_project AND template_id = 'interdisciplinary-sachsen-thueringen-de';
  FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'role', v_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Interdisciplinary: New York / California (EN)
  INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
  SELECT v_inter_project, 'New York / California (US)', 'template', 'interdisciplinary-us-ny-ca-en'
  WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_inter_project AND template_id = 'interdisciplinary-us-ny-ca-en');
  SELECT id INTO v_view_id FROM project_dashboard_views WHERE project_id = v_inter_project AND template_id = 'interdisciplinary-us-ny-ca-en';
  FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'role', v_role)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $MIGRATION$;
