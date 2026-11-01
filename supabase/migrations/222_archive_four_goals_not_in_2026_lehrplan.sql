-- 222: four goals that the 2026 Lehrplan Biologie no longer contains are taken out of EvoMentor Thüringen.
--
-- Susan Hanisch, 2026-11-02: "those are all goals that have been omitted in the 2026 text, so they should go". Checked in the document itself
-- (scripts/lehrplan_pdf_lookup.py): the goals follow the older edition and have no counterpart in the 2026 Erprobungsfassung.
--   GY-910-PGP-ZA-7   Verlustrarme Lagerung: CO2-Erhöhung begründen   (Kl. 9; 2026 lists only "Verringerung der Lufttemperatur")
--   GY-910-OKO-OSY-6  Ökosysteme einteilen                              (Kl. 9; 2026 says "anhand von Merkmalen charakterisieren")
--   GY-78-HUM-BHK-6   Gesunderhaltung: Ernährung                       (Kl. 7/8; other wording and bullets in 2026)
--   GY-78-ZEL-PTZ-7   Einzeller zu Vielzeller: Grünalgen               (Kl. 7/8; only in the Basiskonzept table of the document)
-- The goals are archived (status 'archived'). Nothing is deleted, so they stay in the database and can be restored. This happens in the live
-- space and in the sandbox copy. Then:
--   - six other goals listed one of the four in ermoeglichende_lernziele, voraussetzende_lernziele or interleaving_empfehlung; those entries are
--     removed so that nothing points at a goal that no longer shows,
--   - the filing of the four goals under structure nodes (migration 216) and their edition links (a 2026 link they never had a right to) are
--     removed,
--   - the grade 7/8 and grade 9 order is numbered 0 to n-1 again without gaps.
-- Running this twice changes nothing.
SET search_path = public, extensions;

UPDATE lpm_data_objects o
SET status = 'archived', updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND o.status = 'accepted' AND o.grade_band IN ('7/8', '9')
  AND o.content ->> 'id' IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7');

UPDATE lpm_data_objects o
SET content = o.content || jsonb_build_object('ermoeglichende_lernziele', (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'ermoeglichende_lernziele') = 'array' THEN o.content -> 'ermoeglichende_lernziele' ELSE '[]'::jsonb END) e
      WHERE (e #>> '{}') NOT IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7'))),
    updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND jsonb_typeof(o.content -> 'ermoeglichende_lernziele') = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'ermoeglichende_lernziele') = 'array' THEN o.content -> 'ermoeglichende_lernziele' ELSE '[]'::jsonb END) e
              WHERE (e #>> '{}') IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7'));

UPDATE lpm_data_objects o
SET content = o.content || jsonb_build_object('voraussetzende_lernziele', (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'voraussetzende_lernziele') = 'array' THEN o.content -> 'voraussetzende_lernziele' ELSE '[]'::jsonb END) e
      WHERE (e #>> '{}') NOT IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7'))),
    updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND jsonb_typeof(o.content -> 'voraussetzende_lernziele') = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'voraussetzende_lernziele') = 'array' THEN o.content -> 'voraussetzende_lernziele' ELSE '[]'::jsonb END) e
              WHERE (e #>> '{}') IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7'));

UPDATE lpm_data_objects o
SET content = o.content || jsonb_build_object('interleaving_empfehlung', (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'interleaving_empfehlung') = 'array' THEN o.content -> 'interleaving_empfehlung' ELSE '[]'::jsonb END) e
      WHERE (e #>> '{}') NOT IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7'))),
    updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND jsonb_typeof(o.content -> 'interleaving_empfehlung') = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'interleaving_empfehlung') = 'array' THEN o.content -> 'interleaving_empfehlung' ELSE '[]'::jsonb END) e
              WHERE (e #>> '{}') IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7'));

DELETE FROM curriculum_repository_node_goals ng
USING lpm_data_objects o
WHERE ng.data_object_id = o.id AND o.status = 'archived'
  AND o.content ->> 'id' IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7');

DELETE FROM curriculum_repository_links l
USING lpm_data_objects o
WHERE l.data_object_id = o.id AND o.status = 'archived'
  AND o.content ->> 'id' IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7');

WITH ranked AS (
  SELECT id, (row_number() OVER (PARTITION BY project_id, grade_band ORDER BY curriculum_sequence, id) - 1) AS rn
  FROM lpm_data_objects
  WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND grade_band IN ('7/8', '9') AND status = 'accepted'
)
UPDATE lpm_data_objects o
SET curriculum_sequence = r.rn, updated_at = now()
FROM ranked r
WHERE o.id = r.id AND o.curriculum_sequence IS DISTINCT FROM r.rn;

DO $$
DECLARE archived integer; still_accepted integer; dangling integer; gaps integer;
BEGIN
  SELECT count(*) INTO archived FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.status = 'archived' AND o.content ->> 'id' IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7');
  SELECT count(*) INTO still_accepted FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.status = 'accepted' AND o.content ->> 'id' IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7');
  SELECT count(*) INTO dangling FROM lpm_data_objects o, jsonb_each(o.content) kv, jsonb_array_elements_text(
      CASE WHEN kv.key IN ('ermoeglichende_lernziele', 'voraussetzende_lernziele', 'interleaving_empfehlung') AND jsonb_typeof(kv.value) = 'array' THEN kv.value ELSE '[]'::jsonb END) e
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND e IN ('GY-910-PGP-ZA-7', 'GY-910-OKO-OSY-6', 'GY-78-HUM-BHK-6', 'GY-78-ZEL-PTZ-7');
  SELECT count(*) INTO gaps FROM (
    SELECT project_id, grade_band, max(curriculum_sequence) AS mx, count(*) AS n FROM lpm_data_objects
    WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
      AND grade_band IN ('7/8', '9') AND status = 'accepted' GROUP BY project_id, grade_band) t
  WHERE t.mx <> t.n - 1;
  IF archived <> 8 OR still_accepted <> 0 OR dangling <> 0 OR gaps <> 0 THEN
    RAISE EXCEPTION 'migration 222: archived % of 8, still accepted %, dangling references %, bands with gaps %', archived, still_accepted, dangling, gaps;
  END IF;
END $$;
