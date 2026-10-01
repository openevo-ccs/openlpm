SET search_path = public, extensions;

-- Real ask from Dustin, 2026-10-01: "I still need to be able to access all
-- projects regardless of my membership as admin." Migration 049 already let
-- an admin SEE that any project exists (projects/project_members/
-- project_join_rules got their own explicit admin-bypass SELECT policies),
-- but every actual content table -- Learning Goals (lpm_data_objects),
-- Concepts (lpm_schema_elements), Literature, Discussions, branches, shared
-- Notebooks and more -- gates on one of two shared helper functions,
-- is_project_member()/has_project_role() (migration 004), neither of which
-- knew anything about admin. A non-member admin could see a project card
-- (tagged "Admin view" in the switcher) but opening it hit the same empty
-- RLS wall a stranger would.
--
-- Rather than add a one-off admin-bypass policy to every table that already
-- calls these two functions (easy to miss one, and this schema has grown
-- past 20 content tables), redefine the two functions themselves to also
-- return true for an admin. Postgres resolves a function call inside a
-- policy by name at evaluation time, not by freezing the function body at
-- CREATE POLICY time, so this one change takes effect immediately for
-- every existing policy built on either function -- past and future alike
-- -- with no change to any individual table or policy.
--
-- Deliberately NOT touching portfolio ownership checks (owner_id =
-- auth.uid() on portfolios/portfolio_items/portfolio_private_nodes) --
-- those gate a researcher's own private Notebook content, a different
-- concern from project access. A portfolio already marked 'shared' or
-- 'project' visibility routes through is_project_member() too (migration
-- 004), so admin gets that the same way as everything else; a fully
-- private Notebook stays private even from admin, same as before.
--
-- is_admin() itself is unchanged (migration 049): SECURITY DEFINER, checks
-- users.role = 'admin', currently true only for dustin.eirdosh@eva.mpg.de
-- (migration 050).

CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_admin() OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION has_project_role(p_project_id UUID, p_roles project_member_role[])
RETURNS BOOLEAN AS $$
  SELECT is_admin() OR project_role(p_project_id) = ANY(p_roles);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
