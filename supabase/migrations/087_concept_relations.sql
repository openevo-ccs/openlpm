SET search_path = public, extensions;

-- Real feedback e7333af2 (Susan Hanisch, 2026-10-02): "explore links between
-- any concepts across any levels, particularly across the Basiskonzepte...
-- those links will probably require named and directed edges (i.e. what is
-- the link)". lpm_connections (010_curriculum_connections.sql) already does
-- exactly this shape -- a named, directed edge with an open relation_type
-- vocabulary -- but only between two lpm_data_objects (Lernziele). This
-- mirrors the same shape for two lpm_schema_elements (Basiskonzepte and
-- their real sub-concepts, at any depth), so a researcher can assert e.g.
-- "natürliche Selektion" --[ist ein Mechanismus von]--> "balancierende
-- Selektion" even when that's not already implied by the parent_id tree, or
-- a cross-Basiskonzept link the schema's own single-parent hierarchy can't
-- represent at all (e.g. "genetischer Code" under Information und
-- Kommunikation --[wird realisiert durch]--> "Proteinbiosynthese" under a
-- different Basiskonzept).
--
-- Deliberately simpler than lpm_connections: no kind/status review workflow
-- -- a project member who can already edit this project's own curriculum
-- content can assert a relation directly, same trust level as everything
-- else a member can already do on this schema (rename/retag a concept,
-- etc.). Add a review workflow later if real use ever needs one; building
-- it now with no real need would just be unused machinery.
CREATE TABLE IF NOT EXISTS lpm_concept_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_element_id UUID NOT NULL REFERENCES lpm_schema_elements(id) ON DELETE CASCADE,
  to_element_id UUID NOT NULL REFERENCES lpm_schema_elements(id) ON DELETE CASCADE,
  -- Open vocabulary, same reasoning as lpm_connections.relation_type -- a
  -- generic platform shouldn't hard-code one project's relation vocabulary
  -- at the schema level.
  relation_type TEXT NOT NULL DEFAULT 'relates_to',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (from_element_id <> to_element_id),
  UNIQUE (from_element_id, to_element_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_lpm_concept_relations_project ON lpm_concept_relations(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_concept_relations_from ON lpm_concept_relations(from_element_id);
CREATE INDEX IF NOT EXISTS idx_lpm_concept_relations_to ON lpm_concept_relations(to_element_id);

ALTER TABLE lpm_concept_relations ENABLE ROW LEVEL SECURITY;

-- Same is_project_member() convention as lpm_connections and every other
-- real content table.
CREATE POLICY "Project members can view concept relations" ON lpm_concept_relations
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can create concept relations" ON lpm_concept_relations
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete concept relations" ON lpm_concept_relations
  FOR DELETE USING (is_project_member(project_id));

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
