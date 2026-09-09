-- RFC 0002: projects, branches, portfolios, and cross-base linking.
-- Every existing content table was global; this migration scopes them to a
-- project (and, where meaningful, a branch within it) and replaces the
-- "any authenticated user" RLS policies from 002_require_auth_for_reads.sql
-- with project-membership-scoped ones.

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed', 'discontinued');

-- Mirrors ConceptBase RFC-0019's oe:epistemicStatus so a project's synthetic/
-- real character is a first-class, always-visible field, not buried metadata.
CREATE TYPE project_epistemic_status AS ENUM ('designed-thought-experiment', 'field-validated', 'in-process');

CREATE TYPE project_member_role AS ENUM ('owner', 'maintainer', 'editor', 'reviewer', 'contributor', 'viewer');

-- 'promoted' = this branch's content was pursued into a real, independent
-- project (see projects.promoted_from_branch_id), per RFC 0002 section 3's
-- two-tier model. Distinct from 'merged' (folded back into its parent
-- branch/trunk) and 'archived' (abandoned).
CREATE TYPE branch_status AS ENUM ('active', 'promoted', 'merged', 'archived');

CREATE TYPE base_repo_enum AS ENUM (
  'conceptbase', 'theorybase', 'questionbase', 'literaturebase', 'competencybase',
  'methodsbase', 'quotebase', 'humanbase', 'projectbase', 'teachingbase'
);

-- ============================================================================
-- Projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'planning',
  epistemic_status project_epistemic_status NOT NULL,
  epistemic_status_note TEXT,
  -- Cross-reference only, e.g. 'project:eva-lpm' -- ProjectBase is a
  -- separate, provisional (pre-RFC) repo, so this is deliberately not a
  -- foreign key. See RFC 0002 section on ProjectBase vs. OpenLPM projects.
  projectbase_ref TEXT,
  hosting_mode TEXT NOT NULL DEFAULT 'hosted' CHECK (hosting_mode IN ('hosted', 'self-hosted')),
  -- Set only on a project that came into being by promoting a branch of
  -- another project (RFC 0002 section 3). Null for a project founded directly.
  promoted_from_branch_id UUID, -- FK added after branches exists, below
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_member_role NOT NULL DEFAULT 'contributor',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- ============================================================================
-- Branches
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  label TEXT NOT NULL,
  description TEXT,
  is_trunk BOOLEAN NOT NULL DEFAULT FALSE,
  forked_from_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  fork_rationale TEXT,
  status branch_status NOT NULL DEFAULT 'active',
  -- Set when this branch is promoted to a full independent project (RFC 0002
  -- section 3) -- the mirror image of projects.promoted_from_branch_id.
  promoted_to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, slug),
  CHECK (NOT (is_trunk AND forked_from_branch_id IS NOT NULL))
);

-- Exactly one trunk branch per project.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_trunk_per_project ON branches(project_id) WHERE is_trunk;

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_promoted_from_branch
  FOREIGN KEY (promoted_from_branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- ============================================================================
-- Cross-base linking (RFC 0002 section 5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_base_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_repo base_repo_enum NOT NULL,
  can_import BOOLEAN NOT NULL DEFAULT TRUE,
  -- Whether this project is even allowed to open PRs against this base --
  -- a separate, per-project-member role check (see policies below) still
  -- gates *who* on the project may actually trigger one.
  can_propose_pr BOOLEAN NOT NULL DEFAULT FALSE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, base_repo)
);

-- ============================================================================
-- Portfolios (RFC 0002 section 4): unlimited named portfolios per user per
-- project. Items reference canonical content by FK -- never copy it -- plus
-- fully user-owned private nodes/links, following Eva KGDJ's pattern.
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'project')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, owner_id, name)
);

CREATE TABLE IF NOT EXISTS portfolio_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (portfolio_id, user_id)
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('schema_element', 'data_object')),
  target_id UUID NOT NULL,
  custom_annotation TEXT,
  pos_x REAL,
  pos_y REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (portfolio_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS portfolio_private_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('note', 'question', 'draft_concept', 'draft_lesson')),
  label TEXT NOT NULL,
  content TEXT,
  pos_x REAL,
  pos_y REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  from_item_id UUID REFERENCES portfolio_items(id) ON DELETE CASCADE,
  from_private_id UUID REFERENCES portfolio_private_nodes(id) ON DELETE CASCADE,
  to_item_id UUID REFERENCES portfolio_items(id) ON DELETE CASCADE,
  to_private_id UUID REFERENCES portfolio_private_nodes(id) ON DELETE CASCADE,
  label TEXT,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (num_nonnulls(from_item_id, from_private_id) = 1),
  CHECK (num_nonnulls(to_item_id, to_private_id) = 1)
);

-- ============================================================================
-- Retrofit existing content tables with project/branch scope
-- ============================================================================

ALTER TABLE literature_references ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE lpm_schema_elements ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE lpm_schema_elements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE lpm_data_objects ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE lpm_data_objects ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE discussion_topics ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE evidence_links ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE peer_review_assignments ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_literature_references_project ON literature_references(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_schema_elements_project ON lpm_schema_elements(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_schema_elements_branch ON lpm_schema_elements(branch_id);
CREATE INDEX IF NOT EXISTS idx_lpm_data_objects_project ON lpm_data_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_data_objects_branch ON lpm_data_objects(branch_id);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_project ON discussion_topics(project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_project ON evidence_links(project_id);
CREATE INDEX IF NOT EXISTS idx_peer_review_assignments_project ON peer_review_assignments(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_branches_project ON branches(project_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_project_owner ON portfolios(project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_portfolio ON portfolio_items(portfolio_id);

-- ============================================================================
-- Helper functions for RLS (SECURITY DEFINER so they can read project_members
-- regardless of the calling row's own RLS -- mirrors Eva KGDJ's kgdj.is_member()).
-- ============================================================================

CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION project_role(p_project_id UUID)
RETURNS project_member_role AS $$
  SELECT role FROM project_members
  WHERE project_id = p_project_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION has_project_role(p_project_id UUID, p_roles project_member_role[])
RETURNS BOOLEAN AS $$
  SELECT project_role(p_project_id) = ANY(p_roles);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_base_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_private_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_links ENABLE ROW LEVEL SECURITY;

-- Projects: discoverable by any authenticated user (a browsable directory,
-- like a Commons will eventually need), but only members can join/leave/edit.
CREATE POLICY "Authenticated users can view projects" ON projects
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
CREATE POLICY "Owners and maintainers can update their project" ON projects
  FOR UPDATE USING (has_project_role(id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- The creator of a project is auto-enrolled as its owner (see trigger below),
-- so membership rows are otherwise only visible/manageable within the project.
CREATE POLICY "Project members can view their project's membership" ON project_members
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Owners and maintainers can manage membership" ON project_members
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can update membership" ON project_members
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers can remove membership" ON project_members
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Branches: readable by project members; only maintainers+ create/fork/promote.
CREATE POLICY "Project members can view branches" ON branches
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Maintainers can create branches" ON branches
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can update branches" ON branches
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Base links: readable by project members; only maintainers+ configure.
CREATE POLICY "Project members can view base links" ON project_base_links
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Maintainers can manage base links" ON project_base_links
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can update base links" ON project_base_links
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Maintainers can remove base links" ON project_base_links
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Portfolios: owner has full control; project members can view shared/project-
-- visibility portfolios; explicit shares (mirrors kgdj.subgraph_shares) grant a
-- specific other member read/review access to an otherwise-private portfolio.
CREATE POLICY "Owners manage their own portfolios" ON portfolios
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members can view shared or project-visible portfolios" ON portfolios
  FOR SELECT USING (
    is_project_member(project_id)
    AND (
      visibility IN ('shared', 'project')
      OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = portfolios.id AND user_id = auth.uid())
    )
  );

CREATE POLICY "Portfolio owners manage shares" ON portfolio_shares
  FOR ALL USING (EXISTS (SELECT 1 FROM portfolios WHERE id = portfolio_id AND owner_id = auth.uid()));
CREATE POLICY "Grantees can see their own share grant" ON portfolio_shares
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Portfolio owners manage their items" ON portfolio_items
  FOR ALL USING (EXISTS (SELECT 1 FROM portfolios WHERE id = portfolio_id AND owner_id = auth.uid()));
CREATE POLICY "Viewers of a visible portfolio can see its items" ON portfolio_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND is_project_member(p.project_id)
        AND (
          p.visibility IN ('shared', 'project')
          OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = p.id AND user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Portfolio owners manage their private nodes" ON portfolio_private_nodes
  FOR ALL USING (EXISTS (SELECT 1 FROM portfolios WHERE id = portfolio_id AND owner_id = auth.uid()));
CREATE POLICY "Viewers of a visible portfolio can see its private nodes" ON portfolio_private_nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND is_project_member(p.project_id)
        AND (
          p.visibility IN ('shared', 'project')
          OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = p.id AND user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Portfolio owners manage their links" ON portfolio_links
  FOR ALL USING (EXISTS (SELECT 1 FROM portfolios WHERE id = portfolio_id AND owner_id = auth.uid()));
CREATE POLICY "Viewers of a visible portfolio can see its links" ON portfolio_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND is_project_member(p.project_id)
        AND (
          p.visibility IN ('shared', 'project')
          OR EXISTS (SELECT 1 FROM portfolio_shares WHERE portfolio_id = p.id AND user_id = auth.uid())
        )
    )
  );

-- Re-scope existing content tables' read policies from "any authenticated
-- user" (002_require_auth_for_reads.sql) to "members of the owning project".
DROP POLICY IF EXISTS "Authenticated users can view literature references" ON literature_references;
CREATE POLICY "Project members can view literature references" ON literature_references
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can view schema elements" ON lpm_schema_elements;
CREATE POLICY "Project members can view schema elements" ON lpm_schema_elements
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can view data objects" ON lpm_data_objects;
CREATE POLICY "Project members can view data objects" ON lpm_data_objects
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can view evidence links" ON evidence_links;
CREATE POLICY "Project members can view evidence links" ON evidence_links
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can view topics" ON discussion_topics;
CREATE POLICY "Project members can view topics" ON discussion_topics
  FOR SELECT USING (is_project_member(project_id));

-- Existing INSERT policies from 001_initial_schema.sql only checked
-- auth.uid() IS NOT NULL; tighten them to also require project membership.
DROP POLICY IF EXISTS "Authenticated users can create literature references" ON literature_references;
CREATE POLICY "Project members can create literature references" ON literature_references
  FOR INSERT WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can create schema elements" ON lpm_schema_elements;
CREATE POLICY "Project members can create schema elements" ON lpm_schema_elements
  FOR INSERT WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can create data objects" ON lpm_data_objects;
CREATE POLICY "Project members can create data objects" ON lpm_data_objects
  FOR INSERT WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can create evidence links" ON evidence_links;
CREATE POLICY "Project members can create evidence links" ON evidence_links
  FOR INSERT WITH CHECK (is_project_member(project_id));

DROP POLICY IF EXISTS "Authenticated users can create topics" ON discussion_topics;
CREATE POLICY "Project members can create topics" ON discussion_topics
  FOR INSERT WITH CHECK (is_project_member(project_id));

-- ============================================================================
-- Auto-enroll a project's creator as its owner.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON portfolio_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolio_private_nodes_updated_at BEFORE UPDATE ON portfolio_private_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
