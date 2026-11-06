-- 204: the grade 5/6 Lernziele added by migrations 168 (43 rows, 2026-10-23) and 203 (68 rows per project,
-- 2026-10-30) were inserted without a branch, so the Lernziele list never showed them.
--
-- Found on 2026-10-30 while checking 203 on the live site: the page showed 249 goals (67 for grade 5/6)
-- while the database held 357 visible ones (174 for grade 5/6). listTopics() in
-- src/lib/supabase/curriculum.ts only lists rows whose branch_id equals the project's main branch
-- (branches.is_trunk = true), and a row with no branch never matches. The 43 rows from 168 have been
-- invisible since 10/23, which is why Susan kept seeing the old goals. Migration 103 fixed the same
-- mistake once before for other rows.
--
-- Gives every branch-less row of the two EvoMentor Thuringia projects its project's main branch.
-- Check after applying: both queries should return 0.
--   SELECT count(*) FROM lpm_data_objects WHERE branch_id IS NULL AND project_id IN (SELECT id FROM projects WHERE slug LIKE 'evomentor-thuringia%');
SET search_path = public, extensions;

UPDATE lpm_data_objects o
SET branch_id = b.id,
    updated_at = now()
FROM branches b
WHERE b.project_id = o.project_id
  AND b.is_trunk = true
  AND o.branch_id IS NULL
  AND o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'));
