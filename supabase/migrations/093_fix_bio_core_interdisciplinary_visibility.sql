SET search_path = public, extensions;

-- Fixes real bug in 092_bio_core_interdisciplinary_lpm_content_seed.sql, caught live
-- 2026-10-03 (Dustin: "the two synthetic repositories still look empty to me" after
-- running the db push).
--
-- Two independent reasons the content was invisible, both in how
-- src/lib/supabase/curriculum.ts's listTopics() queries lpm_data_objects, not in
-- whether the rows exist:
--
-- 1. listTopics() filters .eq('status', 'accepted') -- a same-day fix (feedback
--    b70e39a5) that stops any 'draft' row from showing in Browse at all, with no
--    separate review UI anywhere in the app that would ever promote one to
--    'accepted'. 092 inserted every strand/substrand row with status = 'draft'
--    (a reasonable-looking default at the time, chosen before this same-day Browse
--    change existed) -- meaning every row 092 added was permanently unreachable.
--
-- 2. listTopics() also filters .eq('branch_id', branchId) -- an exact match, and 092
--    never set branch_id on any lpm_data_objects row (following
--    069_netlogo_lpm_strands_seed.sql's precedent, which also never set it). NULL
--    doesn't match a real branch id, so even an 'accepted' row would still have been
--    excluded.
--
-- Fix: set both fields on exactly the rows 092 added (scoped to the two synthetic
-- projects' trunk branches, not a blanket update) -- 'accepted' because there's no
-- functioning draft-review step in this app to promote them later, and the trunk
-- branch id because both projects only ever had the one genesis branch from
-- 005_seed_projects.sql.
--
-- 069's netlogo-lpm-strands content has this same branch_id gap (never checked
-- live at the time) -- out of scope for this fix, flagged separately.

DO $MIGRATION$
DECLARE
  v_project_id UUID;
  v_branch_id UUID;
BEGIN
  FOR v_project_id, v_branch_id IN
    SELECT p.id, b.id
    FROM projects p
    JOIN branches b ON b.project_id = p.id AND b.is_trunk = TRUE
    WHERE p.slug IN ('bio-core-lpm-synth', 'interdisciplinary-lpm-synth')
  LOOP
    UPDATE lpm_data_objects
    SET status = 'accepted', branch_id = v_branch_id, updated_at = NOW()
    WHERE project_id = v_project_id
      AND object_type IN ('strand', 'substrand')
      AND status = 'draft'
      AND branch_id IS NULL;
  END LOOP;
END $MIGRATION$;
