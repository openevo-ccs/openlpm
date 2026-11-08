SET search_path = public, extensions;

-- Edits made inside the Base Repo Explorer card (Susan Hanisch, feedback 0afc62a5, 2026-11-08:
-- "admins should have the option to edit stuff directly in this card, both any text and any
-- assignment of metadata"; Dustin chose "edits saved in the app" the same day).
--
-- The Explorer shows a copy of each source repo (the *_snapshot tables), refreshed by the
-- scripts/sync_*_snapshot.mjs scripts. A cache like that is overwritten at every refresh, so an
-- edit cannot be written into it. Each edit is stored here instead, one row per changed field,
-- and the Explorer shows the latest edit of a field on top of the repo copy. The table is also
-- the change log: rows are never updated except to mark them as sent back, and never deleted.
-- Undoing an edit is a new row with is_reset = true (back to the repo copy).
--
-- Sending edits back to the source repos happens in batches: an admin downloads the waiting
-- edits from the Explorer, a session applies them to the repos through a normal pull request,
-- and the batch is marked with exported_at and export_batch.
CREATE TABLE IF NOT EXISTS base_repo_record_edits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Which base repo ('methodsbase', 'literaturebase', ...) and which record in it.
  base_repo TEXT NOT NULL,
  record_id TEXT NOT NULL,
  -- Where in the record the change is, as a dotted path into its data,
  -- e.g. 'learningApproaches', 'description.en', 'citation.title'.
  field_path TEXT NOT NULL,
  -- What the editor saw before, and what they saved. Both are the field's own JSON value
  -- (a string, or a list of strings for tags and steps).
  before_value JSONB,
  after_value JSONB,
  -- true = this row puts the field back to the repo copy; after_value is then empty.
  is_reset BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when the edit has been applied to the source repo.
  exported_at TIMESTAMPTZ,
  export_batch TEXT
);

CREATE INDEX IF NOT EXISTS idx_base_repo_record_edits_record ON base_repo_record_edits(base_repo, record_id, edited_at);
CREATE INDEX IF NOT EXISTS idx_base_repo_record_edits_pending ON base_repo_record_edits(base_repo) WHERE exported_at IS NULL;

ALTER TABLE base_repo_record_edits ENABLE ROW LEVEL SECURITY;

-- The Explorer is admin-only for now (decision of 2026-10-21), so is the edit data.
CREATE POLICY "Admins can read Base Repo edits" ON base_repo_record_edits
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can add Base Repo edits as themselves" ON base_repo_record_edits
  FOR INSERT WITH CHECK (is_admin() AND edited_by = auth.uid());

-- The only change allowed on an existing row is marking it as sent back. The edit's content stays
-- as it was written, because this table is the change log.
CREATE POLICY "Admins can mark Base Repo edits as sent back" ON base_repo_record_edits
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

REVOKE UPDATE, DELETE ON base_repo_record_edits FROM authenticated, anon;
GRANT UPDATE (exported_at, export_batch) ON base_repo_record_edits TO authenticated;
