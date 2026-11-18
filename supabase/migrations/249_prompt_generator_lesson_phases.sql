-- 249: The KI-Prompt-Generator gets the ten lesson phases (didaktische Funktionen) and the lesson plan form (Verlaufsordnung) of the Jena planning.
--
-- Susan Hanisch, feedback 9e9f8a30 (2026-11-14, EvoMentor Thüringen): the generator should make use of (1) the lesson plan template in her
-- Google doc "Verlaufsordnung_Vorlage" and (2) this non-exhaustive list of lesson phases. Dustin, 2026-11-17: the methodsbase repo keeps six
-- phases (its five plus Transfer/Vernetzung), and the generator uses the ten phase list, because it is specific to the Jena context.
--
-- Both are stored with the prompt library, so the repo's phase vocabulary stays small and the Jena content is data that can be edited without
-- a code change. The prompt builder prints each as its own block just before the DESIRED OUTPUT section, only when a library has it.
-- The template text follows the doc: a header (Klassenstufe, Stoffeinheit/Stunde, Stundenthema, (Basis)Konzepte, Ziele) and a table with
-- six columns (Zeit, Did. Fkt., Teilziele, Unterrichtsmittel, Lehrtätigkeiten, Schülertätigkeiten).
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
    ),
    'lesson_plan_template',
    $template$Gib den Stundenverlauf als Verlaufsordnung aus.
Kopf: Klassenstufe; Stoffeinheit/Stunde; Stundenthema; (Basis)Konzepte; Ziele der Unterrichtsstunde (siehe Lehrplan; Wissen, Können, Einstellungen; Kompetenzen).
Darunter eine Tabelle mit diesen Spalten:
- Zeit (ca.)
- Did. Fkt. (Kürzel der didaktischen Funktionen, zum Beispiel MO, ZO/ZA, EA, TV, Ü, F, T, R, A, E)
- Teilziele: Die Schüler*innen sollen ... (mit Verben/Operatoren ausgedrückt)
- Unterrichtsmittel (Medien, Modelle/Repräsentationsformen, Lehrbücher, Tafel, Präsentationsfolien, Arbeitsblätter usw.)
- Lehrtätigkeiten: Die Lehrkraft ... (Lehrmethoden, Aufgabenstellungen, Organisation, Impulse/Hilfestellungen, Klassenführung, ...)
- Schülertätigkeiten: Die Schüler:innen ... (Lerntätigkeiten/Operatoren, Lernmethoden, Sozialformen)$template$
  ),
  section_labels = section_labels || jsonb_build_object(
    'lesson_phases_section',
    'UNTERRICHTSPHASEN (didaktische Funktionen; gliedere die Stunden danach, die Liste ist nicht abschließend):',
    'lesson_plan_template_section',
    'FORM DER UNTERRICHTSPLANUNG (Verlaufsordnung):'
  )
WHERE label = 'Deutsch -- Biologie (KMK Basiskonzepte)';
