-- Real operational gap: there was no way to add someone to a project except
-- inserting a project_members row by hand via SQL after they'd already
-- signed in once (see openlpm-dev-gotchas memory's own enrollment
-- workaround). A project owner/maintainer can now invite by email --
-- before or after that person has ever signed up -- and it resolves itself
-- the moment they do, via the same auth-user-creation trigger that already
-- syncs public.users (migration 003), extended rather than duplicated.

CREATE TABLE IF NOT EXISTS project_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role project_member_role NOT NULL DEFAULT 'contributor',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_project_invites_project ON project_invites(project_id);
-- Case-insensitive lookup by email -- auth emails are effectively
-- case-insensitive in practice, and the redemption trigger below matches on
-- lower(email) rather than adding a citext dependency for one column.
CREATE INDEX IF NOT EXISTS idx_project_invites_email_lower ON project_invites(lower(email));

ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

-- Deliberately scoped to owners/maintainers only, same as project_members
-- itself -- an invite list is roster-shaped (real people's email addresses),
-- not something every contributor/viewer should be able to browse.
CREATE POLICY "Owners and maintainers can view invites" ON project_invites
  FOR SELECT USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can create invites" ON project_invites
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can revoke invites" ON project_invites
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Extends migration 003's handle_new_auth_user() rather than adding a
-- second trigger -- one place that reacts to a new auth.users row. Runs
-- SECURITY DEFINER (same as before), so it can insert into project_members
-- regardless of the new user's own RLS-visible membership (they have none
-- yet, which is exactly the point).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  inv RECORD;
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'user_name',
      NEW.email
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  FOR inv IN
    SELECT * FROM project_invites
    WHERE lower(email) = lower(NEW.email) AND redeemed_at IS NULL
  LOOP
    INSERT INTO project_members (project_id, user_id, role, invited_by)
    VALUES (inv.project_id, NEW.id, inv.role, inv.invited_by)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    UPDATE project_invites SET redeemed_at = NOW(), redeemed_by = NEW.id WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
