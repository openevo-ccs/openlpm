SET search_path = public, extensions;

-- Migration 033 backfilled users.role = 'admin' for 'dustin@globalesd.org',
-- the email everyone assumed was his OpenLPM sign-in. Checked directly
-- against the live auth.users table (2026-10-01): that address has never
-- actually signed up here at all. Dustin's real OpenLPM account signs in
-- via GitHub OAuth as dustin.eirdosh@eva.mpg.de (last sign-in 2026-10-01).
-- That mismatch is why both admin pages (Feedback, and the new Users page
-- from migration 049) never actually worked for him -- not a deploy
-- problem, the role column backfill just pointed at an account that
-- doesn't exist. src/lib/admin.ts's ADMIN_EMAIL constant is fixed in the
-- same commit as this migration; that only gates what renders client-side,
-- this is the real RLS-enforced boundary underneath (is_admin(), migration
-- 049) that actually needs the correct row.

UPDATE users SET role = 'admin' WHERE email = 'dustin.eirdosh@eva.mpg.de';
