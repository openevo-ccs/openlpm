SET search_path = public, extensions;

-- A2 gap found by the 2026-10-23 Shared Agentic Mechanisms audit: migration 156 added a second,
-- parallel UPDATE policy on peer_review_assignments for the new admin-only Base Repo Explorer
-- review queue ("Admins can claim open global review assignments"), three days after migration
-- 031 added the submitted_by self-approval guard -- but only to the ORIGINAL project-scoped
-- UPDATE policy on this same table. The new policy never got the same guard. Postgres ORs every
-- permissive policy for the same command together, so one guarded policy gives zero protection
-- once a second, unguarded one exists on the same table -- an admin who flagged a Base Repo
-- record for review (submitBaseRepoRecordForReview() in generic-review.ts already records
-- submitted_by on insert) could claim and decide their own flag. Same fix as migration 031:
-- DROP + CREATE with the identical submitted_by exclusion added to the USING clause (Postgres
-- has no ALTER POLICY for adding a clause to an existing USING expression).
DROP POLICY IF EXISTS "Admins can claim open global review assignments" ON peer_review_assignments;
CREATE POLICY "Admins can claim open global review assignments" ON peer_review_assignments
  FOR UPDATE USING (
    reviewer_id IS NULL
    AND project_id IS NULL
    AND is_admin()
    AND (submitted_by IS NULL OR submitted_by != auth.uid())
  );
