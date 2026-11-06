SET search_path = public, extensions;

-- Closes the real root cause behind at least 3 independent same-day fixes
-- (109_service_role_theorybase_snapshot_grant.sql,
-- 115_service_role_literaturebase_grants.sql, and this session's own find:
-- lpm_schema_elements, prompt_template_libraries, and project_join_rules all
-- return "permission denied for table ..." under the service_role key).
-- 109's own comment already names the mechanism precisely: migration 006's
-- `ALTER DEFAULT PRIVILEGES` only ever covers the `authenticated` role, not
-- `service_role` -- so every table created since has needed its own manual
-- GRANT, and three different sessions have now independently rediscovered
-- that the hard way on three different tables in one day.
--
-- Two parts: (1) a one-time sweep granting service_role full DML on every
-- CURRENT public table, so nothing already affected has to be rediscovered
-- a fourth time; (2) a default-privileges rule so EVERY FUTURE table gets
-- this automatically, the same way 006 already does for `authenticated`.
-- service_role already bypasses RLS everywhere (that's its whole purpose)
-- -- this grants at the privilege layer what it already effectively has at
-- the policy layer, widening nothing a trusted backend/admin role doesn't
-- already have, and changes no real user-facing behavior (RLS, not this
-- grant, is what actually scopes what a signed-in student can do).

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t.tablename);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
