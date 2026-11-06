SET search_path = public, extensions;

-- Real second bug found in the same live-verification pass as migration 102
-- (grade_band='5/6'). Fixing grade_band alone didn't move the numbers on
-- the real production site at all -- re-checking turned up why: every
-- lpm_data_objects row this project's content actually displays through
-- listTopics() (src/lib/supabase/curriculum.ts) is filtered with
-- `.eq('branch_id', branchId)`, an exact match against the project's real
-- default branch. Migration 086 (2026-10-02, 7 items) and migration 101
-- (this session, 30 items) both INSERTed new rows without ever setting
-- branch_id, which defaults to NULL -- and `branch_id = NULL` never
-- matches an `.eq()` filter in SQL. All 37 rows were invisible from
-- Browse regardless of status or grade, confirmed live: 262 of 262
-- Lernziele shown on the real site, none of the 37 among them, while the
-- database itself correctly had 299 non-archived rows.
--
-- Sets branch_id on every row in evomentor-thuringia that's missing it,
-- not just the known 37 -- the same bug would hide any future row
-- inserted the same way, so this is written to self-heal rather than
-- hardcode a specific id list.
UPDATE lpm_data_objects
SET branch_id = (
  SELECT branch_id FROM lpm_data_objects
  WHERE project_id = lpm_data_objects.project_id AND branch_id IS NOT NULL
  LIMIT 1
),
updated_at = now()
WHERE project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia')
  AND branch_id IS NULL;
