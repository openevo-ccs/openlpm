SET search_path = public, extensions;

-- Real gap found live 2026-09-30, trying scripts/pull_feedback.mjs for the
-- first time with a real service_role key: "permission denied for table
-- feedback". RLS bypass (service_role's real BYPASSRLS attribute) and
-- ordinary SQL-level table privileges are two separate Postgres layers --
-- migration 006's own comment already states this precisely ("RLS
-- policies only ever *restrict* an operation a role already has SQL-level
-- privilege to attempt -- they don't grant that privilege"), but that
-- migration's actual GRANT only ever covered `authenticated`, never
-- `service_role` (this project has "Automatically expose new tables"
-- deliberately off, so nothing gets table access without an explicit
-- grant). This is what migration 026's own comment already intended --
-- "meant to be read by whoever maintains OpenLPM via the project's
-- existing service_role key" -- completing that, not a new privilege.
-- Read-only: only SELECT, only the one table this tool needs.

GRANT SELECT ON public.feedback TO service_role;
