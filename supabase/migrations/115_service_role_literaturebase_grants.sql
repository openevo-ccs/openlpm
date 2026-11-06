SET search_path = public, extensions;

-- Migration 109 assumed "Data API grants extend automatically via
-- migration 006's ALTER DEFAULT PRIVILEGES" -- wrong. Confirmed live
-- 2026-10-10: that default-privilege rule only ever extends grants to
-- `authenticated`, never to `service_role` (re-read migration 006's own
-- text) -- the same real gap another concurrent session independently
-- found and fixed for theorybase_snapshot the same day (see
-- 109_service_role_theorybase_snapshot_grant.sql on main). Without this,
-- scripts/sync_literaturebase_snapshot.mjs and
-- scripts/draft_literaturebase_contribution.mjs's status-patch would both
-- fail with "permission denied," exactly as theorybase's own sync did
-- before that fix.
--
-- literature_references itself needs no grant here -- nothing writes to
-- it via service_role; the app's own authenticated client (migration 006)
-- already covers every read/write literature-page.tsx does.

GRANT SELECT, INSERT, UPDATE ON public.literaturebase_snapshot TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.literature_contributions TO service_role;
