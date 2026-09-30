SET search_path = public, extensions;

-- Removes this session's QA footprint from evomentor-thuringia now that the
-- student view is built, live-verified end to end, and about to deploy:
-- the test account's membership, its one favorited Lernziel, and the
-- narrow email-only join rule that granted it access (migration 038). The
-- real uni-jena.de domain rule (migration 036) is untouched -- that's the
-- actual pilot mechanism, not test residue. No saved prompt_experiments
-- rows exist to clean up -- the walkthrough only previewed prompts, never
-- clicked Save.

DO $$
DECLARE
  v_project_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  SELECT id INTO v_user_id FROM users WHERE email = 'dustin+openlpmtest2@globalesd.org';

  IF v_user_id IS NOT NULL THEN
    DELETE FROM user_favorite_learning_goals WHERE user_id = v_user_id;
  END IF;

  IF v_project_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    DELETE FROM project_members WHERE project_id = v_project_id AND user_id = v_user_id;
  END IF;

  IF v_project_id IS NOT NULL THEN
    DELETE FROM project_join_rules
    WHERE project_id = v_project_id AND rule_type = 'email' AND value = 'dustin+openlpmtest2@globalesd.org';
  END IF;
END $$;
