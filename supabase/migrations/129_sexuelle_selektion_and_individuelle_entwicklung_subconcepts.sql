SET search_path = public, extensions;

-- Real content gap, feedback 334a8405 + d1962ccb (Susan Hanisch, 2026-10-10):
-- "Sexuelle Selektion is not explained yet" and "there are no explanations
-- for these yet" (the six Unterkonzepte under Individuelle Entwicklung).
-- Neither had a real source anywhere in this repo (no evolutionskonzepte.json
-- or equivalent) -- migration 126's own header already flagged this as
-- needing new content rather than a guess.
--
-- Dustin's explicit instruction (2026-10-11): draft this content directly,
-- in the Kattmann/Gropengießer Basiskonzept-didactics style already used
-- throughout this project's real, imported content (one dense definition
-- sentence + one short concrete example -- matched directly against
-- already-populated siblings like "kulturelle Evolution" and
-- "Migration/Genfluss" under Evolutive Entwicklung). Susan will review
-- before this is treated as validated -- metadata.source below marks this
-- honestly as AI-drafted, not part of the real EvoMentor DE import, so a
-- future reader (or query) can't mistake it for that.
--
-- Scoped to evomentor-thuringia's own rows only, same convention as
-- migration 126 -- the parent EvoMentor hub's own copies are untouched.

UPDATE lpm_schema_elements
SET
  definition = 'Eine Form der Selektion, bei der nicht das Überleben, sondern der Fortpflanzungserfolg entscheidet, welche Merkmale an die nächste Generation weitergegeben werden; sie wirkt über innergeschlechtliche Konkurrenz um Paarungspartner (z. B. Rivalenkämpfe) und über zwischengeschlechtliche Partnerwahl (z. B. auffällige Balzmerkmale).',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Das weit ausladende Rad des Pfaus erhöht die Attraktivität für Weibchen, obwohl es die Flucht vor Fressfeinden erschwert – ein Beispiel für den Zielkonflikt zwischen natürlicher und sexueller Selektion.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback 334a8405 (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Sexuelle Selektion'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET
  definition = 'Die Abfolge charakteristischer Entwicklungsstadien eines Organismus von der Befruchtung bzw. Geburt bis zum Tod, die bei vielen Arten mit grundlegenden körperlichen Umbauten verbunden ist.',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Der Lebenszyklus eines Schmetterlings durchläuft die Stadien Ei, Raupe, Puppe und Falter, wobei sich Körperbau und Lebensweise in jeder Phase grundlegend ändern.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback d1962ccb (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Lebenszyklus und Entwicklungsphasen'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET
  definition = 'Die Fähigkeit, Verhalten durch Erfahrung dauerhaft zu verändern; Prägung ist eine besondere, zeitlich eng begrenzte Form des Lernens in einer sensiblen Phase der frühen Entwicklung, deren Ergebnis kaum mehr umkehrbar ist.',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Nach dem Schlüpfen folgen Graugänse dem ersten sich bewegenden Objekt, das sie wahrnehmen, und bleiben dauerhaft darauf geprägt – bekannt aus Konrad Lorenz'' Versuchen.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback d1962ccb (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Lernen und Prägung'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET
  definition = 'Die Fähigkeit eines Organismus, je nach Umweltbedingungen während der Entwicklung unterschiedliche Phänotypen auszubilden, ohne dass sich sein Genotyp verändert; solche Veränderungen sind nicht erblich.',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Der Wasserhahnenfuß bildet unter Wasser fein zerteilte, über Wasser breite, flächige Blätter aus – je nach Standort, bei identischem Erbgut.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback d1962ccb (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Modifikation und Plastizität'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET
  definition = 'Die Erzeugung neuer Individuen durch einen Organismus, entweder ungeschlechtlich mit genetisch identischen Nachkommen oder geschlechtlich durch Verschmelzung von Keimzellen zweier Elternteile mit genetisch neu kombinierten Nachkommen; markiert den Beginn eines neuen individuellen Entwicklungszyklus.',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Bei der geschlechtlichen Fortpflanzung des Menschen verschmelzen Ei- und Samenzelle zur Zygote, aus der sich durch wiederholte Zellteilung ein neuer Organismus entwickelt.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback d1962ccb (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Reproduktion/Fortpflanzung'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET
  definition = 'Der Prozess, bei dem genetisch identische Zellen durch unterschiedliche Genaktivität (Genexpression) verschiedene Strukturen und Funktionen ausbilden, obwohl sich ihr Erbgut nicht unterscheidet.',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Aus derselben befruchteten Eizelle entstehen durch Zelldifferenzierung so unterschiedliche Zelltypen wie Muskel-, Nerven- und Hautzellen.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback d1962ccb (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Zelldifferenzierung'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET
  definition = 'Die Vermehrung von Zellen durch Teilung einer Mutterzelle in zwei Tochterzellen; bei der Mitose entstehen genetisch identische Zellen für Wachstum und Regeneration, bei der Meiose genetisch unterschiedliche Keimzellen als Grundlage der geschlechtlichen Fortpflanzung.',
  metadata = metadata || jsonb_build_object(
    'beispiel', 'Durch wiederholte mitotische Zellteilungen wächst eine befruchtete Eizelle zu einem vielzelligen Organismus mit Billionen von Zellen heran.',
    'language', 'de',
    'source', 'claude_drafted_2026_10_11',
    'source_detail', 'AI-drafted by Claude Sonnet 5 at Dustin Eirdosh''s direct request, 2026-10-11, in response to feedback d1962ccb (Susan Hanisch). NOT yet reviewed by Susan or another biology-education subject-matter expert -- check review status before treating as validated content.'
  )
WHERE label = 'Zellteilung'
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');
