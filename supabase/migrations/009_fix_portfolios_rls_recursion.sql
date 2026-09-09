-- Fixes "infinite recursion detected in policy for relation portfolios",
-- a live error surfaced 2026-09-09 while verifying the GitHub Pages
-- deployment against the real database. Migration 004's "Members can view
-- shared or project-visible portfolios" policy on `portfolios` subqueries
-- `portfolio_shares`; `portfolio_shares`'s own "Portfolio owners manage
-- shares" policy subqueries `portfolios` right back -- each table's RLS
-- policy re-triggers the other's, which Postgres detects as recursion
-- rather than evaluating.
--
-- Resolution: the same pattern migration 004 already used to avoid this for
-- project_members (`is_project_member()`) -- move each cross-table
-- existence check into a SECURITY DEFINER function, which (as the tables'
-- owner) reads the other table directly instead of re-entering its RLS.

CREATE OR REPLACE FUNCTION is_portfolio_owner(p_portfolio_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM portfolios
    WHERE id = p_portfolio_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION has_portfolio_share(p_portfolio_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM portfolio_shares
    WHERE portfolio_id = p_portfolio_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY "Members can view shared or project-visible portfolios" ON portfolios;
CREATE POLICY "Members can view shared or project-visible portfolios" ON portfolios
  FOR SELECT USING (
    is_project_member(project_id)
    AND (
      visibility IN ('shared', 'project')
      OR has_portfolio_share(id)
    )
  );

DROP POLICY "Portfolio owners manage shares" ON portfolio_shares;
CREATE POLICY "Portfolio owners manage shares" ON portfolio_shares
  FOR ALL USING (is_portfolio_owner(portfolio_id));
