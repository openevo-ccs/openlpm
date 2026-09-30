SET search_path = public, extensions;

-- Applies the real 2024->2026 Thuringia Biologie wording corrections that
-- migration 028 deliberately deferred (source: EvoMentor_DE/data/
-- thuringia_2026_lp_data/LP Thüringen Bio Änderungen 2024-2026.csv, full
-- list in lab_manager/docs/design-notes/
-- thuringia-2026-lehrplan-wording-changes-followup.md).
--
-- Same discipline as 028: no live read access to evomentor-thuringia's real
-- rows was available when this was written, so nothing here blind-guesses
-- at text it hasn't confirmed. Split into two parts:
--
-- Part 1 -- 4 corrections with a complete, unambiguous old-text/new-text
-- pair (items 1, 2, 3, 6 from the followup doc): applied directly via an
-- exact-substring find/replace, idempotent (only touches a row if the OLD
-- fragment is still present -- running this twice is a no-op the second
-- time), and every attempt is logged via RAISE NOTICE so whoever runs this
-- can see exactly what matched or didn't.
--
-- Part 2 -- the remaining 11 items (4, 5, 7-15) either describe a
-- structural change (splitting/merging items, expanding scope -- not a
-- pure wording swap) or don't have a fully unambiguous old-text anchor to
-- match on safely. Rather than leave a future session to re-derive the
-- whole list from scratch again, this reports (SELECT/RAISE NOTICE only,
-- no writes) which rows in evomentor-thuringia contain each item's known
-- anchor phrase today, so a human can apply the real final wording with
-- one glance at real data instead of guessing.

DO $$
DECLARE
  v_project_id UUID;
  v_count INT;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia project not found -- skipping wording corrections';
    RETURN;
  END IF;

  -- ===========================================================
  -- Part 1: direct, unambiguous corrections
  -- ===========================================================

  -- 1. Kl. 7/8, Nervenzelle: shifts from one function to each part's own function.
  UPDATE lpm_data_objects
  SET content = jsonb_set(content, '{originaltext}',
        to_jsonb(replace(content->>'originaltext', 'die Funktion einer Nervenzelle nennen', 'die Funktionen der Bestandteile nennen'))),
      description = replace(description, 'die Funktion einer Nervenzelle nennen', 'die Funktionen der Bestandteile nennen'),
      updated_at = now()
  WHERE project_id = v_project_id
    AND content->>'originaltext' LIKE '%die Funktion einer Nervenzelle nennen%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[1/Nervenzelle] rows updated: %', v_count;

  -- 2. Kl. 7/8, Lebensmittelkennzeichnung: Germany's own labeling scheme moved on.
  UPDATE lpm_data_objects
  SET content = jsonb_set(content, '{originaltext}',
        to_jsonb(replace(content->>'originaltext', 'Lebensmittelampel', 'Nutri-Score'))),
      description = replace(description, 'Lebensmittelampel', 'Nutri-Score'),
      updated_at = now()
  WHERE project_id = v_project_id
    AND content->>'originaltext' LIKE '%Lebensmittelampel%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[2/Nutri-Score] rows updated: %', v_count;

  -- 3. Kl. 7/8, Gesunderhaltung: dropped a required bullet list, now one example.
  UPDATE lpm_data_objects
  SET content = jsonb_set(content, '{originaltext}',
        to_jsonb(replace(content->>'originaltext',
          'Maßnahmen zur Gesunderhaltung begründen: regelmäßige sportliche Betätigung; ausgewogene Ernährung',
          'Maßnahmen zur Gesunderhaltung begründen (z. B. regelmäßige sportliche Betätigung)'))),
      description = replace(description,
          'Maßnahmen zur Gesunderhaltung begründen: regelmäßige sportliche Betätigung; ausgewogene Ernährung',
          'Maßnahmen zur Gesunderhaltung begründen (z. B. regelmäßige sportliche Betätigung)'),
      updated_at = now()
  WHERE project_id = v_project_id
    AND content->>'originaltext' LIKE '%Maßnahmen zur Gesunderhaltung begründen: regelmäßige sportliche Betätigung%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[3/Gesunderhaltung] rows updated: %', v_count;

  -- 6. Kl. 9/10, Obst-/Gemüselagerung: more precise ("air temperature", not just "temperature").
  UPDATE lpm_data_objects
  SET content = jsonb_set(content, '{originaltext}',
        to_jsonb(replace(content->>'originaltext', 'Verringerung der Temperatur', 'Verringerung der Lufttemperatur'))),
      description = replace(description, 'Verringerung der Temperatur', 'Verringerung der Lufttemperatur'),
      updated_at = now()
  WHERE project_id = v_project_id
    AND content->>'originaltext' LIKE '%Verringerung der Temperatur%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[6/Lufttemperatur] rows updated: %', v_count;

  -- ===========================================================
  -- Part 2: report-only. Each block just names which rows contain the
  -- relevant 2024 anchor text today -- no write. Apply the real 2026
  -- wording (see the followup doc for what each one should become) once
  -- a human has looked at the matched row(s) directly.
  -- ===========================================================

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND grade_band IN ('9', '10', '9/10')
      AND content->>'originaltext' ILIKE '%Stoff%' ;
  RAISE NOTICE '[4/Kl.9-10 split] candidate 9/10-banded Stoffwechsel-ish rows to review for the Kl.9 vs Kl.10 grade_band split: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Ertragssteigerung%';
  RAISE NOTICE '[5/Ertragssteigerung] rows matching "Ertragssteigerung" needing the (MB, BO, BNE) tag + bullet reorg: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Pilz%';
  RAISE NOTICE '[7,8/Pilze] rows matching "Pilz" needing "am Beispiel der Hefen" (item 7) or the Hutpilze/Schimmelpilze/Hefepilze scope expansion (item 8): %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Licht- und Schattenblätter%';
  RAISE NOTICE '[9/abiotische Faktoren] rows matching "Licht- und Schattenblätter" that should drop the Feucht-/Trockenlufttiere example: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Räuber-Beute%' AND content->>'originaltext' ILIKE '%Parasitismus%';
  RAISE NOTICE '[10/Wechselbeziehungen] rows matching "Räuber-Beute"+"Parasitismus" needing "Konkurrenz" added: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Kreuzungsschema%';
  RAISE NOTICE '[11/Kreuzungsschema] rows matching "Kreuzungsschema" needing "(statistischer Charakter)" added: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Ausbildung von Merkmalen%';
  RAISE NOTICE '[12/Proteine] rows matching "Ausbildung von Merkmalen" needing "als Grundlage für..." reword: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%Variabilität%';
  RAISE NOTICE '[13/Variabilität] rows matching "Variabilität" needing the Rekombination/Mutation/Modifikation merge: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%erblich%';
  RAISE NOTICE '[14/Erbkrankheiten] rows matching "erblich" needing named examples + Therapiemöglichkeiten added: %', v_count;

  SELECT count(*) INTO v_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND content->>'originaltext' ILIKE '%menschliche Rassen%';
  RAISE NOTICE '[15/Rassenbegriff] rows matching "menschliche Rassen" needing the "(Jenaer Erklärung)" citation added: %', v_count;

END $$;
