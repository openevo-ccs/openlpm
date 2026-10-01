SET search_path = public, extensions;

-- Fixes the real, now-confirmed bug (see migration 059's own comment, and
-- lab_manager/docs/design-notes/openlpm-basiskonzepte-subconcept-taxonomy-
-- broken-links-2026-10-01.md): every real Lernziel in evomentor-thuringia
-- was tagged, at authoring time, against specific Basiskonzept sub-concepts
-- -- each tag's own `value` text survived intact, but the `taxonomyElementId`
-- meant to link it to the real lpm_schema_elements row was stale for 1337
-- of 1338 real tag instances (checked directly against the live data before
-- writing this). Migration 059 (must run before this one) makes sure every
-- one of those labels now exists as a real row; this migration re-resolves
-- each tag's id by matching its own preserved `value` text against that
-- vocabulary, scoped to the tag's own basiskonzept_id (several labels, e.g.
-- "Fließgleichgewicht", legitimately exist under more than one Basiskonzept
-- through a different fachliche Linse -- see the richer source files' own
-- verwandte_konzepte cross-references -- so matching must never be global).
--
-- Deliberately narrow and safe: only ever touches
-- basiskonzeptbezug[].relevante_unterkonzepte_taxonomie[].taxonomyElementId
-- and the equivalent relevante_evolutionskonzepte_taxonomie[] field. A tag
-- whose value doesn't resolve to any row (none expected -- the pre-write
-- check found 1338/1338 resolve once 059's vocabulary exists) is left
-- completely untouched, including its stale id -- this migration never
-- deletes or blanks a tag, only ever replaces a resolvable id with a
-- correct one. relevanz_beurteilung, begruendung, and every other field on
-- each Lernziel are never touched.

DO $$
DECLARE
  v_project_id UUID;
  obj RECORD;
  bk_entry JSONB;
  new_bk_entries JSONB;
  tag JSONB;
  new_unterkonzepte JSONB;
  new_evolutionskonzepte JSONB;
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
      v_root_label := NULL;
      IF bk_entry ? 'basiskonzept_id' AND (bk_entry->>'basiskonzept_id') ~* '^[0-9a-f]{8}-' THEN
        SELECT label INTO v_root_label FROM lpm_schema_elements
        WHERE id = (bk_entry->>'basiskonzept_id')::uuid AND project_id = v_project_id AND parent_id IS NULL;
      END IF;

      -- relevante_unterkonzepte_taxonomie[]
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

      -- relevante_evolutionskonzepte_taxonomie[] (same shape, kept as a
      -- separate field in the real data -- see concepts-page.tsx's own
      -- BkbEntry type, which reads both)
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

  RAISE NOTICE 'Re-link complete: % Lernziele processed, %/% real sub-concept tags now resolved to a real taxonomy row', v_objects_touched, v_tags_resolved, v_tags_total;
END $$;
