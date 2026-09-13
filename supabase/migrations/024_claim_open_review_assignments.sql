SET search_path = public, extensions;

-- The generic review queue (theories, framework tags, notebook items/
-- drafts) inserts peer_review_assignments with reviewer_id left NULL --
-- an open request, not yet claimed by anyone, since there's no assignment
-- step in this app's lightweight review model (matching lpm_connections'
-- own "any active user can review" precedent). The existing UPDATE policy
-- from migration 001 ("Reviewers can update their assignments") checks
-- reviewer_id = auth.uid() against the row's CURRENT value -- but an
-- unclaimed row's current reviewer_id is NULL, which never equals anyone's
-- auth.uid(), so nobody could ever complete an open assignment at all.
-- Adding a second, additive UPDATE policy for exactly that case (RLS
-- policies for the same command OR together): a project member may update
-- a still-open (reviewer_id IS NULL) assignment, which is how they claim
-- and complete it in one step (see generic-review.ts's completeGenericReview,
-- which sets reviewer_id = auth.uid() in that same update).
CREATE POLICY "Project members can claim open review assignments" ON peer_review_assignments
  FOR UPDATE USING (reviewer_id IS NULL AND is_project_member(project_id));
