SET search_path = public, extensions;

-- Real operational gap, confirmed live 2026-09-30: a brand-new signed-up
-- user with zero memberships lands on "You aren't a member of any project
-- space yet. Ask an owner to add you" -- there is no way for them to find
-- or join anything themselves. project_invites (migration 013) already
-- solves this for a NAMED individual an owner adds ahead of time, one email
-- at a time or pasted as a roster -- but a real incoming class (Uni Jena's
-- Biologiedidaktik Winter Semester 2026 pilot) can't realistically be
-- rostered by exact email before the semester starts, and shouldn't need to
-- be. This adds a second, complementary mechanism: an owner/maintainer
-- defines WHO is allowed to self-join (a specific email, or a whole email
-- domain like "uni-jena.de"), and an eligible signed-in user joins
-- themselves via a shareable link or their own profile page -- no
-- per-person invite required. A rule only gates the join action itself,
-- same as an invite only gates redemption -- it's not an ongoing
-- access-control check after someone's already a member, and removing a
-- rule later doesn't remove anyone it already let in.

CREATE TYPE project_join_rule_type AS ENUM ('email', 'domain');

CREATE TABLE IF NOT EXISTS project_join_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rule_type project_join_rule_type NOT NULL,
  -- Exact email (lowercased) for 'email' rules, or a bare domain with no
  -- leading '@' (e.g. 'uni-jena.de', lowercased) for 'domain' rules.
  value TEXT NOT NULL,
  role project_member_role NOT NULL DEFAULT 'contributor',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, rule_type, value)
);

CREATE INDEX IF NOT EXISTS idx_project_join_rules_project ON project_join_rules(project_id);

ALTER TABLE project_join_rules ENABLE ROW LEVEL SECURITY;

-- Same scoping as project_invites: the full rule list (which domains/emails
-- are allowlisted) is roster-adjacent information, visible only to the
-- people who manage membership.
CREATE POLICY "Owners and maintainers can view join rules" ON project_join_rules
  FOR SELECT USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can create join rules" ON project_join_rules
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can delete join rules" ON project_join_rules
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Lets anyone see the ONE rule (if any) that actually matches their own
-- sign-in email -- enough for the join screen to know which role they'd get
-- before they click Join, without exposing the rest of the allowlist to
-- them. auth.email() reads the live JWT claim (no SELECT grant on
-- auth.users needed), matching Supabase's own standard convention.
CREATE POLICY "A user can see a join rule that matches their own email" ON project_join_rules
  FOR SELECT USING (
    (rule_type = 'email' AND value = lower(auth.email()))
    OR (rule_type = 'domain' AND lower(auth.email()) LIKE '%@' || value)
  );

-- Extends migration 025's policy: a project with a rule matching the
-- viewer's own email becomes visible to them too (name/description only,
-- same as the existing public-project case), even if is_private=TRUE --
-- otherwise there'd be no way to show them what they're about to join.
-- Still correctly invisible to anyone whose email matches no rule on a
-- private project, and adding a rule can never expose a project that
-- was never opted into self-join at all.
DROP POLICY IF EXISTS "Public projects are visible to all; private ones to members and their creator" ON projects;
CREATE POLICY "Projects are visible to the public, members, creator, or an eligible self-joiner" ON projects
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      is_private = FALSE
      OR is_project_member(id)
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_join_rules r
        WHERE r.project_id = projects.id
          AND (
            (r.rule_type = 'email' AND r.value = lower(auth.email()))
            OR (r.rule_type = 'domain' AND lower(auth.email()) LIKE '%@' || r.value)
          )
      )
    )
  );

-- The actual join action: a plain INSERT the joining user makes themselves
-- (own user_id, and only ever the exact role that a matching rule actually
-- grants -- the extra `r.role = project_members.role` check is what stops
-- someone from self-inserting as 'owner' instead of the rule's real role).
-- Additive alongside migration 004's existing owner/maintainer INSERT
-- policy, not a replacement -- Postgres ORs multiple permissive policies
-- together, so either path can succeed.
CREATE POLICY "A user can self-join via a matching rule" ON project_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_join_rules r
      WHERE r.project_id = project_members.project_id
        AND r.role = project_members.role
        AND (
          (r.rule_type = 'email' AND r.value = lower(auth.email()))
          OR (r.rule_type = 'domain' AND lower(auth.email()) LIKE '%@' || r.value)
        )
    )
  );

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
