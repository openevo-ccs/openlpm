SET search_path = public, extensions;

-- Removes the 7 "teilkonzepte" labels from the original EvoMentor_DE
-- import (data/basiskonzepte.json, 2 coarse labels per Basiskonzept, 12
-- total) that don't correspond to any node in the richer vocabulary
-- migration 059 imports, and have zero real tag usage -- confirmed
-- directly against the live data before writing this (each has 0
-- children and nothing in any real Lernziel's basiskonzeptbezug[]
-- references them). Dustin's own call, 2026-10-01: delete outright rather
-- than mark deprecated, since nothing uses them and a researcher browsing
-- the concept tree shouldn't have to wonder what they are.
--
-- The other 5 of the original 12 ("Steuerung", "Regelung",
-- "Stoffumwandlung", "Energieumwandlung", "Zelldifferenzierung und
-- Embryonalentwicklung") are NOT touched here -- migration 059 already
-- found and enriched those as real Ebene-1 nodes with real children.
--
-- Must run AFTER 059 (059 doesn't touch these 7 at all, so order between
-- 059/060/061 doesn't matter for correctness, but keeping the real
-- numbering is simplest). Scoped by (label, parent root label) exactly
-- like every other harvest migration in this file set, never by a
-- hardcoded id -- a row that doesn't match this exact combination is left
-- alone.

DO $$
DECLARE
  v_project_id UUID;
  v_deleted_count INT := 0;
  v_this_delete_count INT;
  v_root_id UUID;
  r RECORD;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia project not found -- skipping';
    RETURN;
  END IF;

  FOR r IN SELECT * FROM (VALUES
    ('Struktur und Funktion', 'Struktur'),
    ('Struktur und Funktion', 'Funktion'),
    ('Information und Kommunikation', 'Information'),
    ('Information und Kommunikation', 'Kommunikation'),
    ('Individuelle Entwicklung', 'Hormonelle Reifung und erworbene Anpassungsfähigkeit'),
    ('Evolutive Entwicklung', 'Variation, Angepasstheit und Selektion'),
    ('Evolutive Entwicklung', 'Stammesgeschichte und vergleichende Systeme')
  ) AS t(root_label, dead_label) LOOP
    SELECT id INTO v_root_id FROM lpm_schema_elements WHERE project_id = v_project_id AND parent_id IS NULL AND label = r.root_label;
    IF v_root_id IS NULL THEN CONTINUE; END IF;

    -- Belt-and-braces: only ever deletes a row that genuinely has zero
    -- children of its own (true for all 7 at the time this was written --
    -- re-checked here rather than trusted blindly, in case live data
    -- changed between investigation and this migration actually running).
    DELETE FROM lpm_schema_elements
    WHERE project_id = v_project_id AND parent_id = v_root_id AND label = r.dead_label
      AND NOT EXISTS (SELECT 1 FROM lpm_schema_elements child WHERE child.parent_id = lpm_schema_elements.id);
    GET DIAGNOSTICS v_this_delete_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_this_delete_count;
  END LOOP;

  RAISE NOTICE 'Removed % dead teilkonzepte row(s) (expected 7)', v_deleted_count;
END $$;
