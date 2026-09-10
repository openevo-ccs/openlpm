-- The "how does this topic connect, and why" browsing experience -- the
-- teacher-facing feature this migration exists for. Deliberately
-- platform-generic (any project's data objects, any project's own schema
-- concept as the connecting "why"), because OpenLPM itself isn't "the
-- evolution app" -- EvoMentor's evolution-through-Basiskonzepte content is
-- just the first real project to populate these tables. See
-- EvoMentor_DE/docs/basiskonzepte-kohaerenz-strategie.md for the
-- already-validated methodology this generalizes, and
-- EvoMentor_DE's own README for why its shipped UI for the same idea
-- ("Kohärenzfäden") got hidden again -- the data/method were sound, the
-- presentation wasn't (buried nav depth, dense jargon-heavy prose, no
-- asserted/suggested distinction). This schema keeps that distinction
-- explicit at the data layer so the UI can never blur it by accident.

-- ============================================================================
-- Connections: simple pairwise edges between two data objects.
-- ============================================================================

-- 'asserted': the source curriculum/standard genuinely requires this order
-- (e.g. a real prerequisite/enabling relationship already present in the
-- authoritative source material). 'suggested': a proposed, pedagogically
-- useful connection that the source material does not itself require --
-- never to be presented to a teacher as if it were a curriculum mandate.
CREATE TYPE lpm_connection_kind AS ENUM ('asserted', 'suggested');

CREATE TABLE IF NOT EXISTS lpm_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  from_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  to_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  -- Open vocabulary, not a DB enum -- a generic platform shouldn't hard-code
  -- one project's relation vocabulary at the schema level (mirrors how
  -- framework_tags/framework vocabularies are project data, not platform
  -- schema). EvoMentor's own real data uses 'requires'/'enables'; a
  -- different project can use whatever fits its own source material.
  relation_type TEXT NOT NULL DEFAULT 'relates_to',
  kind lpm_connection_kind NOT NULL,
  rationale TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (from_object_id <> to_object_id),
  UNIQUE (from_object_id, to_object_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_lpm_connections_project ON lpm_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_connections_from ON lpm_connections(from_object_id);
CREATE INDEX IF NOT EXISTS idx_lpm_connections_to ON lpm_connections(to_object_id);

-- ============================================================================
-- Threads: a named, curated, multi-station narrative explaining WHY several
-- data objects connect through one shared idea (a schema element the project
-- has already defined -- for EvoMentor that's a Basiskonzept, for a
-- different project it would be whatever cross-cutting concept that
-- project's own schema names). Always conceptually "suggested" -- a thread
-- is a didactic proposal, never a claim that the source curriculum itself
-- sequences things this way (that's what lpm_connections.kind='asserted' is
-- for, and a thread's own stations may also happen to trace a real asserted
-- chain -- the two are recorded separately so the UI never conflates them).
-- ============================================================================

CREATE TABLE IF NOT EXISTS lpm_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  title TEXT NOT NULL,
  -- 'vertical': spans multiple grade bands (a spiral-curriculum revisit).
  -- 'horizontal': within one grade band, crossing schema concepts.
  -- 'vertical_horizontal': does both.
  thread_type TEXT NOT NULL CHECK (thread_type IN ('vertical', 'horizontal', 'vertical_horizontal')),
  -- The schema element that is the actual connecting idea -- e.g. EvoMentor's
  -- "Evolutive Entwicklung" Basiskonzept. Nullable only because a thread
  -- authored before its hub concept exists in the schema shouldn't be
  -- blocked; every real thread should set this.
  explained_by_element_id UUID REFERENCES lpm_schema_elements(id) ON DELETE SET NULL,
  connecting_idea TEXT NOT NULL,
  narrative TEXT NOT NULL,
  teaching_prompt TEXT,
  evidence_note TEXT,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS lpm_thread_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES lpm_threads(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  role_note TEXT NOT NULL,
  via_element_id UUID REFERENCES lpm_schema_elements(id) ON DELETE SET NULL,
  relation_to_next TEXT,
  UNIQUE (thread_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_lpm_threads_project ON lpm_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_thread_stations_thread ON lpm_thread_stations(thread_id);
CREATE INDEX IF NOT EXISTS idx_lpm_thread_stations_object ON lpm_thread_stations(data_object_id);

-- ============================================================================
-- RLS -- same is_project_member() convention as every other content table.
-- ============================================================================

ALTER TABLE lpm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpm_thread_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view connections" ON lpm_connections
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create connections" ON lpm_connections
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update connections" ON lpm_connections
  FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY "Project members can delete connections" ON lpm_connections
  FOR DELETE USING (is_project_member(project_id));

CREATE POLICY "Project members can view threads" ON lpm_threads
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create threads" ON lpm_threads
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update threads" ON lpm_threads
  FOR UPDATE USING (is_project_member(project_id));
CREATE POLICY "Project members can delete threads" ON lpm_threads
  FOR DELETE USING (is_project_member(project_id));

CREATE POLICY "Project members can view thread stations" ON lpm_thread_stations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lpm_threads t WHERE t.id = thread_id AND is_project_member(t.project_id))
  );
CREATE POLICY "Project members can manage thread stations" ON lpm_thread_stations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lpm_threads t WHERE t.id = thread_id AND is_project_member(t.project_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lpm_threads t WHERE t.id = thread_id AND is_project_member(t.project_id))
  );

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
