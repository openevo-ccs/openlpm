SET search_path = public, extensions;

-- Real gap in the review queue: the "asserted connection" review path
-- (lpm_connections, migration 010) always blocked a proposer from reviewing
-- their own proposal (review-page.tsx's ReviewCard already checks
-- item.connection.created_by === session.user.id), but the generic review
-- queue added in migration 012/023 (theories, framework tags, notebook
-- items/drafts) never recorded who submitted a thing for review at all --
-- peer_review_assignments had no submitter column, so there was nothing to
-- compare a reviewer's own id against. Anyone who could review could
-- approve their own submission. 2026-09-18 UI/UX audit item #6/quick-win #5.

ALTER TABLE peer_review_assignments ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Existing pending rows predate this column and have no recorded submitter
-- -- left NULL rather than guessed, so they behave exactly as before (any
-- reviewer may complete them) until a newly-submitted item replaces them.

-- The UPDATE policy that lets a project member claim-and-complete a still-
-- open assignment (migration 024) is the actual self-approval hole -- it
-- checked project membership only, not authorship. Replacing it with the
-- same check plus a submitter exclusion; only additive at the UI layer
-- until now (review-page.tsx never had a submitted_by to gate on), so this
-- is the first point this can be enforced at the database layer too, not
-- just hidden in the UI.
DROP POLICY IF EXISTS "Project members can claim open review assignments" ON peer_review_assignments;
CREATE POLICY "Project members can claim open review assignments" ON peer_review_assignments
  FOR UPDATE USING (
    reviewer_id IS NULL
    AND is_project_member(project_id)
    AND (submitted_by IS NULL OR submitted_by != auth.uid())
  );
