-- openevo-lpm: a formal OpenLPM home for the committee-governed synthesis
-- effort already underway in openevo-graph/lpm/. Full governance model is
-- documented there (openevo-graph/lpm/README.md) and is not duplicated or
-- re-implemented here -- this migration only gives that effort a real,
-- addressable Project Space, the same way eva-lpm just got one
-- (053_eva_lpm_seed.sql), so its existence and real grounding are visible
-- and linkable from inside OpenLPM while deliberation continues elsewhere.
--
-- What is deliberately NOT seeded here, and why: openevo-graph/lpm/ has
-- produced zero accepted strand-drafts so far. Its one working case (the
-- cheetah running-speed DCR-vs-ICR comparison, og:case:cheetah-running-speed)
-- is still blocked on an unresolved 2-2 committee tie
-- (og:lpm-proposal:cheetah-case-p4, deferred 2026-09-04) over whether the
-- strand-draft needs dedicated equity sections. Per that repo's own
-- governance rule 4 ("no content reaches main without consensus + check +
-- human sign-off") and rule 6 ("every claim must ground to a real id --
-- never fabricated"), nothing is pre-written into lpm_data_objects/
-- lpm_connections/theories here. This project starts structurally empty,
-- the same way eva-lpm's Sachsen-Anhalt and US-Interdisciplinary
-- sub-projects did -- a real, described, addressable home, ready to receive
-- real content once the committee actually produces and signs off on it.
--
-- Privacy: is_private = TRUE, matching every other early-stage/unreviewed
-- project in OpenLPM (eva-lpm included) -- there is a live human-review gate
-- this content hasn't passed yet, not a judgment that it never should be
-- public. Trivial to flip once real signed-off content exists.
--
-- Ownership: 053_eva_lpm_seed.sql shipped without created_by/project_members,
-- following migration 005's old no-real-accounts-yet bootstrap precedent --
-- that precedent no longer holds, and it made all 5 eva-lpm projects
-- invisible (is_private=TRUE + no owner + RLS only shows a private project
-- to a member/creator/admin) until a same-day follow-up fix
-- (055_eva_lpm_owner_membership.sql). Folding that same fix in directly here
-- instead of repeating the mistake and needing a 057 to clean it up.

DO $MIGRATION$
DECLARE
  v_openevo_lpm_id UUID := '3c9a1f52-9d64-4b1a-8e2c-7a0f6d9b4c21';
  v_user_id UUID;
BEGIN

  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)
  VALUES (
    v_openevo_lpm_id,
    'openevo-lpm',
    'OpenEvo LPM',
    'The OpenEvo CCS ecosystem''s single, canonical Learning Progression Model: built from a genuinely empty starting point, incrementally, through a governed multi-agent review process (modeled on a real committee -- analyst, domain-expert, evolutionary-theory, equity-auditor, synthesis, facilitator roles) rather than authored directly. Every claim must trace to a real id already living in a base repo (TheoryBase, QuestionBase, LiteratureBase, ConceptBase, CompetencyBase, HumanBase) or be logged as an open gap -- nothing is invented. Deliberately not modeled on the bio-core-k12/interdisciplinary-k12 synthetic comparison pair, which are intentional thought experiments; this project is meant to become real, maximally cross-referenced content as the ecosystem''s central synthesis point, not a controlled sandbox. The actual deliberation process (committees, proposals, votes, session logs) runs in openevo-graph/lpm/, not here -- this Project Space is its real, addressable home for whatever that process formally signs off on, plus, going forward, the place that output gets cross-linked against every other LPM project in the ecosystem. Currently empty: one case study (comparing two competing explanations for cheetah running speed, standing in for a wider dispute over how much agency evolution lessons should give organisms) is mid-review, blocked on one unresolved committee tie -- see openevo-graph/lpm/committees/cheetah-case/notebook.md.',
    'active',
    'in-development',
    'Not a thought experiment and not yet field-validated -- a live, committee-governed synthesis process with a hard human-sign-off gate that hasn''t been exercised yet. Zero accepted strand-drafts so far; one case study is actively under review.',
    'hosted',
    TRUE,
    'draft',
    NULL,
    'general',
    '{}'::TEXT[],
    '{}'::TEXT[],
    ARRAY['en']::TEXT[]
  )
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)
  VALUES (v_openevo_lpm_id, 'conceptbase', TRUE, FALSE)
  ON CONFLICT (project_id, base_repo) DO NOTHING;

  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, url)
  VALUES (
    v_openevo_lpm_id,
    'openevo-graph/lpm/ -- the live committee-deliberation process this project is the formal home for (branches/committees/proposals/votes/session-logs)',
    'og: namespace records (YAML), governed by openevo-graph/lpm/README.md',
    'Lab-internal governance process, not externally licensed content. No content has cleared this process''s own human sign-off gate yet.',
    NULL
  );

  SELECT id INTO v_user_id FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users row found for dustin.eirdosh@eva.mpg.de -- openevo-lpm was seeded without an owner. Add one manually (project_members + projects.created_by) once that account exists.';
  ELSE
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (v_openevo_lpm_id, v_user_id, 'owner')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

    UPDATE projects SET created_by = v_user_id
    WHERE id = v_openevo_lpm_id AND created_by IS NULL;
  END IF;

END $MIGRATION$;
