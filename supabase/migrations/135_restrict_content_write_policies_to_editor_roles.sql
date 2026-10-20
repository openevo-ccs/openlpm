-- Phase 0 repair (Dustin, 2026-10-20), item 1: a real RLS permission gap.
-- Every checked INSERT policy on lpm_data_objects, discussion_topics,
-- discussion_posts, and evidence_links gates only on is_project_member()
-- (true for ANY of the 6 project_member_role values, including 'viewer'
-- and 'reviewer') -- so a read-only 'viewer' can create new curriculum
-- content, discussion topics/posts, and evidence citations with exactly
-- the same power as an 'editor'. This was confirmed by reading the actual
-- migrations directly (001/004/022) rather than trusting the planning doc's
-- own description of the bug. That description turned out to be right
-- about the core gap but imprecise about where it applies -- see the two
-- corrections below.
--
-- Role choice: owner/maintainer/editor/contributor are "can create content"
-- roles; viewer is explicitly read-only by name. 'reviewer' is excluded too
-- -- the schema's own review channel is peer_review_assignments
-- (reviewer_id = auth.uid(), migrations 001/012: a reviewer sees and
-- updates their own assignments there). That's a separate table from the
-- four this migration touches, so a reviewer's real job needs nothing from
-- this migration. No is_project_editor()-style convenience wrapper existed
-- yet (has_project_role() itself has existed since migration 004 and is
-- reused here) -- adding one so the same four-role array isn't repeated at
-- every call site.
--
-- Deliberately NOT touched, after checking the real current policies:
-- 1. lpm_data_objects' UPDATE policy ("Users can update own data objects",
--    migration 001) and discussion_posts' UPDATE policy ("Users can update
--    own posts", migration 001) are already own-row-only
--    (submitted_by/user_id = auth.uid()). Neither one checks
--    is_project_member at all, so a viewer already can't update anyone
--    else's row through either policy -- there's no "same power as editor"
--    gap on UPDATE for these two tables.
-- 2. discussion_topics and evidence_links have no UPDATE policy at all
--    today (confirmed: RLS-enabled with zero UPDATE policy means no role
--    can update either table via the client), so "insert/update" in the
--    planning doc is, for these two, really just "insert".
-- 3. lpm_connections/lpm_threads' is_project_member-gated status updates
--    (migration 010) are a different, intentional design: migration 012's
--    own comment describes proposed content getting "reviewed by any other
--    project member" before counting as accepted. That openness is the
--    peer-review mechanism those two tables were built for. Left alone.
--
-- Also fixes evidence_links' DELETE policy (012_evidence_and_review.sql),
-- same is_project_member-only gap, same fix, same table this migration is
-- already touching -- a viewer could otherwise remove another member's
-- citation.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION is_project_editor(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT has_project_role(p_project_id, ARRAY['owner', 'maintainer', 'editor', 'contributor']::project_member_role[]);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

COMMENT ON FUNCTION is_project_editor(UUID) IS
  'Owner/maintainer/editor/contributor -- the "can create or change content" roles. Excludes viewer (read-only by name) and reviewer (whose real channel is peer_review_assignments). Added 2026-10-20 Phase 0 repair to stop repeating the same has_project_role() array at every content-table policy.';

-- lpm_data_objects: creating new strands/substrands/performance indicators.
DROP POLICY IF EXISTS "Project members can create data objects" ON lpm_data_objects;
CREATE POLICY "Project editors can create data objects" ON lpm_data_objects
  FOR INSERT WITH CHECK (is_project_editor(project_id));

-- discussion_topics: starting a new discussion thread.
DROP POLICY IF EXISTS "Project members can create topics" ON discussion_topics;
CREATE POLICY "Project editors can create topics" ON discussion_topics
  FOR INSERT WITH CHECK (is_project_editor(project_id));

-- discussion_posts: posting into an existing thread (022_scope_discussion_
-- posts_to_project.sql's policy, scoped through the parent topic's project
-- since discussion_posts has no project_id column of its own).
DROP POLICY IF EXISTS "Project members can create posts" ON discussion_posts;
CREATE POLICY "Project editors can create posts" ON discussion_posts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM discussion_topics t WHERE t.id = topic_id AND is_project_editor(t.project_id))
  );

-- evidence_links: citing literature behind a claim.
DROP POLICY IF EXISTS "Project members can create evidence links" ON evidence_links;
CREATE POLICY "Project editors can create evidence links" ON evidence_links
  FOR INSERT WITH CHECK (is_project_editor(project_id));

DROP POLICY IF EXISTS "Project members can delete evidence links" ON evidence_links;
CREATE POLICY "Project editors can delete evidence links" ON evidence_links
  FOR DELETE USING (is_project_editor(project_id));

-- No explicit GRANT EXECUTE needed -- same as is_project_member()/
-- has_project_role() (migration 004), a new function gets EXECUTE granted
-- to PUBLIC by Postgres' own default privileges unless revoked, and
-- nothing in this schema revokes it.
