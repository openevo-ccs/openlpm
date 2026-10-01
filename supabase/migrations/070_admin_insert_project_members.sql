SET search_path = public, extensions;

-- Migration 049 gave the admin page SELECT/UPDATE/DELETE on project_members
-- (is_admin()) so the admin could see and manage every project's membership,
-- not just the ones they personally belong to -- but left out INSERT. That
-- was invisible until the admin page grew a real "Add to project" control
-- (feedback ede6dade, 2026-10-01): adding someone to a project the admin
-- isn't already an owner/maintainer of would fail RLS silently. Same
-- additive pattern as the other three admin policies on this table --
-- Postgres ORs permissive policies together, so the existing
-- owner/maintainer INSERT policy keeps working unchanged for everyone else.
CREATE POLICY "Admins can add any membership" ON project_members
  FOR INSERT WITH CHECK (is_admin());
