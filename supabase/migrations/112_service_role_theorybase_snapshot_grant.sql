SET search_path = public, extensions;

-- Re-filed 2026-10-10 (twice -- 111 also collided with a concurrent session's
-- own service_role grant migration for literaturebase_snapshot, caught by
-- checking the real applied versions via `supabase db query` immediately
-- before pushing, not by trusting the local migrations folder alone).
-- The original grant was committed as migration 109
-- (PR #30), but a different session's "literaturebase_integration"
-- migration was ALSO numbered 109 and reached the live database first --
-- `supabase db push --linked` silently treats a version already recorded
-- in supabase_migrations.schema_migrations as satisfied, so the original
-- 109 file's actual SQL (this GRANT) never ran, even though the push
-- reported success and `supabase migration list` showed "109" as
-- applied. Confirmed directly: `supabase db query` against
-- supabase_migrations.schema_migrations showed version 109's real
-- recorded statements were literaturebase_integration's, not this grant's
-- -- and a live query of information_schema.role_table_grants showed
-- service_role still had none of SELECT/INSERT/UPDATE on
-- theorybase_snapshot after 109 "succeeded". The dead 109 file (same
-- content as below) has been deleted from the migrations folder in the
-- same change -- it will never execute under a version number the
-- database already considers applied.
--
-- sync_theorybase_snapshot.mjs (built 2026-10-03 alongside the Browse
-- TheoryBase panel on the Theories page) upserts real TheoryBase content
-- into this table using the service_role key, the same credential
-- pull_feedback.mjs and resolve_feedback.mjs already use -- but nobody
-- had actually granted it table privileges here.
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
