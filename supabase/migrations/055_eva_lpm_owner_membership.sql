-- Fixes a real gap in 053_eva_lpm_seed.sql: that migration created 5 new
-- projects (the eva-lpm Space + 4 nested sub-projects) with created_by = NULL
-- and no project_members rows at all, following migration 005's old
-- bootstrap-seed precedent ("no real user account exists yet at migration
-- time"). That precedent no longer applies -- real accounts exist in this
-- database now, Dustin's included -- so leaving these projects ownerless
-- meant nobody could see them: all 5 are is_private = TRUE, and the RLS
-- policy only shows a private project to a project_member, its creator, or
-- an admin (025/049). With none of those set, the projects were invisible
-- in the real app even though the migration applied successfully.
--
-- Makes Dustin's real account ('dustin.eirdosh@eva.mpg.de', the one address
-- the app's own admin/ownership logic already recognizes) the owner of all
-- 5 projects, and backfills created_by. Guarded so it does nothing (with a
-- clear NOTICE) rather than failing outright if that account doesn't exist
-- under that email at push time.

DO $MIGRATION$
DECLARE
  v_user_id UUID;
  v_eva_lpm_id UUID;
  v_sachsen_id UUID;
  v_sachsen_anhalt_id UUID;
  v_thueringen_id UUID;
  v_us_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';
  SELECT id INTO v_eva_lpm_id FROM projects WHERE slug = 'eva-lpm';
  SELECT id INTO v_sachsen_id FROM projects WHERE slug = 'eva-lpm-sachsen';
  SELECT id INTO v_sachsen_anhalt_id FROM projects WHERE slug = 'eva-lpm-sachsen-anhalt';
  SELECT id INTO v_thueringen_id FROM projects WHERE slug = 'eva-lpm-thueringen';
  SELECT id INTO v_us_id FROM projects WHERE slug = 'eva-lpm-us-interdisciplinary';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users row found for dustin.eirdosh@eva.mpg.de -- skipping eva-lpm ownership seed. Add Dustin as owner of the 5 eva-lpm projects manually once that account exists, or re-run this migration body by hand with the right email.';
  ELSIF v_eva_lpm_id IS NULL THEN
    RAISE NOTICE 'No project with slug eva-lpm found -- 053_eva_lpm_seed.sql may not have run yet. Skipping.';
  ELSE
    INSERT INTO project_members (project_id, user_id, role)
    VALUES
      (v_eva_lpm_id, v_user_id, 'owner'),
      (v_sachsen_id, v_user_id, 'owner'),
      (v_sachsen_anhalt_id, v_user_id, 'owner'),
      (v_thueringen_id, v_user_id, 'owner'),
      (v_us_id, v_user_id, 'owner')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

    UPDATE projects SET created_by = v_user_id
    WHERE id IN (v_eva_lpm_id, v_sachsen_id, v_sachsen_anhalt_id, v_thueringen_id, v_us_id)
      AND created_by IS NULL;
  END IF;
END $MIGRATION$;
