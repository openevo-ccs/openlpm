-- Resolves a real architectural gap Dustin flagged directly: "Branch" was
-- doing two unrelated jobs at once -- how official/vetted content is
-- (sandbox vs. permanent) and what real-world thing it represents (which
-- region, language, or theme). Concrete proof this was already broken: two
-- structurally identical efforts (Thuringia and Sachsen, both "a German
-- Land's real biology curriculum") were modeled two incompatible ways --
-- one as a branch of EvoMentor, one as its own top-level project -- purely
-- from how each happened to arrive, not from any real distinction.
--
-- Resolution (confirmed with Dustin directly): projects can nest under a
-- parent project ("EvoMentor-Thuringia is a sub-project of EvoMentor," his
-- own words) for organization -- never for forced governance or vocabulary
-- coupling. Mirrors the real, live precedent already proven in ConceptBase's
-- own RFC-0010 sandbox-tier forking (forkedFrom is provenance-only, "does
-- not imply the fork is a subset... or in any way subordinate"; nothing is
-- auto-inherited, every entity declares its own vocabulary independently) --
-- confirmed via direct research before building this, not assumed.
-- "Branch" keeps its narrower, real job: a lightweight, same-project,
-- same-vocabulary experimental fork, not a stand-in for a whole other
-- region or language anymore.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS focus_type TEXT NOT NULL DEFAULT 'general'
  CHECK (focus_type IN ('regional', 'thematic', 'general'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS region_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS theme_tags TEXT[] NOT NULL DEFAULT '{}';
-- Real structured language tagging -- proposals/0005-multi-language-content.md
-- designed this field but it was never actually migrated in; implementing it
-- now since it's directly load-bearing for "sharing shouldn't be assumed
-- across languages."
ALTER TABLE projects ADD COLUMN IF NOT EXISTS working_languages TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);

-- A project promoted or newly created had no guaranteed trunk branch --
-- branches/:branchSlug routes (Explore/Coherence/Review) need one to exist.
-- Extends handle_new_project (which already auto-enrolls the creator as
-- owner) rather than adding a second trigger.
CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  INSERT INTO branches (project_id, slug, label, is_trunk, status, created_by)
  VALUES (NEW.id, 'main', 'Trunk', TRUE, 'active', NEW.created_by)
  ON CONFLICT (project_id, slug) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
