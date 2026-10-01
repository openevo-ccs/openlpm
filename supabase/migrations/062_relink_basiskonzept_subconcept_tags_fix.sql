SET search_path = public, extensions;

-- Fixes a real bug in migration 060, found by checking its own result
-- after Dustin ran it: only 1/1337 real tags actually got re-linked,
-- instead of the 1338/1338 the pre-write check predicted. Root cause,
-- confirmed directly against the live data: `basiskonzeptbezug[].
-- basiskonzept_id` is a UUID for only ONE real entry (the single Lernziel
-- migration 028 itself inserted) -- for all 303 original Lernziele, it's
-- one of 6 known string ids ("bk_evolutive_entwicklung", etc.), the same
-- convention `buildBkLabelMap` in src/lib/supabase/basiskonzepte.ts
-- already resolves on the frontend via token-matching. Migration 060's
-- SQL only ever attempted a UUID cast, so its root-scoping silently
-- produced NULL for 303/305 Lernziele and nothing got re-linked for them.
--
-- Same safety discipline as 060: only ever replaces a resolvable
-- taxonomyElementId, never deletes or blanks a tag, every other field
-- untouched. Safe to run again even though 060 already ran once (it was a
-- real no-op for almost everything, not a partial/wrong write -- nothing
-- to undo).

DO $$
DECLARE
  v_project_id UUID;
  obj RECORD;
  bk_entry JSONB;
  new_bk_entries JSONB;
  tag JSONB;
  new_unterkonzepte JSONB;
  new_evolutionskonzepte JSONB;
  v_bk_id TEXT;
  v_root_label TEXT;
  v_resolved_id UUID;
  v_objects_touched INT := 0;
  v_tags_resolved INT := 0;
  v_tags_total INT := 0;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia project not found -- skipping re-link';
    RETURN;
  END IF;

  FOR obj IN SELECT id, content FROM lpm_data_objects WHERE project_id = v_project_id LOOP
    new_bk_entries := '[]'::jsonb;

    FOR bk_entry IN SELECT * FROM jsonb_array_elements(COALESCE(obj.content->'basiskonzeptbezug', '[]'::jsonb)) LOOP
      v_bk_id := bk_entry->>'basiskonzept_id';
      v_root_label := CASE v_bk_id
        WHEN 'bk_struktur_funktion' THEN 'Struktur und Funktion'
        WHEN 'bk_stoff_energie_umwandlung' THEN 'Stoff- und Energieumwandlung'
        WHEN 'bk_information_kommunikation' THEN 'Information und Kommunikation'
        WHEN 'bk_steuerung_regelung' THEN 'Steuerung und Regelung'
        WHEN 'bk_individuelle_entwicklung' THEN 'Individuelle Entwicklung'
        WHEN 'bk_evolutive_entwicklung' THEN 'Evolutive Entwicklung'
        ELSE NULL
      END;
      -- Real UUID case (the one Lernziel migration 028 itself inserted) --
      -- falls through to a direct root lookup when the string-id map above
      -- doesn't match anything and the value genuinely looks like a UUID.
      IF v_root_label IS NULL AND v_bk_id IS NOT NULL AND v_bk_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT label INTO v_root_label FROM lpm_schema_elements
        WHERE id = v_bk_id::uuid AND project_id = v_project_id AND parent_id IS NULL;
      END IF;

      new_unterkonzepte := '[]'::jsonb;
      FOR tag IN SELECT * FROM jsonb_array_elements(COALESCE(bk_entry->'relevante_unterkonzepte_taxonomie', '[]'::jsonb)) LOOP
        v_tags_total := v_tags_total + 1;
        v_resolved_id := NULL;
        IF v_root_label IS NOT NULL AND (tag ? 'value') THEN
          SELECT e.id INTO v_resolved_id
          FROM lpm_schema_elements e
          JOIN lpm_schema_elements p1 ON p1.id = e.parent_id
          WHERE e.project_id = v_project_id AND e.label = (tag->>'value')
            AND (
              (p1.parent_id IS NULL AND p1.label = v_root_label)
              OR EXISTS (SELECT 1 FROM lpm_schema_elements root WHERE root.id = p1.parent_id AND root.parent_id IS NULL AND root.label = v_root_label)
            )
          LIMIT 1;
        END IF;
        IF v_resolved_id IS NOT NULL THEN
          new_unterkonzepte := new_unterkonzepte || jsonb_build_array(jsonb_set(tag, '{taxonomyElementId}', to_jsonb(v_resolved_id::text)));
          v_tags_resolved := v_tags_resolved + 1;
        ELSE
          new_unterkonzepte := new_unterkonzepte || jsonb_build_array(tag);
        END IF;
      END LOOP;

      new_evolutionskonzepte := '[]'::jsonb;
      FOR tag IN SELECT * FROM jsonb_array_elements(COALESCE(bk_entry->'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb)) LOOP
        v_tags_total := v_tags_total + 1;
        v_resolved_id := NULL;
        IF v_root_label IS NOT NULL AND (tag ? 'value') THEN
          SELECT e.id INTO v_resolved_id
          FROM lpm_schema_elements e
          JOIN lpm_schema_elements p1 ON p1.id = e.parent_id
          WHERE e.project_id = v_project_id AND e.label = (tag->>'value')
            AND (
              (p1.parent_id IS NULL AND p1.label = v_root_label)
              OR EXISTS (SELECT 1 FROM lpm_schema_elements root WHERE root.id = p1.parent_id AND root.parent_id IS NULL AND root.label = v_root_label)
            )
          LIMIT 1;
        END IF;
        IF v_resolved_id IS NOT NULL THEN
          new_evolutionskonzepte := new_evolutionskonzepte || jsonb_build_array(jsonb_set(tag, '{taxonomyElementId}', to_jsonb(v_resolved_id::text)));
          v_tags_resolved := v_tags_resolved + 1;
        ELSE
          new_evolutionskonzepte := new_evolutionskonzepte || jsonb_build_array(tag);
        END IF;
      END LOOP;

      bk_entry := jsonb_set(bk_entry, '{relevante_unterkonzepte_taxonomie}', new_unterkonzepte);
      bk_entry := jsonb_set(bk_entry, '{relevante_evolutionskonzepte_taxonomie}', new_evolutionskonzepte);
      new_bk_entries := new_bk_entries || jsonb_build_array(bk_entry);
    END LOOP;

    IF obj.content ? 'basiskonzeptbezug' THEN
      UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug}', new_bk_entries) WHERE id = obj.id;
      v_objects_touched := v_objects_touched + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Re-link fix complete: % Lernziele processed, %/% real sub-concept tags now resolved to a real taxonomy row', v_objects_touched, v_tags_resolved, v_tags_total;
END $$;
