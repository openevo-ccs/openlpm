SET search_path = public, extensions;

-- Removes the real disposable QA account's footprint from the real
-- evomentor-thuringia project now that the self-join feature (migration
-- 035/036) has been verified live end to end: the join itself, the
-- notebook-creation bugfix, and the Basiskonzept-label bugfix were all
-- confirmed working against real production data using this account.
-- Dustin confirmed 2026-09-30 this is a closed sandbox he and Susan
-- Hanisch iterate on directly, and asked for the test footprint cleaned
-- up -- this does that: the two test notebooks (portfolios cascade-delete
-- their items/private nodes/links, migration 004), the test membership,
-- and the narrow email-only QA join rule. The real uni-jena.de domain
-- rule from migration 036 is untouched -- that's the actual feature, not
-- test residue. Activity-log entries from the test session are left in
-- place as an honest record rather than scrubbed.

DO $$
DECLARE
  v_project_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  SELECT id INTO v_user_id FROM users WHERE email = 'dustin+openlpmtest2@globalesd.org';

  IF v_project_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    DELETE FROM portfolios WHERE project_id = v_project_id AND owner_id = v_user_id;
    DELETE FROM project_members WHERE project_id = v_project_id AND user_id = v_user_id;
  END IF;

  IF v_project_id IS NOT NULL THEN
    DELETE FROM project_join_rules
    WHERE project_id = v_project_id AND rule_type = 'email' AND value = 'dustin+openlpmtest2@globalesd.org';
  END IF;
END $$;
