SET search_path = public, extensions;

-- In-app feedback: a small, always-reachable "Feedback" button any signed-in
-- user can use to report a problem, request, or general note, in the actual
-- context of whatever page/project they're looking at -- port of the same
-- feature built for Me-Mo and Ask Eva the same week, adapted to OpenLPM's
-- real architecture (a multi-tenant hosted app, not a local per-session
-- server), not a blind copy. See README/design note for the fuller reasoning.

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Nullable: feedback can be about a project-scoped page or the top-level
  -- project switcher/profile, which have no project_id at all.
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  tag TEXT NOT NULL DEFAULT 'Other' CHECK (tag IN ('Problem', 'Request', 'Other')),
  comment TEXT CHECK (char_length(comment) <= 2000),
  -- Read live off the app's own router/state at submit time (current route,
  -- page title, project name) -- see buildContext() in feedback-widget.tsx.
  -- Capped/shaped client-side; not validated server-side since there is no
  -- server here, only Postgres + RLS (unlike Me-Mo/Ask Eva's Python backend,
  -- which does its own context sanitization -- the equivalent guard here is
  -- just keeping this column jsonb with no executable content ever read
  -- back into a trusted context).
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Path inside the feedback-screenshots Storage bucket, NOT the image
  -- itself -- keeping binary data out of Postgres entirely is the actual
  -- mechanism for staying within Supabase's storage limits (Storage has its
  -- own, separate, cheaper quota; a database counts screenshot bytes against
  -- the much smaller Postgres storage allowance instead).
  screenshot_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can submit feedback about whatever they're looking at.
-- Deliberately NOT gated to project membership -- "this page is confusing"
-- shouldn't require re-deriving membership rules for a lightweight, casual,
-- low-stakes write, and a private project's feedback rows are still
-- protected because reading feedback back doesn't go through this policy
-- at all (see below).
CREATE POLICY "Authenticated users can submit feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- No SELECT policy at all, on purpose. Feedback is meant to be read by
-- whoever maintains OpenLPM (via the project's existing service_role key,
-- which bypasses RLS entirely and already exists for every Supabase
-- project -- no new credential to create), not browsable by other users;
-- some of it may be blunt, and a submitter reporting a problem with a
-- private project's page shouldn't leak that project's existence to
-- whoever else happens to submit feedback.

-- Storage bucket for screenshots. Private (not public), 2MB hard cap per
-- file enforced by Supabase itself as a safety net on top of client-side
-- compression (feedback-widget.tsx resizes to at most 1600px wide and
-- re-encodes as JPEG before upload, typically well under 500KB).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-screenshots', 'feedback-screenshots', FALSE, 2097152, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Standard Supabase per-user-folder pattern: a person can only upload into
-- a path starting with their own user id, so one submitter's screenshot
-- upload can never collide with or overwrite another's.
CREATE POLICY "Authenticated users can upload their own feedback screenshots" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
