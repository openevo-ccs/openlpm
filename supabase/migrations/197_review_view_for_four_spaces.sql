-- A "Review" view for the reviewer role in the four synthetic spaces.
--
-- Why. Expert review happens inside the spaces. The three comparison views (Deutschland, United States, Cross-national) are
-- assigned to the roles viewer, reviewer, contributor and editor, so a reviewer's sidebar holds only comparison pages. The pages
-- where review work happens (Learning goals, Concepts, Theories, Strands, Literature, Review, Discussions, Time) opened only by
-- typing their address.
--
-- What it does. For each of the four spaces it adds one standard view named "Review" with those pages, makes it the DEFAULT view
-- of the reviewer role (not forced, so a reviewer can still switch to the comparison views from the "Viewing" dropdown), and
-- assigns it to the role reviewer. The dashboard page is always visible in a standard view.
--
-- It is safe to run twice (it checks for an existing view). Owners and maintainers see every view and are not affected.
-- Companion code: resolveViewerViews in src/lib/supabase/dashboard-views.ts now lets a default view win over equal matches.
--
-- Source of this fix: docs/design-notes/openlpm-four-space-review-2026-10-28.md (lab_manager), item N13 and Decision 3.
-- Applying it is a production database write and waits for Dustin.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_slug TEXT;
  v_project UUID;
  v_view UUID;
  v_added INTEGER := 0;
BEGIN
  FOREACH v_slug IN ARRAY ARRAY['bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth'] LOOP
    SELECT id INTO v_project FROM projects WHERE slug = v_slug;
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'Project % not found', v_slug;
    END IF;

    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND kind = 'standard' AND name = 'Review';
    IF v_view IS NULL THEN
      INSERT INTO project_dashboard_views (project_id, name, kind, page_keys, is_default, is_forced)
      VALUES (v_project, 'Review', 'standard',
              ARRAY['learning-goals', 'concepts', 'theories', 'strands', 'literature', 'review', 'discussions', 'time', 'curriculum-repository'],
              TRUE, FALSE)
      RETURNING id INTO v_view;
      v_added := v_added + 1;
    END IF;

    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    SELECT v_view, 'role', 'reviewer'
    WHERE NOT EXISTS (
      SELECT 1 FROM project_dashboard_view_assignments WHERE view_id = v_view AND target_type = 'role' AND target_value = 'reviewer'
    );
  END LOOP;
  RAISE NOTICE 'Review view added to % spaces (4 expected on first run)', v_added;
END
$MIGRATION$;
