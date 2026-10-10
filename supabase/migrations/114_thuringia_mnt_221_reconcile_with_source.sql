-- Reconcile EvoMentor Thuringia's "2.2.1 Naturwissenschaftliche Denk- und
-- Arbeitsmethoden" content against the REAL primary source document
-- (Thueringer Ministerium fuer Bildung, Wissenschaft und Kultur, "Lehrplan
-- fuer das Gymnasium Mensch-Natur-Technik 2026 (Erprobungsfassung)",
-- schulportal-thueringen.de media id 68282, page 10, Klassenstufe 6,
-- Sach- und Methodenkompetenz) -- fetched and read directly this session.
--
-- This is feedback 89d40c46 (Susan Hanisch, 2026-10-09): "learning goals
-- are from the old curriculum, topics are from the new curriculum". Nine
-- earlier migrations (086, 089, 097-099, 101-104, 106) touched this exact
-- topic without ever comparing it to the real document. What was actually
-- wrong: two separate, never-reconciled imports of the same curriculum
-- section coexist --
--   (a) 6 older rows (subject_area='Biologie', grade_band='5'), each with
--       a real, valuable pedagogical write-up connecting the skill to
--       evolution teaching (the whole point of this project), but wrong
--       subject/grade labels and, in 3 cases, an invented old-curriculum
--       framing sentence that does not appear in the real 2026 document;
--   (b) 5 newer rows (subject_area='MNT', grade_band='5/6'), literal and
--       correctly labelled, but with no pedagogical write-up.
-- Neither set was complete on its own, and one real item from the
-- document ("Experimentieren, unter Beachtung der Schrittfolge") existed
-- in neither.
--
-- The fix keeps every pedagogical write-up already written (deleting them
-- would be real, uncompensated loss), corrects the 6 older rows' labels
-- and wording to match the real document and the newer rows' own
-- established convention, and adds the one missing item. No rows are
-- deleted -- "Lupe sachgerecht handhaben" looked like a stray mistagged
-- row at first glance but is genuine, deliberate content (the real
-- document calls for Lupe-handling practice across three later topics --
-- Samenpflanzen p.18, Wirbeltiere p.21, Bionik -- and a past session
-- correctly consolidated that into one reusable item); it only needed the
-- same subject_area fix as everything else.

DO $$
DECLARE
  v_source text := 'LP Thueringen MNT Gym 2026 Erprobungsfassung';
  v_version text := '2026-erprobungsfassung';
BEGIN

-- "Fragen an die Natur stellen": real document has no standalone framing
-- sentence for this item -- it is one bullet under "Anwenden der
-- experimentellen Methode (Forschendes Lernen)". Drop the old-curriculum
-- framing clause, keep the pedagogical write-up.
UPDATE lpm_data_objects SET
  subject_area = 'MNT',
  grade_band = '5/6',
  description = 'Anwenden der experimentellen Methode (Forschendes Lernen): Formulieren von Fragen',
  content = jsonb_set(
    jsonb_set(
      jsonb_set(content, '{originaltext}', '"Anwenden der experimentellen Methode (Forschendes Lernen): Formulieren von Fragen"'),
      '{source}', to_jsonb(v_source)
    ),
    '{curriculum_version}', to_jsonb(v_version)
  ) || jsonb_build_object('empfohlene_klassenstufe', '5/6'),
  updated_at = now()
WHERE id = '5505cca7-ad59-559a-b52d-e189e6216f3e';

-- "Vermutungen aufstellen": same real bullet chain, next sub-item.
UPDATE lpm_data_objects SET
  subject_area = 'MNT',
  grade_band = '5/6',
  description = 'Anwenden der experimentellen Methode (Forschendes Lernen): Ableiten begründeter Vermutungen',
  content = jsonb_set(
    jsonb_set(
      jsonb_set(content, '{originaltext}', '"Anwenden der experimentellen Methode (Forschendes Lernen): Ableiten begründeter Vermutungen"'),
      '{source}', to_jsonb(v_source)
    ),
    '{curriculum_version}', to_jsonb(v_version)
  ) || jsonb_build_object('empfohlene_klassenstufe', '5/6'),
  updated_at = now()
WHERE id = '6d6870cc-6989-589c-8d9c-a9c646ed6d2f';

-- "Fragen mithilfe der experimentellen Methode beantworten": the remaining
-- four real sub-items of the same bullet chain, already combined into one
-- row -- wording tightened to match the real document's own phrasing.
UPDATE lpm_data_objects SET
  subject_area = 'MNT',
  grade_band = '5/6',
  description = 'Anwenden der experimentellen Methode (Forschendes Lernen): Planen von Experimenten zur Überprüfung der Vermutungen, Durchführen von Experimenten, Beobachten bzw. Ermitteln von Messergebnissen und Dokumentieren, Auswerten der Experimente und Bestätigen/Widerlegen der Vermutungen und Beantworten der Fragen',
  content = jsonb_set(
    jsonb_set(
      jsonb_set(content, '{originaltext}', '"Anwenden der experimentellen Methode (Forschendes Lernen): Planen von Experimenten zur Überprüfung der Vermutungen, Durchführen von Experimenten, Beobachten bzw. Ermitteln von Messergebnissen und Dokumentieren, Auswerten der Experimente und Bestätigen/Widerlegen der Vermutungen und Beantworten der Fragen"'),
      '{source}', to_jsonb(v_source)
    ),
    '{curriculum_version}', to_jsonb(v_version)
  ) || jsonb_build_object('empfohlene_klassenstufe', '5/6'),
  updated_at = now()
WHERE id = '59217437-cc96-52b4-af1c-972d77c7a4b2';

-- "Kriteriengeleitet betrachten und beobachten": wording already matches
-- the real document (fixed by migration 098) -- only the labels were wrong.
UPDATE lpm_data_objects SET
  subject_area = 'MNT',
  grade_band = '5/6',
  content = jsonb_set(
    jsonb_set(content, '{source}', to_jsonb(v_source)),
    '{curriculum_version}', to_jsonb(v_version)
  ) || jsonb_build_object('empfohlene_klassenstufe', '5/6'),
  updated_at = now()
WHERE id = 'ba79c252-b7ab-569e-9ea5-0ffc6ba38dfc';

-- "Arbeitsmittel sachgerecht verwenden": wording already matches the real
-- document almost verbatim -- only the labels were wrong.
UPDATE lpm_data_objects SET
  subject_area = 'MNT',
  grade_band = '5/6',
  content = jsonb_set(
    jsonb_set(content, '{source}', to_jsonb(v_source)),
    '{curriculum_version}', to_jsonb(v_version)
  ) || jsonb_build_object('empfohlene_klassenstufe', '5/6'),
  updated_at = now()
WHERE id = 'a518c1c4-1286-552b-9155-6e3e30e0ff3e';

-- "Lupe sachgerecht handhaben": genuine, deliberate content (see header
-- comment) -- only the subject label was wrong. Grade stays '6' on
-- purpose, per this row's own migration_note_2026 (it is scheduled later
-- than the rest of this topic, after Samenpflanzen).
UPDATE lpm_data_objects SET
  subject_area = 'MNT',
  updated_at = now()
WHERE id = '4b6fd514-838b-5ec7-84d5-5883dcb43f06';

-- Add the one real document item that existed in neither the old nor the
-- new set: "Experimentieren (unter Beachtung der Schrittfolge)".
INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
SELECT
  'performance_indicator',
  'Experimentieren',
  'Experimentieren (unter Beachtung der Schrittfolge)',
  '5/6', 'MNT',
  jsonb_build_object(
    'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
    'source', v_source,
    'unterthema', 'Methoden',
    'originaltext', 'Experimentieren (unter Beachtung der Schrittfolge)',
    'curriculum_version', v_version
  ),
  'accepted',
  p.id
FROM projects p
WHERE p.slug = 'evomentor-thuringia'
  AND NOT EXISTS (
    SELECT 1 FROM lpm_data_objects
    WHERE project_id = p.id AND title = 'Experimentieren'
  );

END $$;
