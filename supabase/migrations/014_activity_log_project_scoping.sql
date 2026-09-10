-- activity_log is the one content-adjacent table the migration-004
-- multi-project retrofit skipped entirely: no project_id column, and its
-- RLS from migration 002 ("Authenticated users can view/create") predates
-- projects existing at all -- meaning if anything had started writing to it
-- as-is, every project member would see every OTHER project's activity too,
-- a real cross-tenant data leak in a genuinely multi-tenant app. Caught
-- before it mattered: the table has zero rows (confirmed live before this
-- migration), since nothing has ever actually written to it -- this closes
-- the gap before the first real write, not after.

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);

DROP POLICY IF EXISTS "Authenticated users can view activity log" ON activity_log;
DROP POLICY IF EXISTS "System can create activity log entries" ON activity_log;

CREATE POLICY "Project members can view activity log" ON activity_log
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create activity log entries" ON activity_log
  FOR INSERT WITH CHECK (is_project_member(project_id));
