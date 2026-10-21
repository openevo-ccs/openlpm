-- Base Repo Explorer, step 2: review and discuss. Dustin's own framing
-- (2026-10-21): this isn't a side feature bolted onto a browsing UI -- for
-- the admin-only v1, it's meant to be real, usable infrastructure for
-- ongoing review of Base Repo content, not a separate manual cleanup pass.
--
-- Reuses the two review/discussion mechanisms this app already has rather
-- than inventing a third: peer_review_assignments (generic-review.ts,
-- already a project-scoped "propose for review, someone else decides
-- accept/reject with reasoning" queue used for theories/framework_tags/
-- portfolio items) and discussion_topics/discussion_posts (already
-- polymorphic via linked_type/linked_id). Both already have a nullable
-- project_id (migration 004 added it as ADD COLUMN, no NOT NULL) -- this
-- migration is the first thing to actually use that nullability, for a
-- genuinely global, not-project-scoped context: an admin reviewing or
-- discussing a Base Repo record directly, not a project's local copy of
-- one.
--
-- One real wrinkle: both reviewable_id and linked_id are typed UUID,
-- because every other reviewable/linkable kind so far (theories, framework
-- tags, portfolio items) has a UUID primary key. Base Repo snapshot rows
-- use the repo's own real TEXT id (e.g. "OE-METHOD-..."), which can't go
-- directly into a UUID column. base_repo_review_targets below is a small
-- indirection table solving exactly this -- the same shape as any other
-- linkable "kind" in this schema, just one whose own id is a pointer to a
-- (base_repo, record_id) pair instead of being content itself.

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS base_repo_review_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_repo base_repo_enum NOT NULL,
  record_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (base_repo, record_id)
);

CREATE INDEX IF NOT EXISTS idx_base_repo_review_targets_lookup ON base_repo_review_targets(base_repo, record_id);

ALTER TABLE base_repo_review_targets ENABLE ROW LEVEL SECURITY;

-- Just an id-mapping table, no sensitive content of its own -- any
-- authenticated user can resolve one, but only an admin can mint a new
-- one (matches "admins only for now" access to the Explorer itself;
-- trivially reversible to any-approved-user later by widening this policy).
CREATE POLICY "Any authenticated user can resolve a review target" ON base_repo_review_targets
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can create review targets" ON base_repo_review_targets
  FOR INSERT WITH CHECK (is_admin());

-- Extend the existing open reviewable_type vocabulary (plain TEXT + CHECK,
-- not an enum -- see migration 012's own comment on why this never needs a
-- type migration).
ALTER TABLE peer_review_assignments DROP CONSTRAINT IF EXISTS peer_review_assignments_reviewable_type_check;
ALTER TABLE peer_review_assignments ADD CONSTRAINT peer_review_assignments_reviewable_type_check
  CHECK (reviewable_type IN (
    'literature_reference', 'lpm_data_object', 'lpm_connection', 'lpm_thread',
    'framework_tag', 'theory', 'portfolio_item', 'portfolio_private_node',
    'base_repo_record'
  ));

-- Same for discussion_topics.linked_type.
ALTER TABLE discussion_topics DROP CONSTRAINT IF EXISTS discussion_topics_linked_type_check;
ALTER TABLE discussion_topics ADD CONSTRAINT discussion_topics_linked_type_check
  CHECK (linked_type IN ('schema_element', 'data_object', 'literature_reference', 'base_repo_record'));

-- New, additive policies (Postgres OR's every permissive policy for the
-- same command -- these sit alongside the existing project-scoped ones,
-- they don't replace them) covering the one new case: project_id IS NULL,
-- gated on is_admin() rather than project membership, since there is no
-- project here.
CREATE POLICY "Admins can view global review assignments" ON peer_review_assignments
  FOR SELECT USING (project_id IS NULL AND is_admin());
CREATE POLICY "Admins can create global review assignments" ON peer_review_assignments
  FOR INSERT WITH CHECK (project_id IS NULL AND is_admin());

-- Mirrors migration 024's fix (an open, unclaimed assignment has
-- reviewer_id NULL, which never equals anyone's auth.uid(), so the
-- original "Reviewers can update their assignments" policy alone can
-- never let anyone claim/complete one) for the global, no-project case.
CREATE POLICY "Admins can claim open global review assignments" ON peer_review_assignments
  FOR UPDATE USING (reviewer_id IS NULL AND project_id IS NULL AND is_admin());

CREATE POLICY "Admins can view global discussion topics" ON discussion_topics
  FOR SELECT USING (project_id IS NULL AND is_admin());
CREATE POLICY "Admins can create global discussion topics" ON discussion_topics
  FOR INSERT WITH CHECK (project_id IS NULL AND is_admin());

CREATE POLICY "Admins can view global discussion posts" ON discussion_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM discussion_topics t WHERE t.id = topic_id AND t.project_id IS NULL AND is_admin())
  );
CREATE POLICY "Admins can create global discussion posts" ON discussion_posts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM discussion_topics t WHERE t.id = topic_id AND t.project_id IS NULL AND is_admin())
  );

-- Data API grants extend automatically via migration 006's ALTER DEFAULT
-- PRIVILEGES, same as every other new table in this repo.
