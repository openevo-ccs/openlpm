-- Regional assets: places near a curriculum repository's region that a teacher could use for learning outside the
-- classroom (zoos, museums, research institutes, informal learning places). Dustin Eirdosh, 2026-11-11 (feedback row
-- 5ac200be): "add a regional assets category to the menu of these curriculum repository spaces".
--
-- Same shape and the same access rules as context_items (migration 094): anyone in the space can read, owners and
-- maintainers can add, change and delete. Starts in the German spaces. Each place is filed under the state repository it
-- belongs to (Saxony, Saxony-Anhalt, Thuringia), and the Germany page shows all three together.
--
-- The seven starting entries were drafted by Claude from general knowledge and web addresses that answered when checked
-- on 2026-11-12. No expert has read them yet, so each carries review_status 'claude-draft-unreviewed' and the page says so.

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS regional_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  town TEXT,
  place_code TEXT REFERENCES geo_places(place_code) ON DELETE SET NULL,
  url TEXT,
  description TEXT,
  topics TEXT,
  review_status TEXT NOT NULL DEFAULT 'original',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE regional_assets IS
  'Places in a region that support learning outside the classroom: zoos, museums, research institutes, informal learning places. One row per place, filed under the curriculum repository of the region.';
COMMENT ON COLUMN regional_assets.asset_type IS
  'Open vocabulary, no CHECK constraint, same pattern as context_items.item_type. Values in use: research-institute, zoo, museum, botanical-garden, informal-learning-place, other.';
COMMENT ON COLUMN regional_assets.topics IS
  'Free text: the school topics this place fits, for example "Primate cognition; human evolution".';
COMMENT ON COLUMN regional_assets.review_status IS
  'Open vocabulary. original = written by the person who added it. claude-draft-unreviewed = drafted by Claude, no expert has read it yet. reviewed = an expert has checked it.';

CREATE INDEX IF NOT EXISTS idx_regional_assets_project ON regional_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_regional_assets_place ON regional_assets(place_code);

ALTER TABLE regional_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view regional assets" ON regional_assets;
CREATE POLICY "Project members can view regional assets" ON regional_assets
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Maintainers can create regional assets" ON regional_assets;
CREATE POLICY "Maintainers can create regional assets" ON regional_assets
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can update regional assets" ON regional_assets;
CREATE POLICY "Maintainers can update regional assets" ON regional_assets
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can delete regional assets" ON regional_assets;
CREATE POLICY "Maintainers can delete regional assets" ON regional_assets
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Starting entries. Skipped when the same name is already filed under that repository, so a second run adds nothing.
INSERT INTO regional_assets (project_id, asset_type, name, town, place_code, url, description, topics, review_status)
SELECT p.id, v.asset_type, v.name, v.town, v.place_code, v.url, v.description, v.topics, 'claude-draft-unreviewed'
FROM (VALUES
  ('saxony-curriculum-repository', 'research-institute', 'Max Planck Institute for Evolutionary Anthropology (MPI-EVA)', 'Leipzig', 'DE-SN',
   'https://www.eva.mpg.de/',
   'Research institute in Leipzig that studies how humans and our closest relatives evolved, and how we differ in behaviour, language and culture.',
   'Human evolution; primate behaviour; language and culture'),
  ('saxony-curriculum-repository', 'zoo', 'Zoo Leipzig', 'Leipzig', 'DE-SN',
   'https://www.zoo-leipzig.de/',
   'Zoo in Leipzig with a large great-ape area (Pongoland) next to the primate research centre.',
   'Great apes; animal behaviour; adaptation'),
  ('saxony-curriculum-repository', 'research-institute', 'Wolfgang Köhler Primate Research Center (WKPRC)', 'Leipzig', 'DE-SN',
   'https://www.eva.mpg.de/primate-behavior-and-evolution/index/',
   'Primate research centre run jointly by the MPI-EVA and Zoo Leipzig, where great apes take part in studies of how they think and learn. The link goes to the MPI-EVA primate department.',
   'Primate cognition; comparing apes and humans'),
  ('saxony-anhalt-curriculum-repository', 'museum', 'Landesmuseum für Vorgeschichte (State Museum of Prehistory)', 'Halle (Saale)', 'DE-ST',
   'https://www.landesmuseum-vorgeschichte.de/',
   'State museum of prehistory in Halle, home of the Nebra Sky Disc, with large collections on human history from the Stone Age onwards.',
   'Human history; early humans; tools and culture'),
  ('saxony-anhalt-curriculum-repository', 'zoo', 'Bergzoo Halle (Halle Zoo)', 'Halle (Saale)', 'DE-ST',
   'https://www.zoo-halle.de/',
   'Zoo in Halle, built on a hillside.',
   'Animal behaviour; adaptation; biodiversity'),
  ('thuringia-curriculum-repository', 'museum', 'Ernst-Haeckel-Haus', 'Jena', 'DE-TH',
   'https://www.ehh.uni-jena.de/',
   'University institute and museum in Jena about the life and work of Ernst Haeckel, an early supporter of Darwin''s ideas in Germany, and about the history of the life sciences.',
   'History of evolutionary thinking; Darwin and Haeckel'),
  ('thuringia-curriculum-repository', 'museum', 'Phyletisches Museum Jena', 'Jena', 'DE-TH',
   'https://www.phyletisches-museum.uni-jena.de/',
   'University museum in Jena about the history of life and evolution, founded by Haeckel.',
   'Evolution; common ancestry; history of life')
) AS v(repo_slug, asset_type, name, town, place_code, url, description, topics)
JOIN projects p ON p.slug = v.repo_slug
WHERE NOT EXISTS (SELECT 1 FROM regional_assets r WHERE r.project_id = p.id AND r.name = v.name);
