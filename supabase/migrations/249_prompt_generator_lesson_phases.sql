-- 249: The KI-Prompt-Generator gets the ten lesson phases (didaktische Funktionen) of the Jena planning.
--
-- Susan Hanisch, feedback 9e9f8a30 (2026-11-14, EvoMentor Thüringen): the generator should make use of this non-exhaustive list of lesson
-- phases. Dustin, 2026-11-17: the methodsbase repo keeps six phases (its five plus Transfer/Vernetzung), and the generator uses the ten
-- phase list, because it is specific to the Jena context.
--
-- The list is stored with the prompt library, so the repo's phase vocabulary stays small and the Jena list is data that can be edited
-- without a code change. The prompt builder prints it as its own block just before the DESIRED OUTPUT section, only when a library has it.
--
-- Only the library 'Deutsch -- Biologie (KMK Basiskonzepte)' is changed. Running this twice leaves the same result.

SET search_path = public, extensions;

UPDATE prompt_template_libraries
SET
  option_lists = option_lists || jsonb_build_object(
    'lesson_phases',
    jsonb_build_array(
      'Motivation (MO)',
      'Zielangabe, -orientierung (ZA/ZO)',
      '(Teil)Vermittlung (TV)',
      'Erarbeitung (EA)',
      'Sicherung/Übergabe (Ü)',
      'Festigung (Einprägen, Üben, Anwenden) (F)',
      'Transfer/Vernetzung (T)',
      'Ergebnisermittlung, -bewertung (E)',
      'Reflexion (R)',
      'Ausblick (A)'
    )
  ),
  section_labels = section_labels || jsonb_build_object(
    'lesson_phases_section',
    'UNTERRICHTSPHASEN (didaktische Funktionen; gliedere die Stunden danach, die Liste ist nicht abschließend):'
  )
WHERE label = 'Deutsch -- Biologie (KMK Basiskonzepte)';
