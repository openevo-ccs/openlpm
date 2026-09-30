SET search_path = public, extensions;

-- Follow-on to migration 047: scripts/pull_feedback.mjs's real query joins
-- feedback -> users (submitter name/email) and feedback -> projects
-- (project name/slug), and service_role needs SELECT on those two tables
-- for the exact same reason -- SQL-level table privilege is separate from
-- RLS bypass, and this project grants nothing automatically. Granting both
-- now, in one migration, rather than discovering the third one to fail on
-- separately. Read-only, same as 047.

GRANT SELECT ON public.users TO service_role;
GRANT SELECT ON public.projects TO service_role;
