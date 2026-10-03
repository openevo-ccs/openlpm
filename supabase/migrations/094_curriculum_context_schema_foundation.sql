-- Schema foundation for geospatial/temporal curriculum context modeling --
-- Wave 1, chunk 1 of lab_manager/docs/design-notes/openlpm-curriculum-
-- context-modeling-2026-10-03.md. Three purely additive pieces:
--
--   1. geo_places -- a small, fill-as-needed place lookup (display name +
--      rough center point for plotting + roll-up parent), seeded only for
--      place codes with real content today.
--   2. event_date/effective_from/effective_until on curriculum_repository_
--      records -- real-world dates at the individual-record level, same
--      pattern migration 044 already used for standards_documents at the
--      whole-document level.
--   3. context_items -- a new, general-purpose table for news articles,
--      public debates, and standing "key issues", linkable to a place
--      and/or a specific piece of content.
--
-- NOT included: the design note's item 4 ("access_tier on curriculum_
-- repository_records") -- checked migration 066 directly before writing
-- this file and found that table's CREATE TABLE statement already has
-- access_tier TEXT NOT NULL DEFAULT 'citation-only' with this exact same
-- four-value CHECK. The design note's own "grounding" section says this
-- column "does not exist on curriculum_repository_records itself", which
-- is simply wrong -- contradicted by the very migration (066) it cites two
-- paragraphs earlier as that table's source. Nothing to add here; flagged
-- to Dustin rather than silently duplicating or loosening an existing
-- NOT NULL column to nullable (which "no existing column changes beyond
-- adding nullable columns" rules out anyway).
--
-- Real place codes below were looked up live against this project's own
-- Supabase instance (service_role read of curriculum_repository_records.
-- jurisdiction, cross-checked against the live project_kind='curriculum-
-- repository' project tree). They were not guessed or copied from the
-- design note's two illustrative examples. Every single ISO-3166-1/-2-style
-- code actually in use today is seeded. The handful of comma-joined values
-- in that same column (e.g. "DE-SN, DE-ST") are curriculum-crosswalk
-- records spanning two or three of the real codes below. Each is a
-- combination rather than a place code of its own, so none of them gets a
-- geo_places row.
SET search_path = public, extensions;

-- ============================================================================
-- 1. geo_places
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_places (
  place_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  parent_place_code TEXT REFERENCES geo_places(place_code) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE geo_places IS
  'One row per place code already used elsewhere in this schema (project_jurisdictions.country_code/region_code, curriculum_repository_records.jurisdiction) -- filled in only for places that actually have content, never pre-populated for the whole world. latitude/longitude are each place''s capital city coordinates, a standard, independently verifiable proxy for a "rough center point" at this scale -- not a computed geographic centroid, and not guessed. parent_place_code lets a region (DE-TH) roll up to its country (DE) on a map.';

ALTER TABLE geo_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view geo places" ON geo_places
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- No insert/update/delete policy: this is a small shared reference table
-- maintained only via migration (same pattern as frameworks/framework_tags
-- rows with project_id IS NULL in migration 018). No app role writes to it
-- directly.

-- National-level places (no parent). Capital-city coordinates.
INSERT INTO geo_places (place_code, display_name, latitude, longitude, parent_place_code) VALUES
  ('DE', 'Germany', 52.5200, 13.4050, NULL),
  ('IN', 'India', 28.6139, 77.2090, NULL),
  ('US', 'United States', 38.9072, -77.0369, NULL)
ON CONFLICT (place_code) DO NOTHING;

-- German states -- all 16 are real jurisdiction values in curriculum_
-- repository_records today (only DE-SN/DE-TH/DE-ST are also broken out
-- into their own nested project rows; the other 13 stay jurisdiction-
-- tagged within the top-level Germany project, confirmed against the live
-- import script's own comment). State-capital coordinates.
INSERT INTO geo_places (place_code, display_name, latitude, longitude, parent_place_code) VALUES
  ('DE-BW', 'Baden-Württemberg', 48.7758, 9.1829, 'DE'),
  ('DE-BY', 'Bavaria', 48.1351, 11.5820, 'DE'),
  ('DE-BE', 'Berlin', 52.5200, 13.4050, 'DE'),
  ('DE-BB', 'Brandenburg', 52.3906, 13.0645, 'DE'),
  ('DE-HB', 'Bremen', 53.0793, 8.8017, 'DE'),
  ('DE-HH', 'Hamburg', 53.5511, 9.9937, 'DE'),
  ('DE-HE', 'Hesse', 50.0782, 8.2398, 'DE'),
  ('DE-MV', 'Mecklenburg-Vorpommern', 53.6355, 11.4012, 'DE'),
  ('DE-NI', 'Lower Saxony', 52.3759, 9.7320, 'DE'),
  ('DE-NW', 'North Rhine-Westphalia', 51.2277, 6.7735, 'DE'),
  ('DE-RP', 'Rhineland-Palatinate', 49.9929, 8.2473, 'DE'),
  ('DE-SL', 'Saarland', 49.2402, 6.9969, 'DE'),
  ('DE-SN', 'Saxony', 51.0504, 13.7373, 'DE'),
  ('DE-ST', 'Saxony-Anhalt', 52.1205, 11.6276, 'DE'),
  ('DE-SH', 'Schleswig-Holstein', 54.3233, 10.1228, 'DE'),
  ('DE-TH', 'Thuringia', 50.9848, 11.0299, 'DE')
ON CONFLICT (place_code) DO NOTHING;

-- Indian states with real curriculum_repository_records rows (and their
-- own nested project under the top-level India Curriculum Repository).
-- State-capital coordinates; Maharashtra's capital is Mumbai.
INSERT INTO geo_places (place_code, display_name, latitude, longitude, parent_place_code) VALUES
  ('IN-KA', 'Karnataka', 12.9716, 77.5946, 'IN'),
  ('IN-KL', 'Kerala', 8.5241, 76.9366, 'IN'),
  ('IN-MH', 'Maharashtra', 19.0760, 72.8777, 'IN')
ON CONFLICT (place_code) DO NOTHING;

-- US state with real curriculum_repository_records rows and its own
-- nested project under the top-level United States Curriculum Repository.
INSERT INTO geo_places (place_code, display_name, latitude, longitude, parent_place_code) VALUES
  ('US-NY', 'New York', 42.6526, -73.7562, 'US')
ON CONFLICT (place_code) DO NOTHING;

-- ============================================================================
-- 2. Real-world dates at the individual-record level (whole-document
--    dates already existed via standards_documents, migration 044).
-- ============================================================================

ALTER TABLE curriculum_repository_records
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_until DATE;

COMMENT ON COLUMN curriculum_repository_records.event_date IS
  'When a point-in-time record (e.g. a policy-timeline-event or a coherence-finding) actually happened in the real world. This is different from when the row was entered into OpenLPM (see created_at for that). A point-in-time record sets this column only; a standing record sets the effective_from/effective_until range below instead. Nullable: existing rows predate this field (added 2026-10-03) and should be treated as unknown -- do not assume they simply have no real date.';

COMMENT ON COLUMN curriculum_repository_records.effective_from IS
  'When a standing record (e.g. an institutional-mandate in force for a period) actually took effect in the real world. Same pattern as standards_documents.effective_from (migration 044), at the individual-record level instead of the whole-document level. Nullable.';

COMMENT ON COLUMN curriculum_repository_records.effective_until IS
  'When a standing record stopped being in force, if known. Nullable -- leave null for a record still in force, and for any point-in-time record (which uses event_date instead).';

-- ============================================================================
-- 3. context_items -- news articles, public debates, standing key issues.
-- ============================================================================

CREATE TABLE IF NOT EXISTS context_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  source_outlet TEXT,
  published_at DATE,
  place_code TEXT REFERENCES geo_places(place_code) ON DELETE SET NULL,
  data_object_id UUID REFERENCES lpm_data_objects(id) ON DELETE SET NULL,
  repository_record_id UUID REFERENCES curriculum_repository_records(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (num_nonnulls(data_object_id, repository_record_id) <= 1)
);

COMMENT ON TABLE context_items IS
  'General-purpose, deliberately NOT limited to curriculum-repository-kind projects -- any project researching how a topic gets taught somewhere can attach a relevant news story, public debate, or standing key issue, optionally scoped to a specific place and/or a specific piece of its own content (at most one of data_object_id/repository_record_id, same "exactly one side or neither" shape portfolio_links uses for its own optional dual-target links).';

COMMENT ON COLUMN context_items.item_type IS
  'Open vocabulary, same pattern as curriculum_repository_links.relation_type -- no CHECK constraint, so a new kind never needs a migration. Seed values in use: news-article, public-debate, key-issue.';

CREATE INDEX IF NOT EXISTS idx_context_items_project ON context_items(project_id);
CREATE INDEX IF NOT EXISTS idx_context_items_place ON context_items(place_code);
CREATE INDEX IF NOT EXISTS idx_context_items_data_object ON context_items(data_object_id);
CREATE INDEX IF NOT EXISTS idx_context_items_repository_record ON context_items(repository_record_id);

ALTER TABLE context_items ENABLE ROW LEVEL SECURITY;

-- Exact policy pattern curriculum_repository_records already uses (066):
-- readable by any project member, manageable by owners/maintainers only.
DROP POLICY IF EXISTS "Project members can view context items" ON context_items;
CREATE POLICY "Project members can view context items" ON context_items
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Maintainers can create context items" ON context_items;
CREATE POLICY "Maintainers can create context items" ON context_items
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can update context items" ON context_items;
CREATE POLICY "Maintainers can update context items" ON context_items
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
DROP POLICY IF EXISTS "Maintainers can delete context items" ON context_items;
CREATE POLICY "Maintainers can delete context items" ON context_items
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES
-- for anon/authenticated. No service_role grant needed -- unlike migration
-- 066's import script, nothing writes to these tables outside the app.
