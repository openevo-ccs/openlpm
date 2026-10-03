SET search_path = public, extensions;

-- service_role has never had an explicit grant on lpm_data_objects, unlike
-- feedback (047), curriculum_repository_records (066), and every other
-- table a read/write tool needs to touch with this key. Discovered
-- 2026-10-02 trying to use scripts/read-project-content.mjs (a
-- read-feedback.mjs-style tool, built the same session) to spot-check
-- evomentor-thuringia's live MNT content against a new curriculum
-- document -- the query failed with "permission denied for table
-- lpm_data_objects", a real Postgres grant error, not an empty RLS result.
--
-- Narrow and read-only, matching 047's own precedent exactly (one table,
-- SELECT only, for a read tool that has no write capability at all):
-- real curriculum content already lives behind this key for everything
-- else it's used for (feedback, curriculum_repository_records), so a
-- read-only grant here closes a real, specific gap rather than expanding
-- what service_role is trusted to do.

GRANT SELECT ON public.lpm_data_objects TO service_role;
