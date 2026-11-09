SET search_path = public, extensions;

-- A person can opt out of having their contributions processed by any outside AI service
-- (Uni Jena students asked for this on 2026-11-09, the day the seminar started).
--
-- The setting lives in its own table, and users.* stays untouched, because every signed-in user
-- can read every row of `users` (migration 001). A privacy choice should be visible only to the
-- person who made it and to admins.
--
-- No row means "not opted out". The app writes a row the first time someone flips the switch.
--
-- What the switch covers is written in ethics/ai-ethics-framework.md and src/pages/privacy-page.tsx.
-- It is enforced by the scripts that read student content for AI-assisted work
-- (scripts/lib/ai-opt-out.mjs), since this database has no AI calls of its own.
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ai_processing_opt_out BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People read their own privacy settings" ON user_privacy_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins read all privacy settings" ON user_privacy_settings
  FOR SELECT USING (is_admin());

CREATE POLICY "People create their own privacy settings" ON user_privacy_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "People change their own privacy settings" ON user_privacy_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_user_privacy_settings_updated_at
  BEFORE UPDATE ON user_privacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Requests to delete a person's account and data (GDPR Art. 17).
--
-- A request is recorded with its date and a due date one month later (Art. 12(3) asks for an
-- answer within one month). An admin works the queue with scripts/execute_data_deletion.mjs,
-- which deletes the account (everything keyed to the account goes with it) and removes the
-- personal details from the request itself, so the table keeps only the date, the outcome and
-- who handled it. Once the account is gone, user_id turns NULL through the foreign key.
--
-- A person can have one open request at a time, and can withdraw it while it is open.
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  -- Optional, written by the person. Emptied when the request is closed.
  reason TEXT CHECK (char_length(reason) <= 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'declined', 'withdrawn')),
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  -- Written by the admin. Emptied of personal details when the request is closed.
  handling_note TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_deletion_requests_one_open
  ON data_deletion_requests(user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_open_due
  ON data_deletion_requests(due_at) WHERE status = 'open';

ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People read their own deletion requests" ON data_deletion_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins read all deletion requests" ON data_deletion_requests
  FOR SELECT USING (is_admin());

CREATE POLICY "People file a deletion request for themselves" ON data_deletion_requests
  FOR INSERT WITH CHECK (user_id = auth.uid() AND status = 'open' AND handled_by IS NULL AND handled_at IS NULL);

-- A person may only withdraw their own open request. Closing it any other way is for admins.
CREATE POLICY "People withdraw their own open deletion request" ON data_deletion_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'open')
  WITH CHECK (user_id = auth.uid() AND status = 'withdrawn');

CREATE POLICY "Admins update deletion requests" ON data_deletion_requests
  FOR UPDATE USING (is_admin());
