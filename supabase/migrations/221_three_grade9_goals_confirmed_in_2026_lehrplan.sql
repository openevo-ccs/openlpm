-- 221: three grade 9 goals are confirmed as parts of the Lehrplan Biologie Gymnasium 2026 (Erprobungsfassung).
--
-- Susan Hanisch, 2026-11-02: "Ertragssteigerung: optimale Temperatur begründen" and "Biotische Wechselbeziehung: Konkurrenz" are in the 2026
-- Erprobungsfassung. Checked in the document itself (scripts/lehrplan_pdf_lookup.py, PDF "LP Thüringen Bio Gym 2026 Erprobungsfassung"):
--   - Klassenstufe 9, printed page 25, Lernbereich Fotosynthese: "Maßnahmen zur Ertragssteigerung bei Kulturpflanzen im Gewächshaus begründen",
--     last bullet "Gewährleistung einer optimalen Temperatur", directly before Zellatmung.
--   - Klassenstufe 9, printed page 27, Lernbereich Ökologie: "biotische Wechselbeziehungen erläutern", last bullet "Konkurrenz" after
--     Räuber-Beute-Beziehung, Symbiose and Parasitismus.
--   - Klassenstufe 9, printed page 27: "Ökosysteme anhand von Merkmalen charakterisieren", first bullet "Ökosystem als offenes System". This goal
--     was already linked in the live space; it lacked the edition tag, and the sandbox lacked the link.
-- The three goals get the edition tag (content.curriculum_version, content.source) in the live space and the sandbox copy, and the two that had no
-- edition link in a space get a built_from link to the Biologie 2026 record, with the page as the rationale.
-- Not touched: four other goals that the same check did not find in the 2026 text (Verlustrarme Lagerung: CO2-Erhöhung, Ökosysteme einteilen,
-- Gesunderhaltung: Ernährung, Einzeller zu Vielzeller: Grünalgen). They stay without tag and link. Running this twice changes nothing.
SET search_path = public, extensions;

UPDATE lpm_data_objects o
SET content = o.content || jsonb_build_object('curriculum_version', '2026-erprobungsfassung', 'source', 'LP Thueringen Bio Gym 2026 Erprobungsfassung'),
    updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND o.grade_band = '9' AND o.status = 'accepted'
  AND o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz', 'Ökosystem als offenes System')
  AND NOT (o.content ? 'curriculum_version');

INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, 'built_from',
       CASE o.title
         WHEN 'Ertragssteigerung: optimale Temperatur begründen'
           THEN 'Confirmed in the Lehrplan Biologie Gymnasium 2026 (Erprobungsfassung), Klassenstufe 9, printed page 25 (Fotosynthese, last bullet "Gewährleistung einer optimalen Temperatur"). Added 2026-11-02.'
         WHEN 'Biotische Wechselbeziehung: Konkurrenz'
           THEN 'Confirmed in the Lehrplan Biologie Gymnasium 2026 (Erprobungsfassung), Klassenstufe 9, printed page 27 (Ökologie, biotische Wechselbeziehungen, last bullet "Konkurrenz"). Added 2026-11-02.'
         ELSE 'Confirmed in the Lehrplan Biologie Gymnasium 2026 (Erprobungsfassung), Klassenstufe 9, printed page 27 (Ökosysteme anhand von Merkmalen charakterisieren, first bullet "Ökosystem als offenes System"). Added 2026-11-02.'
       END
FROM lpm_data_objects o
JOIN curriculum_repository_records r
  ON r.project_id = (SELECT id FROM projects WHERE slug = 'thuringia-curriculum-repository')
 AND r.source_record_id = 'DELP-EVENT-thueringen-biologie-gymnasium-2026-erprobungsfassung'
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND o.grade_band = '9' AND o.status = 'accepted'
  AND o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz', 'Ökosystem als offenes System')
  AND NOT EXISTS (SELECT 1 FROM curriculum_repository_links l WHERE l.data_object_id = o.id AND l.repository_record_id = r.id AND l.relation_type = 'built_from');

DO $$
DECLARE tagged integer; linked integer;
BEGIN
  SELECT count(*) INTO tagged FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.grade_band = '9' AND o.status = 'accepted'
    AND o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz', 'Ökosystem als offenes System')
    AND o.content ->> 'curriculum_version' = '2026-erprobungsfassung';
  SELECT count(*) INTO linked FROM curriculum_repository_links l
  JOIN lpm_data_objects o ON o.id = l.data_object_id
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.grade_band = '9' AND l.relation_type = 'built_from'
    AND o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz', 'Ökosystem als offenes System');
  IF tagged <> 6 OR linked < 6 THEN
    RAISE EXCEPTION 'migration 221: tagged % of 6, linked % of at least 6', tagged, linked;
  END IF;
END $$;
