SET search_path = public, extensions;

-- Real feedback 20450401 (Dustin Eirdosh, 2026-10-02): a project owner should
-- be able to cross-link ("federate") their project's members into another,
-- independent project space -- not parent/child nesting, a lateral
-- relationship between two projects that stay fully separate. Full design at
-- lab_manager/docs/design-notes/openlpm-project-federation-2026-10-02.md,
-- both real open questions (does accepting need a real member-list preview;
-- can a Curriculum Repository federate) decided there by Dustin directly.
-- Dustin said go on building it 2026-10-02, same session as this migration.
--
-- Core design call: federation grants REAL project_members rows rather than
-- building a second, parallel "effective access" concept -- every existing
-- table's is_project_member()/has_project_role() check keeps working
-- unmodified, for free. See the design doc's own "core design decision"
-- section for the full reasoning.

-- ============================================================================
-- project_federations: one row per DIRECTION of a relationship (A->B and
-- B->A are two separate rows, each with its own lifecycle and role), not one
-- row per pair.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_federations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The role source's members get inside target. Never 'owner' -- see
  -- CHECK below and the design doc's "Guardrails" section.
  granted_role project_member_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'revoked')),
  proposed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (source_project_id <> target_project_id),
  CHECK (granted_role <> 'owner')
);

-- A new proposal can't collide with an already-proposed/accepted direction,
-- but a REVOKED one doesn't block re-proposing later (a partial index, not a
-- plain UNIQUE, so history for an ended federation can stay in the table).
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_federations_active_direction
  ON project_federations(source_project_id, target_project_id)
  WHERE status IN ('proposed', 'accepted');

CREATE INDEX IF NOT EXISTS idx_project_federations_source ON project_federations(source_project_id);
CREATE INDEX IF NOT EXISTS idx_project_federations_target ON project_federations(target_project_id);

-- Tracks WHY a project_members row exists, so revoking a federation (or a
-- source member leaving) can cleanly remove only the rows it caused. A
-- direct invite/self-join/owner-created row leaves this NULL.
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS source_federation_id UUID
  REFERENCES project_federations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_members_source_federation ON project_members(source_federation_id);

ALTER TABLE project_federations ENABLE ROW LEVEL SECURITY;

-- Visible to owner/maintainer of EITHER side -- roster-adjacent information,
-- same scoping convention as project_join_rules/project_invites.
CREATE POLICY "Owner or maintainer of either side can view a federation" ON project_federations
  FOR SELECT USING (
    has_project_role(source_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    OR has_project_role(target_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
  );

-- Proposing IS the source's own consent (they're the one offering their
-- team). Only an owner/maintainer of the SOURCE project can create a
-- 'proposed' row -- the target's consent is a separate, later accept.
CREATE POLICY "Source owner or maintainer can propose a federation" ON project_federations
  FOR INSERT WITH CHECK (
    status = 'proposed'
    AND proposed_by = auth.uid()
    AND has_project_role(source_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
  );

-- Each UPDATE policy re-checks its own authorization inside WITH CHECK, not
-- just inside USING -- Postgres combines multiple permissive policies'
-- USING clauses with OR to decide which existing rows are candidates, and
-- separately ORs their WITH CHECK clauses to decide whether the new row is
-- allowed, so a WITH CHECK that only inspects the new column values (without
-- re-stating who may set them) could pass via a DIFFERENT policy's USING
-- eligibility. Restating the role check in both halves closes that gap.
CREATE POLICY "Target owner or maintainer can accept a proposed federation" ON project_federations
  FOR UPDATE USING (
    status = 'proposed'
    AND has_project_role(target_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
  )
  WITH CHECK (
    status = 'accepted'
    AND accepted_by = auth.uid()
    AND has_project_role(target_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
  );

-- Either side can end it: source declining their own earlier proposal,
-- source withdrawing an active federation, or target revoking one it
-- previously accepted. Also covers declining a still-'proposed' row.
CREATE POLICY "Owner or maintainer of either side can revoke a federation" ON project_federations
  FOR UPDATE USING (
    status IN ('proposed', 'accepted')
    AND (
      has_project_role(source_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
      OR has_project_role(target_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  )
  WITH CHECK (
    status = 'revoked'
    AND revoked_by = auth.uid()
    AND (
      has_project_role(source_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
      OR has_project_role(target_project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

-- ============================================================================
-- Guardrail: a Curriculum Repository project can never be a federation
-- SOURCE (its own membership is an invited reviewer/curator list, not a pool
-- to push out into someone else's project) -- but CAN be a target (another
-- project's members can be granted access into a repository, same accept
-- gate as any other target). A CHECK constraint can't subquery another
-- table in Postgres, so this is a trigger instead.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_curriculum_repository_federation_source()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM projects WHERE id = NEW.source_project_id AND project_kind = 'curriculum-repository') THEN
    RAISE EXCEPTION 'A Curriculum Repository project cannot be a federation source';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_curriculum_repository_federation_source ON project_federations;
CREATE TRIGGER trg_prevent_curriculum_repository_federation_source
  BEFORE INSERT ON project_federations
  FOR EACH ROW EXECUTE FUNCTION prevent_curriculum_repository_federation_source();

-- ============================================================================
-- Provisioning: accepting grants real project_members rows for source's
-- CURRENT direct members (source_federation_id IS NULL -- excluding source's
-- own federated-in members is what makes federation non-chaining: a project
-- can only pass along membership it directly owns, not membership it itself
-- received through another federation). Revoking removes exactly the rows
-- this federation created. Never touches a user who already has their own
-- row in target (direct membership always wins, and is never downgraded).
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_federation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    INSERT INTO project_members (project_id, user_id, role, invited_by, source_federation_id)
    SELECT NEW.target_project_id, pm.user_id, NEW.granted_role, NEW.accepted_by, NEW.id
    FROM project_members pm
    WHERE pm.project_id = NEW.source_project_id
      AND pm.source_federation_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM project_members existing
        WHERE existing.project_id = NEW.target_project_id AND existing.user_id = pm.user_id
      );
  ELSIF NEW.status = 'revoked' AND OLD.status IS DISTINCT FROM 'revoked' THEN
    DELETE FROM project_members WHERE source_federation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_handle_federation_status_change ON project_federations;
CREATE TRIGGER trg_handle_federation_status_change
  AFTER UPDATE ON project_federations
  FOR EACH ROW EXECUTE FUNCTION handle_federation_status_change();

-- Keeps an active federation live: a NEW direct member of source is
-- provisioned into every target source federates into, automatically.
-- Gated on NEW.source_federation_id IS NULL so a row THIS function itself
-- just inserted (or the bulk accept-time INSERT above) never re-fires this
-- same propagation a second hop further -- the same non-chaining guarantee.
CREATE OR REPLACE FUNCTION propagate_new_member_via_federation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_federation_id IS NULL THEN
    INSERT INTO project_members (project_id, user_id, role, invited_by, source_federation_id)
    SELECT f.target_project_id, NEW.user_id, f.granted_role, f.accepted_by, f.id
    FROM project_federations f
    WHERE f.source_project_id = NEW.project_id
      AND f.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM project_members existing
        WHERE existing.project_id = f.target_project_id AND existing.user_id = NEW.user_id
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_propagate_new_member_via_federation ON project_members;
CREATE TRIGGER trg_propagate_new_member_via_federation
  AFTER INSERT ON project_members
  FOR EACH ROW EXECUTE FUNCTION propagate_new_member_via_federation();

-- A direct member of source leaving removes their federation-sourced row(s)
-- in whatever source federates into. Gated the same way (OLD.source_federation_id
-- IS NULL) so deleting a federation-sourced row itself -- e.g. the bulk
-- DELETE in handle_federation_status_change's revoke branch above -- doesn't
-- recursively cascade further.
CREATE OR REPLACE FUNCTION remove_federated_access_on_member_leave()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.source_federation_id IS NULL THEN
    DELETE FROM project_members pm
    WHERE pm.user_id = OLD.user_id
      AND pm.source_federation_id IN (
        SELECT id FROM project_federations WHERE source_project_id = OLD.project_id AND status = 'accepted'
      );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_remove_federated_access_on_member_leave ON project_members;
CREATE TRIGGER trg_remove_federated_access_on_member_leave
  AFTER DELETE ON project_members
  FOR EACH ROW EXECUTE FUNCTION remove_federated_access_on_member_leave();

-- ============================================================================
-- Narrow lookup helpers. A private project's own row is normally invisible
-- to a non-member (migration 035's SELECT policy) -- correct for browsing,
-- but it means the two real federation screens (propose: resolve a target
-- you already know the slug of; accept: preview exactly who's about to be
-- added) need their own tightly-scoped reads, same SECURITY DEFINER +
-- explicit in-function auth check pattern as is_project_member/
-- has_project_role themselves already use, not a broadening of the general
-- projects directory policy.
-- ============================================================================

-- Resolves a project by its EXACT slug -- same bar as needing someone's
-- exact email for an invite, not a browsable search. Returns only name/slug/
-- kind, never membership or content, to any signed-in user.
CREATE OR REPLACE FUNCTION find_project_for_federation(p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, project_kind TEXT) AS $$
  SELECT id, name, slug, project_kind FROM projects WHERE slug = p_slug;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION find_project_for_federation(TEXT) TO authenticated;

-- Resolves the other side's name/slug for a federation row the caller can
-- already see (used once a proposal exists, to label it in either side's
-- settings page without needing membership in the other project).
CREATE OR REPLACE FUNCTION federation_counterparty(p_project_id UUID)
RETURNS TABLE(id UUID, name TEXT, slug TEXT) AS $$
  SELECT id, name, slug FROM projects WHERE id = p_project_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION federation_counterparty(UUID) TO authenticated;

-- The real accept-time preview: exactly who is about to be added and at
-- what role. Only returns rows if the caller is owner/maintainer of the
-- federation's OWN target -- re-checked inside the function itself, not
-- left to the caller's own RLS, since this crosses into source's
-- membership which the caller otherwise can't see at all.
CREATE OR REPLACE FUNCTION federation_preview_members(p_federation_id UUID)
RETURNS TABLE(user_id UUID, name TEXT, email TEXT, role project_member_role) AS $$
  SELECT u.id, u.name, u.email, pm.role
  FROM project_federations f
  JOIN project_members pm ON pm.project_id = f.source_project_id AND pm.source_federation_id IS NULL
  JOIN users u ON u.id = pm.user_id
  WHERE f.id = p_federation_id
    AND has_project_role(f.target_project_id, ARRAY['owner', 'maintainer']::project_member_role[]);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION federation_preview_members(UUID) TO authenticated;

-- Labels a federation-sourced roster row ("via federation with <name>") for
-- anyone who can already see that row at all (any member of the target
-- project, viewing their own project's own roster) -- not restricted to
-- owner/maintainer, since the roster row itself is already that visible.
CREATE OR REPLACE FUNCTION federation_source_name(p_federation_id UUID)
RETURNS TEXT AS $$
  SELECT p.name FROM project_federations f JOIN projects p ON p.id = f.source_project_id WHERE f.id = p_federation_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION federation_source_name(UUID) TO authenticated;

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
