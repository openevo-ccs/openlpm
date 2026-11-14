SET search_path = public, extensions;

-- EvoKE Literature Workshop (2026-11-14): a space where evolution education researchers check, tag and annotate the records of the
-- LiteratureBase, one record at a time, and propose missing papers by DOI. Built from existing parts: a normal project space (members,
-- roles, invitations), the literaturebase_snapshot cache the Literature page already reads, and two small tables for what members add.
--
-- literature_reviews: one row per review of one record by one person. Append-only (no update, no delete): a later review by the same
--   person on the same record replaces the earlier one on screen, and the older row stays as the log. A weekly pull request carries the
--   reviews back to the LiteratureBase repo; exported_at and export_batch mark the rows that were sent (set by the service role only).
-- literature_suggestions: papers a member proposes by DOI. status moves from 'waiting' to 'added' or 'declined' (service role only).
--
-- Who can do what: members of the space who are not viewers can add rows as themselves. Every member can read all rows of the space,
-- so reviewers see each other's tags and notes.
-- Rollback: DROP TABLE literature_suggestions; DROP TABLE literature_reviews; DELETE FROM projects WHERE slug = 'evoke-literature-workshop';

CREATE TABLE IF NOT EXISTS literature_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  citation_ok TEXT NOT NULL CHECK (citation_ok IN ('correct', 'needs-fix', 'cannot-tell')),
  fix_note TEXT,
  relevance TEXT NOT NULL CHECK (relevance IN ('yes', 'partly', 'no')),
  age_bands TEXT[] NOT NULL DEFAULT '{}',
  topics TEXT[] NOT NULL DEFAULT '{}',
  design TEXT,
  instrument TEXT,
  country TEXT,
  adds_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exported_at TIMESTAMPTZ,
  export_batch TEXT
);

CREATE INDEX IF NOT EXISTS idx_literature_reviews_record ON literature_reviews(project_id, record_id, created_at);
CREATE INDEX IF NOT EXISTS idx_literature_reviews_reviewer ON literature_reviews(project_id, reviewer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_literature_reviews_pending ON literature_reviews(project_id) WHERE exported_at IS NULL;

CREATE TABLE IF NOT EXISTS literature_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doi TEXT NOT NULL,
  title TEXT,
  note TEXT,
  suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'added', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_literature_suggestions_project ON literature_suggestions(project_id, created_at);

ALTER TABLE literature_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE literature_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read literature reviews" ON literature_reviews;
CREATE POLICY "Members read literature reviews" ON literature_reviews
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Members add their own literature reviews" ON literature_reviews;
CREATE POLICY "Members add their own literature reviews" ON literature_reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND has_project_role(project_id, ARRAY['owner', 'maintainer', 'editor', 'reviewer', 'contributor']::project_member_role[])
  );

DROP POLICY IF EXISTS "Members read literature suggestions" ON literature_suggestions;
CREATE POLICY "Members read literature suggestions" ON literature_suggestions
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Members add their own literature suggestions" ON literature_suggestions;
CREATE POLICY "Members add their own literature suggestions" ON literature_suggestions
  FOR INSERT WITH CHECK (
    suggested_by = auth.uid()
    AND has_project_role(project_id, ARRAY['owner', 'maintainer', 'editor', 'reviewer', 'contributor']::project_member_role[])
  );

GRANT SELECT, INSERT ON literature_reviews TO authenticated;
GRANT SELECT, INSERT ON literature_suggestions TO authenticated;
REVOKE UPDATE, DELETE ON literature_reviews FROM authenticated, anon;
REVOKE UPDATE, DELETE ON literature_suggestions FROM authenticated, anon;

-- The space itself. Private; Dustin is the owner (found by e-mail, as in migrations 128, 233 and 243). Members join by invitation.
DO $MIGRATION$
DECLARE
  v_project UUID;
  v_user UUID;
BEGIN
  SELECT id INTO v_user FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';

  INSERT INTO projects (slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)
  VALUES ('evoke-literature-workshop', $J$EvoKE Literature Workshop$J$,
    $J$A shared place where evolution education researchers check, tag and annotate the records of the LiteratureBase, one record at a time. Each review is saved under your name and goes back into the library in a weekly batch. You can also propose a missing paper by its DOI.$J$,
    'active', 'in-process', $J$A working space for checking and tagging literature records. Nothing in it is a finished result.$J$, 'hosted', TRUE, 'draft', NULL, 'thematic', ARRAY[]::TEXT[], ARRAY['literature-workshop','evolution-education']::TEXT[], ARRAY['en']::TEXT[])
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_project FROM projects WHERE slug = 'evoke-literature-workshop';
  IF v_project IS NULL THEN RAISE EXCEPTION 'evoke-literature-workshop missing'; END IF;
  IF v_user IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, role) VALUES (v_project, v_user, 'owner') ON CONFLICT (project_id, user_id) DO NOTHING;
    UPDATE projects SET created_by = v_user WHERE id = v_project AND created_by IS NULL;
  END IF;
END
$MIGRATION$;
