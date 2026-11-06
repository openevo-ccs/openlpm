-- Repair literature rows whose title or authors hold the Unicode replacement character (U+FFFD) in the four synthetic spaces.
--
-- Why. A review sample found 11 rows of literature_references (Bio-Core 6, Interdisciplinary 5) where letters were replaced by
-- U+FFFD, for example "Tr�bst" for "Tröbst" and "University Students� Conceptual Knowledge". The mirror of the shared literature
-- list (literaturebase_snapshot) holds the same records without the damage (0 of 2,026 rows).
--
-- What it does. For rows of the four spaces whose title (or authors) contains U+FFFD and whose literaturebase_id has a clean
-- value in literaturebase_snapshot, it copies the snapshot's title (or authors). It never touches rows without a clean source.
-- It is safe to run twice. The row ids are listed in the review note's evidence appendix. Read-only check on 2026-10-28: 6 titles and 6 author lists repairable, 0 rows left.
--
-- Source of this fix: docs/design-notes/openlpm-four-space-review-2026-10-28.md (lab_manager), item N8.
-- Applying it is a production database write and waits for Dustin.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_bad CONSTANT TEXT := chr(65533);
  v_titles INTEGER;
  v_authors INTEGER;
  v_left INTEGER;
BEGIN
  UPDATE literature_references lr
  SET title = s.title
  FROM literaturebase_snapshot s, projects p
  WHERE s.id = lr.literaturebase_id
    AND p.id = lr.project_id
    AND p.slug IN ('bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth')
    AND position(v_bad IN lr.title) > 0
    AND position(v_bad IN s.title) = 0;
  GET DIAGNOSTICS v_titles = ROW_COUNT;

  UPDATE literature_references lr
  SET authors = to_jsonb(s.authors)
  FROM literaturebase_snapshot s, projects p
  WHERE s.id = lr.literaturebase_id
    AND p.id = lr.project_id
    AND p.slug IN ('bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth')
    AND position(v_bad IN lr.authors::text) > 0
    AND position(v_bad IN array_to_string(s.authors, ' ')) = 0;
  GET DIAGNOSTICS v_authors = ROW_COUNT;

  SELECT count(*) INTO v_left
  FROM literature_references lr
  JOIN projects p ON p.id = lr.project_id
  WHERE p.slug IN ('bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth')
    AND (position(v_bad IN lr.title) > 0 OR position(v_bad IN lr.authors::text) > 0);

  RAISE NOTICE 'Repaired % titles and % author lists; % rows still hold U+FFFD (0 expected)', v_titles, v_authors, v_left;
  IF v_left <> 0 THEN
    RAISE EXCEPTION '% rows still hold U+FFFD after the repair', v_left;
  END IF;
END
$MIGRATION$;
