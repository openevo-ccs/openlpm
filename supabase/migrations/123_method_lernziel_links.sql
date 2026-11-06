-- Step 3 of the method<->Lernziel linking system (see migration 121's
-- header): the actual method<->Lernziel relation, as a real queryable
-- table instead of only living inside each Lernziel's own
-- content.didaktische_strategien.top3_methoden[] array (which caps at 3
-- methods per Lernziel and has no place to record a link that's merely
-- suggested and not yet reviewed).
--
-- Same project-scoped, method_key-as-plain-TEXT convention as
-- method_basiskonzept_links (migration 079) -- a method isn't its own DB
-- row, so method_key stands in for a data_object_id there too.
--
-- status distinguishes a link that's already real curriculum content
-- (confirmed, source='existing_content' -- backfilled below from today's
-- top3_methoden[] data) from one an LLM proposed
-- (source='llm_suggested', scripts/suggest_method_lernziel_links.mjs) and
-- nobody has reviewed yet. A suggested link is never shown to a student
-- and never counted as "this method applies here" anywhere in the app
-- until a project member flips it to 'confirmed' -- the same
-- "deliberately not guessed at in a migration, this is Susan's own
-- subject-matter judgment to make" principle migrations 078/079/089 already
-- established for method<->Lernziel/Basiskonzept tagging generally.

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS method_lernziel_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  method_key TEXT NOT NULL,
  lernziel_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('confirmed', 'suggested', 'rejected')),
  source TEXT NOT NULL CHECK (source IN ('existing_content', 'llm_suggested', 'manual')),
  -- Why this link was proposed/confirmed -- the existing content's own
  -- per-Lernziel beschreibung text for a backfilled row, or the model's
  -- own stated reasoning for an llm_suggested row. Never blank for a
  -- suggested row: a link with no stated reason is exactly what a
  -- reviewer can't evaluate quickly.
  rationale TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, method_key, lernziel_id)
);

CREATE INDEX IF NOT EXISTS idx_method_lz_links_project ON method_lernziel_links(project_id);
CREATE INDEX IF NOT EXISTS idx_method_lz_links_lernziel ON method_lernziel_links(lernziel_id);
CREATE INDEX IF NOT EXISTS idx_method_lz_links_method ON method_lernziel_links(project_id, method_key);
CREATE INDEX IF NOT EXISTS idx_method_lz_links_status ON method_lernziel_links(status);

ALTER TABLE method_lernziel_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view method-Lernziel links" ON method_lernziel_links
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can manage method-Lernziel links" ON method_lernziel_links
  FOR ALL USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

-- ============================================================================
-- Backfill: today's real top3_methoden[] content, as confirmed links
-- ============================================================================
-- This is real, already-published curriculum content (present on ~302 of
-- 306 Thuringia Lernziele per student-lernziele-page.tsx's own comment),
-- not a guess -- it's exactly the same data the student-facing page
-- already reads from content.didaktische_strategien.top3_methoden[],
-- just copied into a queryable relation so the new researcher Methods
-- panel (Learning Goals -> Methods tab) can show "which Lernziele does
-- this method already apply to" without re-parsing JSONB content client-side.
DO $$
DECLARE
  v_project_id UUID;
  v_lernziel RECORD;
  v_entry JSONB;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'No evomentor-thuringia project found -- skipping top3_methoden backfill (fine on a fresh/test database).';
    RETURN;
  END IF;

  FOR v_lernziel IN
    SELECT id, content FROM lpm_data_objects
    WHERE project_id = v_project_id AND object_type = 'performance_indicator'
  LOOP
    FOR v_entry IN
      SELECT jsonb_array_elements(COALESCE(v_lernziel.content->'didaktische_strategien'->'top3_methoden', '[]'::jsonb))
    LOOP
      CONTINUE WHEN v_entry->>'methode' IS NULL OR trim(v_entry->>'methode') = '';
      INSERT INTO method_lernziel_links (project_id, method_key, lernziel_id, status, source, rationale)
      VALUES (
        v_project_id,
        v_entry->>'methode',
        v_lernziel.id,
        'confirmed',
        'existing_content',
        v_entry->>'beschreibung'
      )
      ON CONFLICT (project_id, method_key, lernziel_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
