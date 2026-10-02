SET search_path = public, extensions;

-- Real feedback 4370910f (Dustin Eirdosh, 2026-10-02): "all projects should
-- be automatically assigned a color which can be changed by project
-- owners." Migration 065 + new-project-wizard.tsx (commit 77100cb,
-- 2026-10-01) already built "auto-assign on create, editable afterward" --
-- but only for the one interactive wizard flow. Live-checked via REST
-- 2026-10-02: 17 of 19 real projects still had color IS NULL, including
-- "united-states-curriculum-repository", created by migration 081's own
-- raw SQL INSERT less than an hour before this feedback was filed. Any
-- project created outside the wizard -- a migration's INSERT, a seed
-- script (scripts/import_curriculum_repository.py), the batch imports
-- behind the identical-timestamp eva-lpm/EvoMentor rows -- never got a
-- color, and nothing backfilled the ones that existed before the wizard
-- fix landed either.
--
-- Moving the assignment into the database itself (a BEFORE INSERT
-- trigger) is what actually makes "ALL projects" true regardless of how a
-- project is created, now or in the future -- the frontend keeps owning
-- the one thing it should (letting an owner change the color afterward,
-- settings-page.tsx's ProjectColorSection), not the default assignment,
-- which can no longer be silently skipped by a creation path nobody
-- thought to wire up by hand. Same 8-key palette and "first color none of
-- this project's siblings is using yet, else round-robin" logic as
-- new-project-wizard.tsx's own autoColor (src/lib/project-colors.ts),
-- reimplemented once here so both the trigger and the one-time backfill
-- below share it.

CREATE OR REPLACE FUNCTION pick_project_color(p_parent_id UUID)
RETURNS TEXT AS $$
DECLARE
  palette TEXT[] := ARRAY['teal','blue','violet','rose','orange','amber','green','slate'];
  used TEXT[];
  sibling_count INT;
  chosen TEXT;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT color) FILTER (WHERE color IS NOT NULL), ARRAY[]::TEXT[]), COUNT(*)
    INTO used, sibling_count
    FROM projects
    WHERE parent_project_id IS NOT DISTINCT FROM p_parent_id;

  SELECT c INTO chosen FROM unnest(palette) AS c
    WHERE NOT (c = ANY(used))
    ORDER BY array_position(palette, c)
    LIMIT 1;

  IF chosen IS NULL THEN
    chosen := palette[(sibling_count % array_length(palette, 1)) + 1];
  END IF;

  RETURN chosen;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION assign_default_project_color()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.color IS NULL THEN
    NEW.color := pick_project_color(NEW.parent_project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_project_color_default ON projects;
CREATE TRIGGER on_project_color_default
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION assign_default_project_color();

-- One-time backfill for every project that already exists without a
-- color, oldest-first within each parent group so the result matches what
-- the wizard would have produced had it run in real creation order.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, parent_project_id FROM projects
    WHERE color IS NULL
    ORDER BY parent_project_id NULLS FIRST, created_at ASC
  LOOP
    UPDATE projects SET color = pick_project_color(r.parent_project_id) WHERE id = r.id;
  END LOOP;
END $$;
