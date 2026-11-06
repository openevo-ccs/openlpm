SET search_path = public, extensions;

-- Real feedback (Dustin, 2026-10-20, via /walk-through follow-up on feedback
-- 35924e8a): "where else in OpenLPM is this same TheoryBase theory already
-- being used?" -- a reverse lookup that directly serves the original ask's
-- "drive cycles of TheoryBase quality improvement" goal, since seeing real
-- cross-project reuse is itself a quality signal. Migration 020's existing
-- "Project members can view theories" policy only ever admits a theory's
-- own project's members, so this couldn't be answered client-side at all.
--
-- Scoped narrowly to TheoryBase-sourced rows only (base_repo_ref IS NOT
-- NULL): that content is already a cached copy of a real, public TheoryBase
-- record (scripts/sync_theorybase_snapshot.mjs), not private
-- project-authored material -- a locally-authored theory stays exactly as
-- project-scoped as before. Combines with the existing SELECT policy as OR,
-- so nothing already visible loses access.
--
-- This does NOT also need a new policy on the `projects` table: the real
-- "also used by" case only resolves a project's name/slug for a project
-- that's already visible under the existing policy (migration 035) --
-- public, or one the viewer is a member/creator/eligible self-joiner of.
-- A private project using the same theory stays correctly invisible by
-- name, same as it should be; only the fact that *some* other project uses
-- it would otherwise leak, and this migration only touches `theories`, not
-- `projects`.
CREATE POLICY "Any signed-in user can see which other projects use the same TheoryBase theory" ON theories
  FOR SELECT USING (
    base_repo_ref IS NOT NULL
    AND auth.uid() IS NOT NULL
  );

COMMENT ON POLICY "Any signed-in user can see which other projects use the same TheoryBase theory" ON theories IS
  'Lets any signed-in OpenLPM user see which OTHER projects have also imported the same real TheoryBase record (base_repo_ref), for the "also used by" reverse lookup on the Theories page -- scoped to TheoryBase-sourced rows only, since that content is already a cached copy of a public base-repo record rather than private project-authored material.';
