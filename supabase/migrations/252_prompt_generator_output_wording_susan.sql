-- 252: Length and detail level of the KI-Prompt-Generator use Susan Hanisch's wording.
--
-- Migration 251 added three lengths and three detail levels with wording drafted by an AI. Susan Hanisch answered on 2026-11-21 with her own
-- description of the three levels, per lesson hour:
--   kurz und knapp: only the most important points and lesson sequences (Verlaufsordnungen) in bullet points, 1 to 2 pages per lesson hour;
--   ausführlicher: in addition short explanations and examples for methods and worksheets, 3 to 4 pages per lesson hour;
--   sehr detailliert: fully written out, with didactic reasons and suggestions for variations, plus material for all phases.
-- The page counts go to Länge, the content goes to Detailgrad. The keys of Länge stay (kurz, mittel, ausführlich), so saved prompts keep their
-- meaning. The middle detail key changes from 'ausgewogen' to 'ausfuehrlicher' to match its new name, and it stays the default.
--
-- Only the library 'Deutsch -- Biologie (KMK Basiskonzepte)' is changed. Running this twice leaves the same result.

SET search_path = public, extensions;

UPDATE prompt_template_libraries
SET
  option_lists = option_lists || jsonb_build_object(
    'lengths',
    jsonb_build_array(
      jsonb_build_array('kurz', 'Kurz (1 bis 2 Seiten pro Unterrichtsstunde)'),
      jsonb_build_array('mittel', 'Mittel (3 bis 4 Seiten pro Unterrichtsstunde)'),
      jsonb_build_array('ausführlich', 'Ausführlich (ohne Seitenbegrenzung)')
    ),
    'detail_levels',
    jsonb_build_array(
      jsonb_build_array('knapp', 'Kurz und knapp: nur die wichtigsten Angaben, Verlaufsordnungen in Stichpunkten'),
      jsonb_build_array('ausfuehrlicher', 'Ausführlicher: zusätzlich kurze Erklärungen und Beispiele für Methoden und Arbeitsmaterial'),
      jsonb_build_array('sehr-detailliert', 'Sehr detailliert: ausformuliert, mit didaktischen Begründungen, Vorschlägen für Variationen und Arbeitsmaterial für alle Phasen')
    ),
    'default_detail', 'ausfuehrlicher'
  )
WHERE label = 'Deutsch -- Biologie (KMK Basiskonzepte)';
