SET search_path = public, extensions;

-- Real feedback (Susan Hanisch, 2026-10-10, rows e8a73674/5ed02818/aeb6f58d/
-- c6d513c3/6a42767c): she gave exact replacement wording for five of the six
-- real EvoMentor Thuringia root Basiskonzepte's own didactic_definition --
-- simpler, more classroom-appropriate German than the original import, and
-- (for Evolutive Entwicklung specifically) drops an internal implementation
-- note ("Der Vokabular-Referenzrahmen für dieses Basiskonzept ist
-- data/evolutionskonzepte.json" -- no such file exists in this repo; it was
-- never more than a stray aspirational reference) that had no business in
-- student-facing text at all.
--
-- Scoped to evomentor-thuringia's own rows specifically (not the parent
-- EvoMentor hub's copy) -- getRootConcepts() in src/lib/supabase/
-- basiskonzepte.ts prefers a project's own row over its parent's when both
-- exist by label, and this project has its own full set (seeded
-- 2026-09-09, see that function's own comment).
--
-- The sixth root concept, "Individuelle Entwicklung", isn't touched here --
-- Susan didn't give replacement wording for it, and her separate feedback
-- d1962ccb flags that its own six Unterkonzepte have no definition content
-- at all yet. Both need her own text or a dedicated content-sourcing pass,
-- not a guess authored here.

UPDATE lpm_schema_elements
SET didactic_definition = 'Die evolutive Entwicklung beschreibt Veränderung über Generationen und erfordert Populationsdenken. Sie ist zugleich das Basiskonzept, das erklärt, warum die anderen fünf Basiskonzepte in ihrer jeweiligen Form in der Biologie existieren: Strukturen und deren Funktionen, Stoffwechselvorgänge, Informationsverarbeitung und Kommunikationssysteme, Regelkreise und Abläufe der individuellen Entwicklung sind selbst Produkte evolutiver Entwicklung, die jedoch nicht zu einem optimalem Design führt.'
WHERE label = 'Evolutive Entwicklung'
  AND parent_id IS NULL
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET didactic_definition = 'Das Basiskonzept Struktur und Funktion beschreibt den Sachverhalt, dass es zwischen einer Struktur und deren Funktion oft einen Zusammenhang gibt. Der Zusammenhang von Struktur und Funktion ist auf verschiedenen Systemebenen, von den Molekülen bis zur Biosphäre, relevant und gilt für Lebewesen und Lebensvorgänge.'
WHERE label = 'Struktur und Funktion'
  AND parent_id IS NULL
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET didactic_definition = 'Das Basiskonzept Steuerung und Regelung beschreibt den Sachverhalt, dass biologische Systeme viele Zustandsgrößen in Grenzen halten, auch wenn innere oder äußere Faktoren sich kurzfristig stark ändern. Dabei werden innere Zustände durch Kontroll- bzw. Regulationsmechanismen aufrechterhalten oder funktionsbezogen verändert.'
WHERE label = 'Steuerung und Regelung'
  AND parent_id IS NULL
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET didactic_definition = 'Das Basiskonzept Stoff- und Energieumwandlung beschreibt den Sachverhalt, dass biologische Systeme offene, sich selbst organisierende Systeme sind, die im ständigen Stoff- und Energieaustausch mit der Umwelt stehen. Alle Lebensprozesse benötigen Energie und laufen unter Energieumwandlungen ab. Lebewesen nehmen Stoffe auf, wandeln sie um und scheiden Stoffe wieder aus.'
WHERE label = 'Stoff- und Energieumwandlung'
  AND parent_id IS NULL
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');

UPDATE lpm_schema_elements
SET didactic_definition = 'Das Basiskonzept Information und Kommunikation beschreibt den Sachverhalt, dass Lebewesen Informationen aufnehmen, weiterleiten, verarbeiten, speichern und auf sie reagieren. Informationsaustausch und Kommunikation finden auf verschiedenen Systemebenen statt: In einem vielzelligen Organismus sind alle Organe, Gewebe, Zellen und deren Bestandteile beständig an der Kommunikation beteiligt. Auch zwischen Organismen findet Kommunikation auf vielfältige Weise statt.'
WHERE label = 'Information und Kommunikation'
  AND parent_id IS NULL
  AND project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');
