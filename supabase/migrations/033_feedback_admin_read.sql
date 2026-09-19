SET search_path = public, extensions;

-- Closes a real gap found 2026-09-19: the feedback table (migration 026)
-- was deliberately built with no SELECT policy at all, on the assumption
-- someone would read it via the service_role key -- but nothing was ever
-- actually built to do that, so every real submission since the Feedback
-- button shipped has been going into a table nobody could read. Dustin
-- confirmed this directly ("I made many feedback reports and none seem to
-- be getting implemented").
--
-- Fix: give the app a real, in-app way to read it, gated by the global
-- `users.role` column. That column has existed since migration 001 with
-- 'admin' as a valid value, but migration 017's own note found it was
-- completely dormant -- "no signup path or trigger has ever set" it to
-- anything but the default 'contributor', and the one place that used to
-- check it was fixed to use the real per-project role system instead,
-- since that was a case of the WRONG tool (a per-project permission
-- question, wrongly checked against a global column). Reading feedback is
-- the opposite case: a genuinely global, cross-project question (feedback
-- spans every project, plus project-less pages like the switcher) that the
-- per-project role system can't express at all -- the first real, correct
-- use of this column since it landed.

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved'));

UPDATE users SET role = 'admin' WHERE email = 'dustin@globalesd.org';

CREATE POLICY "Admins can read all feedback" ON feedback
  FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update feedback status" ON feedback
  FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- The screenshots bucket (migration 026) only ever had an INSERT policy --
-- generating a signed URL to actually view one still checks RLS against
-- the requesting user, so without this, even an admin who could now read
-- the feedback row couldn't see its attached screenshot.
CREATE POLICY "Admins can read feedback screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'feedback-screenshots'
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
