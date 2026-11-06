-- Real bug caught live (2026-10-05), the first time migration 107's member
-- requests actually ran end to end: a pending request's own row was
-- correctly visible to its recipient (107's own SELECT policy), but the
-- PROJECT that request points to was not -- a private project (like
-- germany-curriculum-repository, where this was first caught) is only
-- visible to members/the creator/an eligible self-joiner (035's policy),
-- and someone with a pending request is none of those yet. The embedded
-- `project:projects(...)` on that row came back null, so there was no way
-- to show the recipient what they were even being invited to.
--
-- Exact same justification 035's own policy already used for the self-join
-- case ("otherwise there'd be no way to show them what they're about to
-- join") -- adds one more SELECT policy rather than editing 035's, since
-- Postgres combines multiple permissive policies on the same table with OR
-- and 035 is long since applied with real projects depending on it exactly
-- as written.
CREATE POLICY "A pending request's recipient can see the project it's for" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_member_requests r
      WHERE r.project_id = projects.id
        AND r.user_id = auth.uid()
        AND r.status = 'pending'
    )
  );
