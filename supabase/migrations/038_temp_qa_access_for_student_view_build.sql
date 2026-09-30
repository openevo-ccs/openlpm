SET search_path = public, extensions;

-- Re-opens the same narrow, single-account QA access removed by migration
-- 037, for the duration of building the student-facing view (real content
-- fields, real thread/connection data, real screenshots needed throughout,
-- not a one-off check). Same account, same 'email' rule type (only ever
-- matches this one exact address). A follow-up migration removes this
-- again once the student-view build is done and verified, batched with
-- whatever else needs cleaning up at that point rather than repeating
-- single-purpose round-trips each time.

DO $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';

  IF v_project_id IS NOT NULL THEN
    INSERT INTO project_join_rules (project_id, rule_type, value, role)
    VALUES (v_project_id, 'email', 'dustin+openlpmtest2@globalesd.org', 'contributor')
    ON CONFLICT (project_id, rule_type, value) DO NOTHING;
  END IF;
END $$;
