-- Closes a real trust gap the coherence-audit tool introduced (migration
-- 010/011): a project member could write a new connection straight into
-- what teachers see on the Explore view, with nobody else checking it.
-- Wires up two mechanisms that already existed in the schema but had zero
-- UI anywhere -- evidence_links (citing real literature behind a claim) and
-- peer_review_assignments (assigning/recording a review) -- into a
-- lightweight, journal-submission-style gate: propose, optionally cite
-- evidence, get reviewed by any other project member, only then does it
-- count as accepted and become visible to teachers. Already-vetted real
-- content (the 373 connections + 4 threads ingested from EvoMentor_DE's own
-- hand-authored, schema-validated work) is grandfathered straight to
-- 'accepted' below -- this gate is for new additions going forward, not a
-- retroactive requirement on content that was already carefully built.

ALTER TABLE lpm_connections ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'proposed'
  CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected'));
ALTER TABLE lpm_threads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'proposed'
  CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected'));

-- Grandfather already-real, already-vetted content.
UPDATE lpm_connections SET status = 'accepted' WHERE status = 'proposed';
UPDATE lpm_threads SET status = 'accepted' WHERE status = 'proposed';

CREATE INDEX IF NOT EXISTS idx_lpm_connections_status ON lpm_connections(project_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_lpm_threads_status ON lpm_threads(project_id, branch_id, status);

-- Extend the existing (already-live, previously dead) review/evidence
-- tables' open target vocabularies -- both are plain TEXT + CHECK, not
-- enums, specifically so this kind of extension never needs a type migration.
ALTER TABLE peer_review_assignments DROP CONSTRAINT IF EXISTS peer_review_assignments_reviewable_type_check;
ALTER TABLE peer_review_assignments ADD CONSTRAINT peer_review_assignments_reviewable_type_check
  CHECK (reviewable_type IN ('literature_reference', 'lpm_data_object', 'lpm_connection', 'lpm_thread'));

ALTER TABLE evidence_links DROP CONSTRAINT IF EXISTS evidence_links_target_type_check;
ALTER TABLE evidence_links ADD CONSTRAINT evidence_links_target_type_check
  CHECK (target_type IN ('schema_element', 'data_object', 'connection', 'thread'));

-- peer_review_assignments got a project_id column in migration 004 but was
-- never revisited beyond that (nothing used it) -- it's been RLS-enabled
-- since migration 001 with only two narrow policies scoped to
-- `reviewer_id = auth.uid()` (see own assignments, update own assignments),
-- and critically **no INSERT policy at all**, meaning no row could ever be
-- created through the app regardless of UI -- the actual reason this table
-- has stayed completely dead. Adding project-scoped SELECT (so the whole
-- team can see the review queue, not just each reviewer their own slice)
-- and INSERT (so a member can self-assign a review) as new, additive
-- policies alongside the existing ones -- the existing "reviewers can
-- update their own assignments" policy from 001 already covers submitting
-- a recommendation, so that direction needs nothing new.
CREATE POLICY "Project members can view review assignments" ON peer_review_assignments
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create review assignments" ON peer_review_assignments
  FOR INSERT WITH CHECK (is_project_member(project_id));

-- evidence_links already has correct project-scoped SELECT/INSERT policies
-- from migration 004 -- only a DELETE policy was ever missing (so a
-- mis-attached citation could never be removed).
CREATE POLICY "Project members can delete evidence links" ON evidence_links
  FOR DELETE USING (is_project_member(project_id));
