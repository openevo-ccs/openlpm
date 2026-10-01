SET search_path = public, extensions;

-- Follow-on to migrations 047/048 (service_role read access to feedback).
-- Those cover a Claude Code session READING real feedback; this adds the
-- matching narrow WRITE so a design-session can mark an item resolved once
-- a fix has actually been verified live, instead of leaving every
-- already-fixed item sitting as "open" forever until Dustin opens
-- /dashboard/admin/feedback and clicks through them one at a time himself.
--
-- Deliberately column-scoped to `status` only, mirroring exactly what the
-- app's own admin-feedback-page.tsx does (`setFeedbackStatus` -- toggle
-- open/resolved, nothing else) -- not a general UPDATE grant, so a script
-- using this credential can never touch a submitter's comment, screenshot,
-- or any other field. Same reasoning as 047/048: SQL-level table privilege
-- is separate from RLS bypass, and this project grants nothing
-- automatically.

GRANT UPDATE (status) ON public.feedback TO service_role;
