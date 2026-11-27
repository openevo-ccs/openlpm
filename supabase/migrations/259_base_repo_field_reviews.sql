SET search_path = public, extensions;

-- Thumbs-up and flag on single fields of Base Repo records, set in the Explorer's edit form
-- (Susan Hanisch, feedback 1551a6e1, 2026-11-25: "we need an easier way for users to review and approve fields,
-- like with a thumbs up and flag icon next to each field, when in edit mode").
--
-- One row per decision on one field of one record. The table is a log: rows are never changed or deleted,
-- except that a row is marked as sent back to the source repo (exported_at, export_batch). Taking a thumbs-up
-- or a flag away adds a row with verdict 'cleared'. The latest row of a field counts.
--
-- value_seen is the text of the field at the moment of the decision. An approval counts only while the field
-- still says exactly that, so a later edit shows the field as "changed since it was approved" instead of
-- keeping a thumbs-up on words nobody has read.
CREATE TABLE IF NOT EXISTS base_repo_field_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_repo TEXT NOT NULL,
  record_id TEXT NOT NULL,
  -- Dotted path into the record, the same paths as base_repo_record_edits ('description.de', 'learningApproaches').
  field_path TEXT NOT NULL,
  -- TEXT with a check rather than an enum, like every other extensible vocabulary in this database.
  verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'flagged', 'cleared')),
  value_seen JSONB,
  -- What looks wrong (flag) or a remark (thumbs-up). Optional.
  note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when the approval has been written into the source repo (its reviewed-fields list).
  exported_at TIMESTAMPTZ,
  export_batch TEXT
);

CREATE INDEX IF NOT EXISTS idx_base_repo_field_reviews_record ON base_repo_field_reviews(base_repo, record_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_base_repo_field_reviews_pending ON base_repo_field_reviews(base_repo) WHERE exported_at IS NULL AND verdict = 'approved';

ALTER TABLE base_repo_field_reviews ENABLE ROW LEVEL SECURITY;

-- The Explorer is admin-only for now (decision of 2026-10-21), so are the reviews.
CREATE POLICY "Admins can read Base Repo field reviews" ON base_repo_field_reviews
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can add Base Repo field reviews as themselves" ON base_repo_field_reviews
  FOR INSERT WITH CHECK (is_admin() AND reviewed_by = auth.uid());

CREATE POLICY "Admins can mark Base Repo field reviews as sent back" ON base_repo_field_reviews
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

REVOKE UPDATE, DELETE ON base_repo_field_reviews FROM authenticated, anon;
GRANT UPDATE (exported_at, export_batch) ON base_repo_field_reviews TO authenticated;
