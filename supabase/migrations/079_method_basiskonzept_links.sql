SET search_path = public, extensions;

-- Real feedback 459423b6 (Susan Hanisch, 2026-10-02): link each teaching
-- method to the specific Basiskonzepte/Unterkonzepte it actually
-- strengthens, and flag when a method is a "Konzeptanker" -- her own
-- words, "a way to generally introduce" that concept. Structure only,
-- built per Dustin's own call the same day (design session): the real
-- mapping is Susan's subject-matter judgment to fill in through this UI,
-- not something to guess at in a migration. Using this same tool to link
-- "Konzeptuelles Lernen" to the Basiskonzepte it's meant to deepen is also
-- the intended path to resolving feedback e09987a0 (how it's distinct
-- from "Analogien und Vergleiche") -- not a separate build.
--
-- Scoped the same way lpm_object_tags (migration 011) scopes content<->
-- concept tags: method_key is prompt-builder.tsx's plain string identity
-- for a method (same convention as user_favorite_methods, migration 077),
-- standing in for a data_object_id since a method isn't its own DB row.
CREATE TABLE IF NOT EXISTS method_basiskonzept_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  method_key TEXT NOT NULL,
  basiskonzept_id UUID NOT NULL REFERENCES lpm_schema_elements(id) ON DELETE CASCADE,
  is_konzeptanker BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, method_key, basiskonzept_id)
);

CREATE INDEX IF NOT EXISTS idx_method_bk_links_project ON method_basiskonzept_links(project_id);
CREATE INDEX IF NOT EXISTS idx_method_bk_links_concept ON method_basiskonzept_links(basiskonzept_id);

ALTER TABLE method_basiskonzept_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view method links" ON method_basiskonzept_links
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can manage method links" ON method_basiskonzept_links
  FOR ALL USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
