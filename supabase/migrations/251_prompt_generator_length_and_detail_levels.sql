-- 251: The KI-Prompt-Generator of the German library gets three lengths and a detail level for the answer.
--
-- Dustin Eirdosh, feedback e3c38ffb (2026-11-13, EvoMentor Thüringen, page Planen): the prompt ends with a "Gewünschte Ausgabe" block, but the
-- page had no controls for it. "Add those options, especially regarding length and detailedness of output." The page now has the section
-- (code change); this migration gives its two choices more room:
--   * Länge: kurz, mittel, ausführlich (was kurz, ausführlich). The keys 'kurz' and 'ausführlich' stay, so saved prompts keep their meaning.
--   * Detailgrad: how much the answer spells out. The plain description of the chosen level is printed into the prompt, so the AI is told
--     what "detailliert" means.
-- Default stays 'ausführlich' for the length. The detail level starts on 'ausgewogen'.
--
-- Only the library 'Deutsch -- Biologie (KMK Basiskonzepte)' is changed. Running this twice leaves the same result.

SET search_path = public, extensions;

UPDATE prompt_template_libraries
SET
  option_lists = option_lists || jsonb_build_object(
    'lengths',
    jsonb_build_array(
      jsonb_build_array('kurz', 'Kurz (etwa eine Seite)'),
      jsonb_build_array('mittel', 'Mittel (zwei bis drei Seiten)'),
      jsonb_build_array('ausführlich', 'Ausführlich')
    ),
    'detail_levels',
    jsonb_build_array(
      jsonb_build_array('knapp', 'Knapp: Stichpunkte mit den wichtigsten Punkten'),
      jsonb_build_array('ausgewogen', 'Ausgewogen: kurze Erklärungen mit Beispielen'),
      jsonb_build_array('sehr-detailliert', 'Sehr detailliert: ausformuliert, mit Zeitangaben, Material und Impulsfragen')
    ),
    'default_detail', 'ausgewogen'
  ),
  section_labels = section_labels || jsonb_build_object('detail_label', 'Detailgrad:')
WHERE label = 'Deutsch -- Biologie (KMK Basiskonzepte)';
