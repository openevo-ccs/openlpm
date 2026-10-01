SET search_path = public, extensions;

-- Narrow counterpart to 047/048/051's service_role grants, same reasoning:
-- this project deliberately grants service_role nothing by default (006's
-- own comment) -- every capability it has is one explicit, purpose-built
-- grant. This one lets scripts/delete_project.mjs actually perform a
-- project deletion it already decided (after its own sub-project check,
-- using the SELECT service_role already has on projects since migration
-- 048) is safe to do, the same real need migration 052's app-level DELETE
-- policies serve for a signed-in owner/admin -- a Claude Code session has
-- no signed-in browser session of its own to go through those with, the
-- same gap resolve_feedback.mjs/051 already solved for feedback status.
--
-- Deliberately DELETE only, not SELECT on anything beyond what 048 already
-- grants -- the script reads sub-project counts and project identity via
-- that existing grant, nothing new there. Only runs when Dustin has added
-- this script to his own Bash permission allow-list (same mechanism as
-- resolve_feedback.mjs), and only ever on a project Dustin has directed or
-- agreed to delete in that session -- never a standing "go clean up
-- whatever looks like clutter" sweep.
GRANT DELETE ON public.projects TO service_role;
