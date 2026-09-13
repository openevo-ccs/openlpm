SET search_path = public, extensions;

-- Real, live gap found while building the actual Discussions UI (RFC 0002
-- Phase 2, finally happening): migration 004 rescoped every other content
-- table's RLS from "any authenticated user" to "members of the owning
-- project" -- literature_references, lpm_schema_elements, lpm_data_objects,
-- evidence_links, discussion_topics. discussion_posts was missed. Its
-- SELECT policy has read "auth.uid() IS NOT NULL" (any signed-in user, any
-- project) since migration 002, and its INSERT policy never checked project
-- membership either. Same class of bug as the activity_log leak (migration
-- 014) and the peer_review_assignments missing-INSERT gap (migration 012)
-- -- caught here with zero real rows written yet, same as those two, only
-- because the Discussions UI that would have started writing real posts
-- was never built until now.
--
-- discussion_posts has no project_id column of its own -- scoped via its
-- topic's project_id, the same indirect pattern lpm_thread_stations already
-- uses via its thread's project_id (migration 010).

DROP POLICY IF EXISTS "Authenticated users can view posts" ON discussion_posts;
CREATE POLICY "Project members can view posts" ON discussion_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM discussion_topics t WHERE t.id = topic_id AND is_project_member(t.project_id))
  );

DROP POLICY IF EXISTS "Authenticated users can create posts" ON discussion_posts;
CREATE POLICY "Project members can create posts" ON discussion_posts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM discussion_topics t WHERE t.id = topic_id AND is_project_member(t.project_id))
  );

-- "Users can update own posts" (migration 001) already correctly scopes to
-- the author -- left as-is, just newly also implied-safe now that SELECT
-- itself is project-scoped.

-- discussion_topics never got an UPDATE/DELETE policy at all -- fine for
-- now (posts are the real content; a topic itself is rarely edited after
-- creation), not touched here to keep this migration to the one real gap
-- found.
