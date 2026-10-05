-- Real feedback (092405e2, 2026-10-04): adding an existing OpenLPM member to
-- a project should be findable by name and should ask that person first,
-- not silently add them the moment an owner types their email -- which is
-- exactly what inviteMembers() in members.ts does today for anyone who
-- already has an account (the "added" outcome, migration 013). That
-- behavior stays as-is for its real use case (an owner pasting a whole
-- class roster they already know is theirs to add); this is a SEPARATE,
-- additional path for approaching one specific person whose consent
-- actually matters -- a researcher at another institution, a colleague who
-- should get to say no.
--
-- A request is directed at one real user_id (found by name search, not
-- typed as an email), sits pending until that person responds from their
-- own account, and only becomes real membership once they accept.

CREATE TABLE project_member_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_member_role NOT NULL DEFAULT 'contributor',
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_member_requests_project ON project_member_requests(project_id);
-- The recipient-facing lookup ("what's waiting for me") filters on this.
CREATE INDEX idx_project_member_requests_user_pending ON project_member_requests(user_id) WHERE status = 'pending';

ALTER TABLE project_member_requests ENABLE ROW LEVEL SECURITY;

-- Same has_project_role() helper project_invites (013) already uses for the
-- owner/maintainer side, so this stays consistent with every other roster
-- policy in the app rather than a one-off inline EXISTS.
CREATE POLICY "Owners/maintainers and the recipient can view requests" ON project_member_requests
  FOR SELECT USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]) OR user_id = auth.uid());
CREATE POLICY "Owners and maintainers can create requests" ON project_member_requests
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]) AND requested_by = auth.uid());
-- Owners/maintainers can cancel a request they're still waiting on;
-- separate from the recipient's own UPDATE policy below so neither side can
-- touch the other's half of this exchange.
CREATE POLICY "Owners and maintainers can cancel pending requests" ON project_member_requests
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]) AND status = 'pending');
-- The recipient answers their own pending request -- nobody else, including
-- the project owner, can flip accepted/declined on their behalf.
CREATE POLICY "Recipients can respond to their own pending requests" ON project_member_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

-- Acceptance has to actually create the membership, in the same place that
-- enforces who's allowed to flip the status -- not a second client-side
-- write after the UPDATE succeeds, which could leave status='accepted' with
-- no real project_members row if that second call failed.
CREATE OR REPLACE FUNCTION public.handle_member_request_responded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO project_members (project_id, user_id, role, invited_by)
    VALUES (NEW.project_id, NEW.user_id, NEW.role, NEW.requested_by)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  IF NEW.status IN ('accepted', 'declined') AND OLD.status = 'pending' THEN
    NEW.responded_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_member_request_responded
  BEFORE UPDATE ON project_member_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_request_responded();

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
