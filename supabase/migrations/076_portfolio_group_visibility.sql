SET search_path = public, extensions;

-- Notebooks (portfolios) gain a fourth visibility tier, 'group' -- visible
-- to one specific group (migration 075), narrower than 'project' (every
-- member) and not dependent on naming individual people like 'shared'.
-- See lab_manager's docs/design-notes/openlpm-groups-feature-2026-10-02.md.

ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_visibility_check;
ALTER TABLE portfolios ADD CONSTRAINT portfolios_visibility_check
  CHECK (visibility IN ('private', 'shared', 'project', 'group'));

-- Which group, when visibility = 'group'. Set NULL (not cascaded away) if
-- the group is later deleted -- the notebook and its content are the
-- owner's own; losing the group just means it quietly stops being shared
-- anywhere until the owner picks a visibility again, matching "deleting a
-- group never touches anyone's own content" from migration 075.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES project_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portfolios_group ON portfolios(group_id) WHERE group_id IS NOT NULL;

-- Extends the CURRENT "Members can view shared or project-visible
-- portfolios" policy: a member of the SAME group the owner picked can see
-- it, and (decided 2026-10-02) an owner/maintainer -- or anyone else this
-- project has granted group management to -- can always open any group's
-- content too, so a teacher/PI can check a group's synthesis without
-- joining it. Built on migration 009's fix, not migration 004's original --
-- 009 replaced the raw `EXISTS (... portfolio_shares ...)` subquery here
-- with `has_portfolio_share(id)` specifically to kill a live infinite-
-- recursion error (portfolios' policy reading portfolio_shares, whose own
-- policy read portfolios right back). Reintroducing the raw subquery would
-- bring that bug back.
DROP POLICY IF EXISTS "Members can view shared or project-visible portfolios" ON portfolios;
CREATE POLICY "Members can view shared or project-visible portfolios" ON portfolios
  FOR SELECT USING (
    is_project_member(project_id)
    AND (
      visibility IN ('shared', 'project')
      OR (visibility = 'group' AND group_id IS NOT NULL AND (is_group_member(group_id) OR can_manage_groups(project_id)))
      OR has_portfolio_share(id)
    )
  );

-- Same extension, mirrored onto portfolio_items/portfolio_private_nodes/
-- portfolio_links' own "viewers of a visible portfolio" policies (migration
-- 004) -- each re-derives visibility from its parent portfolio, and a
-- group's merged-synthesis graph needs to read all three across every
-- group-visible notebook, not just the portfolios row itself.
DROP POLICY IF EXISTS "Viewers of a visible portfolio can see its items" ON portfolio_items;
CREATE POLICY "Viewers of a visible portfolio can see its items" ON portfolio_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND is_project_member(p.project_id)
        AND (
          p.visibility IN ('shared', 'project')
          OR (p.visibility = 'group' AND p.group_id IS NOT NULL AND (is_group_member(p.group_id) OR can_manage_groups(p.project_id)))
          OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = p.id AND user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Viewers of a visible portfolio can see its private nodes" ON portfolio_private_nodes;
CREATE POLICY "Viewers of a visible portfolio can see its private nodes" ON portfolio_private_nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND is_project_member(p.project_id)
        AND (
          p.visibility IN ('shared', 'project')
          OR (p.visibility = 'group' AND p.group_id IS NOT NULL AND (is_group_member(p.group_id) OR can_manage_groups(p.project_id)))
          OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = p.id AND user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Viewers of a visible portfolio can see its links" ON portfolio_links;
CREATE POLICY "Viewers of a visible portfolio can see its links" ON portfolio_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND is_project_member(p.project_id)
        AND (
          p.visibility IN ('shared', 'project')
          OR (p.visibility = 'group' AND p.group_id IS NOT NULL AND (is_group_member(p.group_id) OR can_manage_groups(p.project_id)))
          OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = p.id AND user_id = auth.uid())
        )
    )
  );
