-- 232: Susan's feedback of 2026-11-07 that needs data changes.
--
--   * f5ed6756: the project is called "EvoMentor Thüringen" (it was "EvoMentor Thuringia").
--   * 5617dfba: the word "echt/echte" goes everywhere. The project description (it also still said "305 Lernziele") and 19 learning-goal
--     and concept texts are reworded; the same texts exist in the sandbox copy and are changed the same way.
--   * 8629777e: the goal "Biotische Wechselbeziehung: Konkurrenz" (grade 9) had no concept mapping yet. This adds an AI draft with Evolution
--     rated high (3, Susan's suggestion), the other five Basiskonzepte, and three didactic methods. No expert has checked it.
--
-- Every UPDATE only changes text that still contains the exact old words, so a later human edit is never overwritten and running this twice
-- changes nothing. The goals are found by title and space, because the sandbox has its own ids.
SET search_path = public, extensions;

-- ===== Project name and description =====
UPDATE projects SET name = 'EvoMentor Thüringen'
WHERE slug = 'evomentor-thuringia' AND name = 'EvoMentor Thuringia';

UPDATE projects SET description = $d$Thüringer Biologie-/MNT-Lehrplan für die Klassenstufen 5 bis 10, mit Evolution als verbindendem rotem Faden (Kohärenzfäden-Methodik). Die Lernziele wurden zuletzt am 12.09.2026 mit den Änderungen aus der Thüringer Erprobungsfassung 2026 abgeglichen (in Kraft seit 01.08.2026, noch nicht endgültig verabschiedet). Ein regionales Projekt im Rahmen von EvoMentor mit eigenem Bereich.$d$
WHERE slug = 'evomentor-thuringia'
  AND description = $d$Echter Thüringer Biologie-/MNT-Lehrplan für die Klassenstufen 5 bis 10, mit Evolution als verbindendem roten Faden (Kohärenzfäden-Methodik). 305 echte Lernziele, zuletzt am 12.09.2026 mit den echten Änderungen aus der Thüringer Erprobungsfassung 2026 abgeglichen (in Kraft seit 01.08.2026, noch nicht endgültig verabschiedet). Ein echtes regionales Projekt im Rahmen von EvoMentor -- ein eigener Bereich, kein Fork und kein Gedankenexperiment.$d$;

UPDATE projects SET description = $d$Testbereich für synthetische (KI-erzeugte) Studierende. Abbild des Bereichs EvoMentor Thüringen. Hier arbeiten keine Studierenden; nichts aus diesem Bereich ist Studierendenarbeit.$d$
WHERE slug = 'evomentor-thuringia-sandbox'
  AND description = $d$Testbereich für synthetische (KI-erzeugte) Studierende. Abbild des Bereichs EvoMentor Thüringen. Hier arbeiten keine echten Studierenden; nichts aus diesem Bereich ist Studierendenarbeit.$d$;

-- ===== The word "echt" in learning-goal and concept texts (live space and sandbox) =====
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$(echte Segmentierung)$o$, $n$(Segmentierung)$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%(echte Segmentierung)%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$an echten Exemplaren$o$, $n$an Exemplaren$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%an echten Exemplaren%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$an echten, über Wochen beobachtbaren Pflanzen$o$, $n$an lebenden, über Wochen beobachtbaren Pflanzen$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%an echten, über Wochen beobachtbaren Pflanzen%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$einen echten evolutionsbiologischen$o$, $n$einen evolutionsbiologischen$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%einen echten evolutionsbiologischen%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$eines echten Endoskeletts$o$, $n$eines Endoskeletts$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%eines echten Endoskeletts%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$eines echten Zellkerns$o$, $n$eines Zellkerns$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%eines echten Zellkerns%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$eines echten, membranumhüllten Zellkerns$o$, $n$eines membranumhüllten Zellkerns$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%eines echten, membranumhüllten Zellkerns%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,0,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,0,begruendung}', $o$von echten Geweben mit$o$, $n$von Geweben mit$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,0,begruendung}' LIKE $l$%von echten Geweben mit%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,2,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,2,begruendung}', $o$zu echter Vielzelligkeit$o$, $n$zu Vielzelligkeit$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,2,begruendung}' LIKE $l$%zu echter Vielzelligkeit%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,3,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,3,begruendung}', $o$ein einfaches, aber echtes Regelungsbeispiel$o$, $n$ein einfaches Regelungsbeispiel$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,3,begruendung}' LIKE $l$%ein einfaches, aber echtes Regelungsbeispiel%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,3,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,3,begruendung}', $o$etwa echte Thermoregulation$o$, $n$etwa Thermoregulation$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,3,begruendung}' LIKE $l$%etwa echte Thermoregulation%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug,3,begruendung}', to_jsonb(replace(content #>> '{basiskonzeptbezug,3,begruendung}', $o$unterscheidet echte Symbiose von$o$, $n$unterscheidet Symbiose von$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{basiskonzeptbezug,3,begruendung}' LIKE $l$%unterscheidet echte Symbiose von%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{didaktische_strategien,evolutionsdidaktischer_impuls}', to_jsonb(replace(content #>> '{didaktische_strategien,evolutionsdidaktischer_impuls}', $o$Merkmale echte Verwandtschaft anzeigen$o$, $n$Merkmale Verwandtschaft anzeigen$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{didaktische_strategien,evolutionsdidaktischer_impuls}' LIKE $l$%Merkmale echte Verwandtschaft anzeigen%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{didaktische_strategien,moegliche_fehlvorstellungen}', to_jsonb(replace(content #>> '{didaktische_strategien,moegliche_fehlvorstellungen}', $o$an der echten Blüte$o$, $n$an der Blüte selbst$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{didaktische_strategien,moegliche_fehlvorstellungen}' LIKE $l$%an der echten Blüte%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{didaktische_strategien,moegliche_fehlvorstellungen}', to_jsonb(replace(content #>> '{didaktische_strategien,moegliche_fehlvorstellungen}', $o$an echtem Material$o$, $n$am Originalmaterial$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{didaktische_strategien,moegliche_fehlvorstellungen}' LIKE $l$%an echtem Material%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{didaktische_strategien,top3_methoden,0,beschreibung}', to_jsonb(replace(content #>> '{didaktische_strategien,top3_methoden,0,beschreibung}', $o$Echte Knochen oder Abbildungen$o$, $n$Knochenpräparate oder Abbildungen$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{didaktische_strategien,top3_methoden,0,beschreibung}' LIKE $l$%Echte Knochen oder Abbildungen%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{didaktische_strategien,top3_methoden,0,beschreibung}', to_jsonb(replace(content #>> '{didaktische_strategien,top3_methoden,0,beschreibung}', $o$Ein echter Fisch$o$, $n$Ein lebender Fisch$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{didaktische_strategien,top3_methoden,0,beschreibung}' LIKE $l$%Ein echter Fisch%$l$;
UPDATE lpm_data_objects SET content = jsonb_set(content, '{note_2015_baseline}', to_jsonb(replace(content #>> '{note_2015_baseline}', $o$-- echte neue inhaltliche$o$, $n$-- neue inhaltliche$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND content #>> '{note_2015_baseline}' LIKE $l$%-- echte neue inhaltliche%$l$;
UPDATE lpm_schema_elements SET metadata = jsonb_set(metadata, '{beispiel}', to_jsonb(replace(metadata #>> '{beispiel}', $o$zwischen Einzeller und echtem Vielzeller$o$, $n$zwischen Einzeller und Vielzeller$n$)))
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND metadata #>> '{beispiel}' LIKE $l$%zwischen Einzeller und echtem Vielzeller%$l$;

-- ===== Konkurrenz: AI draft of the concept mapping (feedback 8629777e) =====
UPDATE lpm_data_objects SET content = content || $k${"basiskonzeptbezug": [{"basiskonzept_id": "bk_evolutive_entwicklung", "relevanz_beurteilung": 3, "begruendung": "Konkurrenz entsteht, weil Ressourcen wie Nahrung, Licht, Wasser oder Brutplätze begrenzt sind und Individuen mehr Nachkommen hervorbringen, als überleben können. Unterschiede zwischen den Individuen entscheiden dann mit darüber, wie viele Nachkommen sie hinterlassen. Das ist ein Kernmechanismus der natürlichen Selektion. Innerartliche Konkurrenz wirkt zwischen Individuen derselben Art. Zwischenartliche Konkurrenz kann über viele Generationen dazu führen, dass Arten verschiedene Ressourcen nutzen und sich so die Konkurrenz teilweise entziehen. Das Konkurrenzausschlussprinzip zeigt, dass zwei Arten mit gleichen Ansprüchen auf Dauer nicht am selben Ort bestehen. Für den Unterricht ergänzt Konkurrenz die Symbiose: Beide Beziehungsformen wirken auf die Entwicklung von Arten.", "relevante_teilkonzepte": [], "relevante_evolutionskonzepte": ["Natürliche Selektion und Selektionsdruck", "Fitness"], "relevante_unterkonzepte_taxonomie": [], "relevante_evolutionskonzepte_taxonomie": []}, {"basiskonzept_id": "bk_individuelle_entwicklung", "relevanz_beurteilung": 1, "begruendung": "Kein Schwerpunkt auf der Entwicklung eines einzelnen Organismus. Konkurrenz um Licht oder Nahrung kann das Wachstum eines Individuums beeinflussen, das Lernziel fragt aber nach der Wechselbeziehung zwischen Organismen.", "relevante_teilkonzepte": [], "relevante_unterkonzepte_taxonomie": [], "relevante_evolutionskonzepte_taxonomie": []}, {"basiskonzept_id": "bk_struktur_funktion", "relevanz_beurteilung": 2, "begruendung": "Wie erfolgreich ein Individuum im Wettbewerb ist, hängt auch von Bau und Funktion seiner Organe ab, etwa vom Wurzelsystem und der Blattstellung bei Pflanzen oder von Schnabelform und Gebiss bei Tieren. Unterschiedliche Bauweisen erlauben es Arten, verschiedene Ressourcen zu nutzen. Das Lernziel verlangt vor allem, die Wechselbeziehung zu erläutern. Bau und Funktion liefern dafür Beispiele, deshalb ist die Relevanz mittel.", "relevante_teilkonzepte": [], "relevante_unterkonzepte_taxonomie": [], "relevante_evolutionskonzepte_taxonomie": []}, {"basiskonzept_id": "bk_steuerung_regelung", "relevanz_beurteilung": 2, "begruendung": "Konkurrenz gehört zu den dichteabhängigen Faktoren, die Populationsgrößen begrenzen: Je mehr Individuen um dieselben Ressourcen konkurrieren, desto stärker sinken Wachstum und Fortpflanzung. Dieser Rückkopplungszusammenhang hält Populationen bei einer Größe, die die Umwelt tragen kann. Das Lernziel nennt die Regelung nicht ausdrücklich, deshalb ist die Relevanz mittel.", "relevante_teilkonzepte": [], "relevante_unterkonzepte_taxonomie": [], "relevante_evolutionskonzepte_taxonomie": []}, {"basiskonzept_id": "bk_stoff_energie_umwandlung", "relevanz_beurteilung": 2, "begruendung": "Im Mittelpunkt der Konkurrenz stehen begrenzte Stoffe und Energiequellen: Licht für die Fotosynthese, Wasser und Mineralstoffe, Nahrung. Wer mehr davon aufnehmen kann, hat mehr Material und Energie für Wachstum und Fortpflanzung. Der Stoff- und Energiebezug erklärt, worum konkurriert wird. Das Lernziel selbst fragt nach der Wechselbeziehung, deshalb ist die Relevanz mittel.", "relevante_teilkonzepte": [], "relevante_unterkonzepte_taxonomie": [], "relevante_evolutionskonzepte_taxonomie": []}, {"basiskonzept_id": "bk_information_kommunikation", "relevanz_beurteilung": 1, "begruendung": "Kein Schwerpunkt auf Informationsverarbeitung oder Kommunikation. Reviermarkierungen oder Drohsignale sind mögliche Beispiele, das Lernziel verlangt sie aber nicht.", "relevante_teilkonzepte": [], "relevante_unterkonzepte_taxonomie": [], "relevante_evolutionskonzepte_taxonomie": []}], "basiskonzepte_primaer": ["bk_evolutive_entwicklung"], "basiskonzepte_sekundaer": ["bk_steuerung_regelung", "bk_stoff_energie_umwandlung"], "didaktische_strategien": {"top3_methoden": [{"rang": 1, "favorit": false, "methode": "Modelle und Simulationen", "beschreibung": "Simulation zweier Arten mit gleichen Ansprüchen (Konkurrenzausschlussprinzip), zum Beispiel mit einem Computermodell oder einem Würfelspiel mit begrenzten Ressourcen."}, {"rang": 2, "favorit": false, "methode": "Forschendes Lernen", "beschreibung": "Keimversuch mit unterschiedlicher Saatdichte (Kresse): Wie verändern sich Wachstum und Überleben, wenn dieselbe Fläche, dasselbe Licht und dasselbe Wasser für mehr Pflanzen reichen müssen?"}, {"rang": 3, "favorit": false, "methode": "Analogien und Vergleiche", "beschreibung": "Vergleich von innerartlicher und zwischenartlicher Konkurrenz an Beispielen (Kohlmeise und Blaumeise, Eichen- und Buchenwald)."}], "bezug_zum_lehrplan_kontext": "Weitere biotische Wechselbeziehung neben Symbiose und Parasitismus. Sie führt von der Beschreibung der Beziehungsformen zur Frage, warum Arten ihre Nischen so aufteilen.", "moegliche_fehlvorstellungen": "Schüler:innen stellen sich Konkurrenz oft als direkten Kampf zwischen Individuen vor. Meist konkurrieren Organismen aber indirekt, indem sie dieselbe begrenzte Ressource nutzen, ohne sich zu begegnen. Häufig wird auch angenommen, dass der Stärkere gewinnt. Entscheidend ist, wer unter den gegebenen Umweltbedingungen mehr Nachkommen hinterlässt.", "evolutionsdidaktischer_impuls": "Leitfrage: Warum können zwei Arten mit sehr ähnlichen Ansprüchen auf Dauer nicht am selben Ort bestehen, und was geschieht über viele Generationen, wenn sie es doch versuchen?"}, "_authoring_status": "KI-Entwurf vom 2026-11-07: Zuordnung zu den Basiskonzepten und didaktische Methoden warten auf Susans Prüfung.", "ki_entwurf": {"basiskonzepte_erstellt": "2026-11-07", "feedback": "8629777e"}}$k$::jsonb
WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND title = 'Biotische Wechselbeziehung: Konkurrenz'
  AND grade_band = '9'
  AND status = 'accepted'
  AND NOT (content ? 'basiskonzeptbezug');

-- Rollback: the project name and texts above can be set back to the old words listed in each UPDATE; for Konkurrenz,
--   UPDATE lpm_data_objects SET content = content - 'basiskonzeptbezug' - 'basiskonzepte_primaer' - 'basiskonzepte_sekundaer' - 'didaktische_strategien' - 'ki_entwurf'
--   WHERE title = 'Biotische Wechselbeziehung: Konkurrenz' AND content ? 'ki_entwurf';
