SET search_path = public, extensions;

-- Turns on self-serve joining for the real Uni Jena Biologiedidaktik Winter
-- Semester 2026 pilot, directly on the existing evomentor-thuringia project
-- -- not a new empty sub-project. Checked directly first: Concepts/schema
-- elements resolve up to a parent project when a child's own schema is
-- empty (concepts-page.tsx), but Learning Goals (lpm_data_objects, the
-- real ~300 Thuringia Lernziele) do NOT -- they're read strictly by the
-- viewing project's own id (learning-goals-page.tsx), with no such
-- fallback. A brand-new child project for the class would have started
-- with zero curriculum content and broken task 1 ("explore the curriculum")
-- on day one. evomentor-thuringia already has the real data and the
-- already-working 3-task pilot flow (Explore -> Notebook -> Prompt
-- Generator) -- that's this project's own space.
--
-- uni-jena.de is the real, verified student/staff email domain (confirmed
-- against the university's own "Accounts & e-mail services" page,
-- 2026-09-30) -- not a guess.
--
-- 'contributor' as the joining role: enough to create/edit Notebooks and
-- generate prompts (the real 3-task pilot work), not enough to manage
-- membership, change project settings, or edit the shared Concepts/Learning
-- Goals taxonomy itself -- matches the role already used as the default
-- suggestion in the "Add people" invite form for this kind of case.
--
-- This is a starting point, not a lock-in: an owner/maintainer can add,
-- remove, or change this (and add more rules, e.g. a specific email for a
-- guest student on a non-uni-jena address) any time from the project's own
-- Dashboard > Members > "Let people join themselves" section -- no
-- migration needed for that going forward.

-- Also adds one narrow, temporary QA rule for a single real test account
-- (dustin+openlpmtest2@globalesd.org -- a real, disposable sign-up under
-- Dustin's own inbox, created this session to verify the whole feature
-- against production before reporting it done) -- an 'email' rule, not a
-- 'domain' one, so it can only ever match that one exact address, never
-- open the door more broadly. Safe to remove any time from Dashboard >
-- Members > "Let people join themselves" -- flagged plainly, not hidden.

DO $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';

  IF v_project_id IS NOT NULL THEN
    INSERT INTO project_join_rules (project_id, rule_type, value, role)
    VALUES
      (v_project_id, 'domain', 'uni-jena.de', 'contributor'),
      (v_project_id, 'email', 'dustin+openlpmtest2@globalesd.org', 'contributor')
    ON CONFLICT (project_id, rule_type, value) DO NOTHING;
  END IF;
END $$;
