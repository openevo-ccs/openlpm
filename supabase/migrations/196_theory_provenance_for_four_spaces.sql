-- Copy the provenance of each theory from the TheoryBase mirror into the theory rows of the four synthetic spaces.
--
-- Why. TheoryBase marks Dichotomized Causal Reasoning (the aim behind Bio-Core), Restructuration Theory and the German
-- Basiskonzept tradition as "an OpenEvo reconstruction of an external position, not yet checked by its holder". The theory rows
-- of the four spaces were created before those fields existed and carry NULL, so the "third-party reconstruction" label in
-- src/pages/dashboard/theories-page.tsx never shows for them. A reader of Bio-Core's Theories page sees "Tested against
-- alternatives" and nothing that says the position is the lab's own unreviewed reconstruction.
--
-- What it does. For theory rows of bio-core-lpm-synth, social-core-lpm-synth, computational-core-lpm-synth and
-- interdisciplinary-lpm-synth whose provenance is still empty and whose base_repo_ref has a value in theorybase_snapshot, it
-- copies authorship_provenance, characterization_status and (when empty) held_by. It never overwrites a value that is set.
--
-- Source of this fix: docs/design-notes/openlpm-four-space-review-2026-10-28.md (lab_manager), item N1.
-- Applying it is a production database write and waits for Dustin.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_expected INTEGER;
  v_changed INTEGER;
BEGIN
  SELECT count(*) INTO v_expected
  FROM theories t
  JOIN projects p ON p.id = t.project_id
  JOIN theorybase_snapshot s ON s.id = t.base_repo_ref
  WHERE p.slug IN ('bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth')
    AND t.authorship_provenance IS NULL
    AND s.authorship_provenance IS NOT NULL;

  UPDATE theories t
  SET authorship_provenance = s.authorship_provenance,
      characterization_status = s.characterization_status,
      held_by = COALESCE(t.held_by, ARRAY(SELECT jsonb_array_elements_text(s.data -> 'heldBy')))
  FROM theorybase_snapshot s, projects p
  WHERE t.base_repo_ref = s.id
    AND p.id = t.project_id
    AND p.slug IN ('bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth')
    AND t.authorship_provenance IS NULL
    AND s.authorship_provenance IS NOT NULL;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed <> v_expected THEN
    RAISE EXCEPTION 'Theory provenance copy changed % rows but % were expected', v_changed, v_expected;
  END IF;
  RAISE NOTICE 'Theory provenance copied for % rows (9 expected on 2026-10-28)', v_changed;
END
$MIGRATION$;
