-- Explicit Data API grants -- required because this project's Supabase
-- instance has "Automatically expose new tables" turned OFF (deliberate:
-- access should be controlled by the RLS policies in 001/004, not a
-- blanket default grant). RLS policies only ever *restrict* an operation a
-- role already has SQL-level privilege to attempt -- they don't grant that
-- privilege. Without this migration, every table would return "permission
-- denied" via the Data API regardless of how correct its RLS policies are.
--
-- No grants to `anon`: every RLS policy in this schema requires
-- auth.uid() IS NOT NULL, so an anonymous grant would be inert anyway --
-- omitted rather than issued-and-relying-on-RLS-to-catch-it, for clarity.
--
-- Ongoing discipline: with auto-expose off, any future migration that adds
-- a new table needs its own GRANT line (or re-run the ALL TABLES grant
-- below) -- this doesn't happen automatically the way it would with that
-- project setting on.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Extends the same grant to tables created later by the role migrations
-- run as (Supabase's migration runner acts as `postgres`), so a future
-- migration only needs to remember RLS, not a matching GRANT too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
