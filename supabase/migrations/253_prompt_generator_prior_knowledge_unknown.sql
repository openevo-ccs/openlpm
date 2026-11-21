-- 253: The KI-Prompt-Generator of the German library gets a fourth prior-knowledge level, "Nicht bekannt", and a meaning for every level.
--
-- Feedback 1fab704b (Dustin Eirdosh, 2026-11-13): "we may need four levels regarding prior knowledge of basiskonzepte". Susan Hanisch could not
-- name a meaningful fourth level herself and asked for suggestions (2026-11-21); Dustin chose "Nicht bekannt" (the teacher does not know what the
-- class can already do), and asked that the meaning of each level shows as a hover text.
--
-- Each level is now [key, label, meaning for the hover text, note for the prompt]. Only "Nicht bekannt" has a prompt note, which asks the AI to
-- begin with a short check of prior knowledge. The three old levels keep their keys and labels, so saved prompts keep their meaning, and the
-- default stays the second level.
-- The meanings are AI drafts that Susan Hanisch has not checked yet.
--
-- Only the library 'Deutsch -- Biologie (KMK Basiskonzepte)' is changed. Running this twice leaves the same result.

SET search_path = public, extensions;

UPDATE prompt_template_libraries
SET
  option_lists = option_lists || jsonb_build_object(
    'prior_knowledge_levels',
    jsonb_build_array(
      jsonb_build_array('keins', 'Kein Vorwissen', 'Das Thema war noch nicht Unterrichtsgegenstand. Die Klasse beginnt ohne fachliche Grundlagen.'),
      jsonb_build_array('grundlagen', 'Grundbegriffe bekannt', 'Die zentralen Begriffe sind bekannt. Zusammenhänge zwischen ihnen sind noch nicht gesichert.'),
      jsonb_build_array('solide', 'Solides Grundwissen', 'Begriffe und Zusammenhänge sind gesichert. Die Klasse kann sie auf Beispiele anwenden.'),
      jsonb_build_array(
        'unbekannt', 'Nicht bekannt',
        'Ich weiß nicht, was die Klasse schon kann. Der Prompt bittet dann um einen kurzen Einstieg, der das Vorwissen erfasst.',
        'Vorwissen unbekannt: beginne mit einer kurzen Eingangsdiagnose und passe die weitere Planung an deren Ergebnis an'
      )
    )
  )
WHERE label = 'Deutsch -- Biologie (KMK Basiskonzepte)';
