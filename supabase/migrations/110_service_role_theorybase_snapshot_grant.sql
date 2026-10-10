SET search_path = public, extensions;

-- scripts/sync_theorybase_snapshot.mjs (built 2026-10-03 alongside the
-- Browse TheoryBase panel on the Theories page) upserts real TheoryBase
-- content into this table using the service_role key, the same credential
-- pull_feedback.mjs and resolve_feedback.mjs already use -- but nobody ever
-- granted it table privileges here, so every real run has failed with
-- "permission denied for table theorybase_snapshot" (confirmed live
-- 2026-10-09, both via a direct sync attempt and an authenticated REST
-- read showing 0 rows despite 131 real records being ready to sync).
--
-- Table-wide (not column-scoped like 051's feedback-status grant) because
-- the sync script's job IS replacing the whole row set each run -- there's
-- no narrower "just this column" shape the way feedback's status toggle
-- has. This table is never written by the app itself (only read, via RLS,
-- by any authenticated project member with a linked TheoryBase project --
-- see theories-page.tsx's TheorybaseBrowsePanel) -- a human runs the sync
-- script by hand, same operational boundary as every other service_role
-- grant in this repo.

GRANT SELECT, INSERT, UPDATE ON public.theorybase_snapshot TO service_role;
