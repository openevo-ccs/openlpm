-- The coherence-audit tool for curriculum designers/researchers: a
-- systematic pair-matrix check (not spot-checking obvious pairs), reusing
-- the discipline eva-graph-66 proved out on mpi-eva-graph -- measure before
-- touching anything, cite a real bridge or explicitly record "no real
-- connection found," never force a link just to make the matrix look
-- complete, validate the end state with a live count. Platform-generic:
-- "axis" and "scope" are open, not hard-coded to grade bands or biology.

-- ============================================================================
-- Generic content <-> schema-concept tagging. Without this, "what schema
-- concepts does this object touch" only exists inside each project's own
-- opaque `content` JSONB (EvoMentor's basiskonzepte_primaer/sekundaer
-- fields) -- fine for cosmetic display, not acceptable for the core
-- candidate-mining mechanism, which must never need to parse one project's
-- own field names to work for a different project's content.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lpm_object_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  schema_element_id UUID NOT NULL REFERENCES lpm_schema_elements(id) ON DELETE CASCADE,
  -- Open vocabulary (e.g. EvoMentor's own 'primary'/'secondary' distinction)
  -- -- not a DB enum, since a different project's tagging convention may differ.
  role TEXT NOT NULL DEFAULT 'relates_to',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (data_object_id, schema_element_id)
);

CREATE INDEX IF NOT EXISTS idx_lpm_object_tags_object ON lpm_object_tags(data_object_id);
CREATE INDEX IF NOT EXISTS idx_lpm_object_tags_element ON lpm_object_tags(schema_element_id);
CREATE INDEX IF NOT EXISTS idx_lpm_object_tags_project ON lpm_object_tags(project_id);

-- ============================================================================
-- Coherence reviews: the record that makes "checked, no real connection
-- exists" a first-class, equally-valuable outcome to an actual new
-- connection -- so a genuinely checked gap doesn't keep getting re-flagged
-- as open on every future pass. `scope_a`/`scope_b` are small JSON
-- descriptors (e.g. {"grade_band":"8"} or {"project_id":"...","branch_id":
-- "..."}) rather than fixed columns, since the pairing shape genuinely
-- differs per axis (grade-band pairs, subject-area pairs, cross-project
-- pairs) -- the same open-shape call already made for portfolio_items'
-- target_type/target_id and commons_items' content, generalized here to a
-- pair of scope descriptors instead of one target reference.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lpm_coherence_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  axis TEXT NOT NULL,
  scope_a JSONB NOT NULL,
  scope_b JSONB NOT NULL,
  note TEXT NOT NULL CHECK (length(note) > 0),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, branch_id, axis, scope_a, scope_b)
);

CREATE INDEX IF NOT EXISTS idx_lpm_coherence_reviews_project ON lpm_coherence_reviews(project_id, branch_id, axis);

-- ============================================================================
-- RLS -- same is_project_member() convention as every other content table.
-- ============================================================================

ALTER TABLE lpm_object_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpm_coherence_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view object tags" ON lpm_object_tags
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can manage object tags" ON lpm_object_tags
  FOR ALL USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can view coherence reviews" ON lpm_coherence_reviews
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create coherence reviews" ON lpm_coherence_reviews
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete their coherence reviews" ON lpm_coherence_reviews
  FOR DELETE USING (is_project_member(project_id));

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
