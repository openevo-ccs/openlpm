SET search_path = public, extensions;

-- Admin-only live content editing (Dustin's ask 2026-10-22): a real in-app
-- way to edit lpm_data_objects and curriculum_repository_records, instead of
-- every correction going through a hand-written SQL migration the way this
-- whole day's own feedback-follow-up session did.
--
-- Part 1: lpm_data_objects' real-world write permissions today don't allow
-- this at all -- its UPDATE policy ("Users can update own data objects",
-- migration 001) is submitted_by = auth.uid(), and virtually every real row
-- in this table was seeded via a migration with submitted_by = NULL, so that
-- policy matches practically nothing. There is also no DELETE policy at all.
-- curriculum_repository_records doesn't need this fix -- its own INSERT/
-- UPDATE/DELETE policies already gate on has_project_role(), which migration
-- 058 redefined to include "OR is_admin()", so an admin already has full
-- write access there today.
CREATE POLICY "Admins can update any data object" ON lpm_data_objects
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete data objects" ON lpm_data_objects
  FOR DELETE USING (is_admin());

-- Part 2: a real per-edit change log, distinct from activity_log (migration
-- 001/014). activity_log is an open-vocabulary, fire-and-forget activity
-- feed (its own client helper explicitly treats a failed write as a minor,
-- swallowed loss) -- fine for "someone did something," not a trustworthy
-- record of exactly what a specific edit changed. This is the first
-- dedicated diff-aware changelog table in this schema.
--
-- Two levels, matching Dustin's own framing ("annotate changes... during a
-- specific edit or a session of multiple edits") and his 2026-10-22 answer
-- that this should be a lightweight running note rather than an explicit
-- start/stop workflow: content_edit_sessions holds the running note text a batch
-- of edits shares; content_edit_log holds one row per changed column, each
-- optionally carrying its own note for a single edit that deserves its own
-- callout beyond the session's note. A session has no explicit "closed"
-- state -- the client starts a new one whenever the note text changes (see
-- src/lib/supabase/content-editing.ts).
CREATE TABLE IF NOT EXISTS content_edit_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_edit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES content_edit_sessions(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL CHECK (table_name IN ('lpm_data_objects', 'curriculum_repository_records')),
  record_id UUID NOT NULL,
  -- Column name the change happened on (e.g. "title", "content", "status").
  -- Diffs at the column level rather than a deep JSON-pointer into a JSONB
  -- column's own structure -- simpler and still fully reconstructable: the full
  -- before/after value of that column is captured either way.
  field_name TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  note TEXT,
  edited_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_edit_log_record ON content_edit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_content_edit_log_session ON content_edit_log (session_id);

ALTER TABLE content_edit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_edit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only in every direction, matching "Admin only for now."  Easy to
-- open read access to project members later (a real, separate decision --
-- not assumed here) without touching the write side at all.
CREATE POLICY "Admins can read edit sessions" ON content_edit_sessions
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can create edit sessions" ON content_edit_sessions
  FOR INSERT WITH CHECK (is_admin() AND started_by = auth.uid());
CREATE POLICY "Admins can update their own edit sessions" ON content_edit_sessions
  FOR UPDATE USING (is_admin() AND started_by = auth.uid());

CREATE POLICY "Admins can read edit log" ON content_edit_log
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can create edit log entries" ON content_edit_log
  FOR INSERT WITH CHECK (is_admin() AND edited_by = auth.uid());
