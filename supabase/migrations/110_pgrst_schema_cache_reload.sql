-- Follow-on to migration 109 (service_role grant on theorybase_snapshot).
-- The grant itself is live (confirmed: migration 109 shows applied, and a
-- real sync attempt now gets the grant's exact privileges listed in the
-- error, not a generic denial), but the API layer (PostgREST) that
-- scripts/sync_theorybase_snapshot.mjs actually talks to keeps its own
-- cached copy of table privileges, built at startup/last reload -- a
-- GRANT alone doesn't reach it, confirmed live 2026-10-10 by 8 real sync
-- attempts over several minutes all failing identically with the same
-- "permission denied" error the grant was supposed to fix.
--
-- This NOTIFY is the standard, documented way to tell PostgREST to
-- refresh that cache. It changes no data and no schema -- it's a pub/sub
-- signal, not a write -- so it carries none of the risk an ordinary
-- migration does.

NOTIFY pgrst, 'reload schema';
