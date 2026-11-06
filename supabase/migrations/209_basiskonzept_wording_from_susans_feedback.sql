-- 209: wording changes to the Basiskonzept concept texts, from Susan Hanisch's feedback of 2026-10-30
-- (rows 00bebea8, 19caa090, 1aac170f, 1fc022f5, 4ea1e2dd, 22613921, 29bb1387, 2a2a63c5, 2f452834, 9b0602d2, 540fb04c, 830e81ed,
-- 8560116a, 57d09669, b03e28ae, cc429f89, d9f7d27a, f78e6be2, f3e4a29e, a2481d26).
--
-- Each change follows her comment. Where she gave the wording, it is hers. Where she asked for content, the text is an AI draft that
-- she has not reviewed yet: the two new sub-concepts Steuerung and Regelung, the new Gendrift and Koevolution examples, the
-- Flaschenhals example for the cheetah (two bottlenecks, after Dobrynin et al. 2015, Genome Biology), and the Life-History sentence.
--
-- Each update carries the exact old text and does nothing to a record that no longer says it, so running it twice changes nothing.
-- The same concept texts exist in the live space and its sandbox copy; both are changed. The project "evomentor" words them differently and is left alone.
SET search_path = public, extensions;

-- feedback 00bebea8: Informationsverarbeitung
UPDATE lpm_schema_elements SET definition = 'Die Aufnahme, Weiterleitung und Verarbeitung von Signalen sowie die Reaktion darauf durch ein Lebewesen oder eine seiner Teilstrukturen.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Informationsverarbeitung' AND definition = 'Die Aufnahme, Weiterleitung, Verarbeitung und Beantwortung von Signalen durch ein Lebewesen oder eine seiner Teilstrukturen.';

-- feedback 19caa090: Kommunikation zwischen Organismen
UPDATE lpm_schema_elements SET definition = 'Der Austausch von Signalen zwischen Individuen derselben oder verschiedener Arten, durch den das Verhalten des Empfängers beeinflusst wird.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Kommunikation zwischen Organismen' AND definition = 'Der Austausch von Signalen zwischen Individuen derselben oder verschiedener Arten, durch den das Verhalten des Empfängers zugunsten (meist) des Senders beeinflusst wird.';

-- feedback 1aac170f: Offene Systeme
UPDATE lpm_schema_elements SET definition = 'Systeme, die Stoffe und Energie mit ihrer Umgebung austauschen. Geschlossene Systeme tauschen nur Energie aus, isolierte Systeme weder Stoffe noch Energie.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Offene Systeme' AND definition = 'Systeme, die sowohl Stoffe als auch Energie mit ihrer Umgebung austauschen — im Gegensatz zu geschlossenen Systemen, die nur Energie, oder isolierten Systemen, die weder Stoffe noch Energie austauschen.';

-- feedback 1fc022f5 4ea1e2dd: Evolutive Entwicklung
UPDATE lpm_schema_elements SET common_misconceptions = jsonb_set(common_misconceptions, '{2,richtig}', to_jsonb('Evolution betrifft Populationen über Generationen, nicht einzelne Individuen. Körperliche Veränderungen, die ein Individuum im Lauf seines Lebens erwirbt, werden nicht genetisch vererbt. Erlernte Verhaltensweisen können dagegen durch soziales Lernen an die nächste Generation weitergegeben werden; auch das ist eine Form der Vererbung, die ohne die Gene auskommt.'::text)), updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Evolutive Entwicklung' AND common_misconceptions -> 2 ->> 'falsch' = 'Ein Individuum kann sich im Laufe seines Lebens evolutiv anpassen (Lamarckismus)' AND common_misconceptions -> 2 ->> 'richtig' = 'Evolution betrifft Populationen über Generationen, nicht Individuen; erworbene Merkmale werden nicht vererbt';

-- feedback 22613921: Koevolution
UPDATE lpm_schema_elements SET metadata = jsonb_set(metadata, '{beispiel}', to_jsonb('Blüten und ihre spezialisierten Bestäuber verändern sich über Generationen wechselseitig: Verlängert sich der Rüssel der Bestäuber, werden Blüten mit längeren Kronröhren begünstigt, und umgekehrt.'::text)), updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Koevolution' AND metadata ->> 'beispiel' = 'Blüten und ihre spezialisierten Bestäuber entwickeln passgenaue Formen aneinander angepasst.';

-- feedback 29bb1387: Evolutive Entwicklung
UPDATE lpm_schema_elements SET didactic_definition = replace(didactic_definition, 'die jedoch nicht zu einem optimalem Design führt.', 'die jedoch nicht zwangsläufig zu einem optimalen Design führt.'), updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Evolutive Entwicklung' AND didactic_definition LIKE '%die jedoch nicht zu einem optimalem Design führt.%';

-- feedback 2f452834: Variation und Diversität
UPDATE lpm_schema_elements SET metadata = jsonb_set(metadata, '{beispiel}', to_jsonb('Schneckenhäuser derselben Art unterscheiden sich in Farbe und Bänderung.'::text)), updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Variation und Diversität' AND metadata ->> 'beispiel' = 'Schneckenhäuser derselben Art unterscheiden sich in Farbe und Bänderung; Unterrichtsbezug: Artenvergleich, Erweiterung der Artenkenntnis.';

-- feedback 9b0602d2: Variation und Diversität
UPDATE lpm_schema_elements SET definition = 'Innerhalb jeder Population unterscheiden sich Individuen in ihren Merkmalen, genetisch und phänotypisch (z. B. in Körperbau, Physiologie und Verhalten). Diese Variation ist die notwendige Voraussetzung für jede Form von Selektion und damit für Evolution überhaupt.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Variation und Diversität' AND definition = 'Innerhalb jeder Population unterscheiden sich Individuen in ihren Merkmalen – genetisch, phänotypisch und im Verhalten. Diese Variation ist die notwendige Voraussetzung für jede Form von Selektion und damit für Evolution überhaupt.';

-- feedback 540fb04c: Gendrift
UPDATE lpm_schema_elements SET metadata = jsonb_set(metadata, '{beispiel}', to_jsonb('In einer kleinen Population haben zufällig nicht alle Individuen gleich viele Nachkommen. Dadurch kann eine Allelvariante allein durch Zufall seltener werden oder ganz verschwinden, ohne dass sie einen Vor- oder Nachteil hat.'::text)), updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Gendrift' AND metadata ->> 'beispiel' = 'Ein zufälliges Ereignis (z. B. ein Sturm) dezimiert eine kleine Population und verändert dadurch zufällig die Allelhäufigkeiten der Überlebenden.';

-- feedback 830e81ed: Flaschenhalseffekt
UPDATE lpm_schema_elements SET metadata = jsonb_set(metadata, '{beispiel}', to_jsonb('Geparden haben eine außergewöhnlich geringe genetische Vielfalt. Genomstudien (Dobrynin et al. 2015) schließen auf zwei Flaschenhälse: einen vor mehr als 100 000 Jahren und einen vor etwa 11 000 bis 12 600 Jahren in Afrika, zur Zeit des Aussterbens vieler großer Säugetierarten am Ende der letzten Eiszeit.'::text)), updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Flaschenhalseffekt' AND metadata ->> 'beispiel' = 'Geparden weisen aufgrund eines historischen Flaschenhalses eine außergewöhnlich geringe genetische Vielfalt auf.';

-- feedback 8560116a: Evolutionäre Entwicklungsbiologie (Evo-Devo)
UPDATE lpm_schema_elements SET definition = 'Forschungsrichtung, die untersucht, wie sich Prozesse der individuellen Entwicklung und evolutionäre Prozesse gegenseitig beeinflussen.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Evolutionäre Entwicklungsbiologie (Evo-Devo)' AND definition = 'Forschungsrichtung, die untersucht, wie Veränderungen in den genetischen Steuerungsprogrammen der individuellen Entwicklung (Ontogenese) zu evolutionären Veränderungen von Körperbauplänen führen.';

-- feedback 57d09669: Energieentwertung
UPDATE lpm_schema_elements SET definition = 'Lebewesen benötigen ständig Energie für lebenswichtige Prozesse und sind deshalb auf eine ständige Energiezufuhr angewiesen. Bei jeder Energieumwandlung in einem lebenden System geht außerdem ein Teil der Energie als nicht mehr nutzbare Wärme verloren.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Energieentwertung' AND definition = 'Bei jeder Energieumwandlung in einem lebenden System geht ein Teil der Energie als nicht mehr nutzbare Wärme verloren, weshalb Lebewesen auf eine ständige Energiezufuhr angewiesen sind.';

-- feedback b03e28ae: negative Rückkopplung
UPDATE lpm_schema_elements SET definition = 'Ein Regelkreis, bei dem die Abweichung eines Zustands von seinem Sollwert eine Gegenreaktion auslöst, welche die Abweichung verringert und den Zustand stabilisiert. Durch negative Rückkopplungen werden Fließgleichgewichte aufrechterhalten.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'negative Rückkopplung' AND definition = 'Ein Regelkreis, bei dem die Abweichung eines Zustands von seinem Sollwert eine Gegenreaktion auslöst, welche die Abweichung verringert und den Zustand stabilisiert.';

-- feedback cc429f89: Fließgleichgewicht
UPDATE lpm_schema_elements SET definition = 'Ein für offene, lebende Systeme charakteristischer Zustand, der auch dynamisches Gleichgewicht genannt wird: Zu- und Abfluss von Stoffen und Energie halten sich die Waage, sodass innere Zustandsgrößen konstant bleiben, obwohl fortlaufend Materie und Energie durch das System hindurchfließen. Ein geschlossenes System strebt dagegen einem statischen Gleichgewicht zu.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Fließgleichgewicht' AND definition = 'Ein für offene, lebende Systeme charakteristischer Zustand, in dem sich Zu- und Abfluss von Stoffen und Energie die Waage halten, sodass innere Zustandsgrößen konstant bleiben, obwohl fortlaufend Materie und Energie durch das System hindurchfließen — im Unterschied zu einem geschlossenen System, das einem statischen Gleichgewicht zustrebt.';

-- feedback d9f7d27a: energetische Kopplung
UPDATE lpm_schema_elements SET definition = 'Die Kopplung einer energieliefernden (exergonen) an eine energieverbrauchende (endergone) Reaktion, sodass die freigesetzte Energie den sonst nicht von selbst ablaufenden Prozess antreibt.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'energetische Kopplung' AND definition = 'Die Kopplung einer energieliefernden (exergonen) an eine energieverbrauchende (endergone) Reaktion, sodass die freigesetzte Energie den sonst nicht freiwillig ablaufenden Prozess antreibt.';

-- feedback f78e6be2: Sexuelle Selektion
UPDATE lpm_schema_elements SET definition = 'Selektion, die auf Unterschieden im Paarungserfolg beruht und damit beeinflusst, welche Merkmale an die nächste Generation weitergegeben werden; sie wirkt über innergeschlechtliche Konkurrenz um Paarungspartner (z. B. Rivalenkämpfe) und über zwischengeschlechtliche Partnerwahl (z. B. auffällige Balzmerkmale).', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Sexuelle Selektion' AND definition = 'Eine Form der Selektion, bei der nicht das Überleben, sondern der Fortpflanzungserfolg entscheidet, welche Merkmale an die nächste Generation weitergegeben werden; sie wirkt über innergeschlechtliche Konkurrenz um Paarungspartner (z. B. Rivalenkämpfe) und über zwischengeschlechtliche Partnerwahl (z. B. auffällige Balzmerkmale).';

-- feedback f3e4a29e: Nischenkonstruktion
UPDATE lpm_schema_elements SET definition = 'Organismen verändern aktiv ihre Umwelt und damit die Selektionsbedingungen für sich selbst, ihre Nachkommen und andere Arten.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Nischenkonstruktion' AND definition = 'Organismen verändern aktiv ihre Umwelt und damit die Selektionsbedingungen für sich selbst und andere Arten.';

-- feedback a2481d26: Lebensgeschichte / Life-History-Theorie
UPDATE lpm_schema_elements SET definition = 'Theorie über die evolutionäre Optimierung des zeitlichen Ablaufs von Wachstum, Fortpflanzung und Alterung eines Organismus unter begrenzten Ressourcen. Wegen der Ressourcenknappheit ergeben sich in jedem Entwicklungsstadium Trade-offs, z. B. zwischen der Anzahl und der Investition pro Nachkomme.', updated_at = now()
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')) AND label = 'Lebensgeschichte / Life-History-Theorie' AND definition = 'Theorie über die evolutionäre Optimierung des zeitlichen Ablaufs von Wachstum, Fortpflanzung und Alterung eines Organismus unter begrenzten Ressourcen (Trade-off zwischen Anzahl und Investition pro Nachkommen).';

-- feedback 2a2a63c5: new sub-concept Steuerung under Steuerung und Regelung
INSERT INTO lpm_schema_elements (project_id, element_type, label, definition, parent_id, metadata, status)
SELECT p.id, 'concept', 'Steuerung', 'Ein Ablauf, bei dem eine Eingangsgröße eine Wirkung auslöst, ohne dass das Ergebnis zurückgemeldet und mit einem Sollwert verglichen wird (offener Wirkungsablauf, keine Rückkopplung).', par.id, '{"beispiel": "Beim Kniesehnenreflex löst der Reiz über den Reflexbogen eine Muskelkontraktion aus; das Ergebnis wird nicht mit einem Sollwert verglichen. Ein Lichtschalter schaltet die Lampe ein, ohne zu prüfen, ob es hell genug ist.", "language": "de", "source": "susan_feedback_2026_10_30_ai_draft_unreviewed"}'::jsonb, 'accepted'
FROM projects p JOIN lpm_schema_elements par ON par.project_id = p.id AND par.label = 'Steuerung und Regelung' AND par.parent_id IS NULL
WHERE p.slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')
  AND NOT EXISTS (SELECT 1 FROM lpm_schema_elements x WHERE x.project_id = p.id AND x.parent_id = par.id AND x.label = 'Steuerung');

-- feedback 2a2a63c5: new sub-concept Regelung under Steuerung und Regelung
INSERT INTO lpm_schema_elements (project_id, element_type, label, definition, parent_id, metadata, status)
SELECT p.id, 'concept', 'Regelung', 'Ein Ablauf, bei dem eine Größe (Istwert) gemessen, mit einem Sollwert verglichen und bei einer Abweichung durch eine Gegenreaktion korrigiert wird (geschlossener Wirkungskreis mit Rückkopplung).', par.id, '{"beispiel": "Ein Thermostat vergleicht die Raumtemperatur mit dem Sollwert und heizt bei Abweichung nach. Beim Menschen hält die Regelung die Körpertemperatur bei etwa 37 °C: Steigt sie, wird durch Schwitzen Wärme abgegeben.", "language": "de", "source": "susan_feedback_2026_10_30_ai_draft_unreviewed"}'::jsonb, 'accepted'
FROM projects p JOIN lpm_schema_elements par ON par.project_id = p.id AND par.label = 'Steuerung und Regelung' AND par.parent_id IS NULL
WHERE p.slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox')
  AND NOT EXISTS (SELECT 1 FROM lpm_schema_elements x WHERE x.project_id = p.id AND x.parent_id = par.id AND x.label = 'Regelung');
