-- 245: A Konzeptanker for Steuerung und Regelung in the grade 9 ecology goals (feedback eee48eab, Dustin Eirdosh, 2026-11-07:
-- "there should be a konzeptanker for steuern und regelung in grade ecology").
--
-- Today Steuerung und Regelung has two Konzeptanker, both in grade 7/8 (Blutzuckerregelung, Zusammenwirken der Organsysteme),
-- and none in grade 9. The grade 9 ecology goal "Relative Stabilität durch Selbstregulation" has Steuerung und Regelung as
-- its main Basiskonzept (basiskonzepte_primaer) and is the only grade 9 goal rated high (3) for Steuerung und Regelung and no
-- other concept, so marking it as a Konzeptanker adds one anchor for that concept and none for another. The other grade 9
-- goals rated high for it ("Biotische Wechselbeziehung: Räuber-Beute", "Ökologischer Toleranzbereich", "Stabilität durch
-- Struktur- und Artenvielfalt") are also high for Evolutive Entwicklung, so marking one of them would add an anchor there too.
--
-- THIS IS A DRAFT CHOICE BY CLAUDE. No expert has checked it. Susan Hanisch decides which goal is the best concrete entry point;
-- the Rollback below takes the mark off again.
--
-- The UPDATE only touches the goal while it is not yet marked, so running this twice changes nothing. The goal is found by
-- title, grade and space, because the sandbox space has its own ids.
SET search_path = public, extensions;

UPDATE lpm_data_objects SET content = jsonb_set(content, '{ist_konzeptanker}', 'true'::jsonb)
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND title = 'Relative Stabilität durch Selbstregulation'
  AND grade_band = '9'
  AND status = 'accepted'
  AND COALESCE(content ->> 'ist_konzeptanker', 'false') <> 'true';

-- Rollback:
--   UPDATE lpm_data_objects SET content = jsonb_set(content, '{ist_konzeptanker}', 'false'::jsonb)
--   WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
--     AND title = 'Relative Stabilität durch Selbstregulation' AND grade_band = '9';
