SET search_path = public, extensions;

-- A real, recurring friction point across this whole build: verifying
-- anything against evomentor-thuringia's real content needed a temporary
-- join rule added, used, then cleaned up -- repeated at least 4 times this
-- session alone. Dustin confirmed directly (2026-09-30) this project is a
-- closed sandbox he and Susan Hanisch iterate on, and asked for exactly
-- this kind of self-imposed friction removed. This makes ONE narrow,
-- permanent exception: a single real disposable test account
-- (dustin+openlpmtest2@globalesd.org, routes to Dustin's own real inbox
-- via plus-addressing) stays eligible to self-join evomentor-thuringia
-- going forward -- an 'email' rule, so it can only ever match that one
-- exact address, never opens the door more broadly. Used by
-- layout_check/capture.mjs and any future openlpm-design-session
-- verification pass. Not cleaned up after use anymore -- that's the
-- point.

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
