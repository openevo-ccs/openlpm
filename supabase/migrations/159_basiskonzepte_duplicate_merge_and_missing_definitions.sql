-- Real feedback (Susan, 2026-10-21, rows a5f04405/310b6384/7f4080fe/a09bcea5):
-- several Basiskonzepte sub-concept tags on the Detail tab render greyed
-- out with "Noch keine Beschreibung hinterlegt" even though a real,
-- written definition exists for the SAME concept elsewhere in this
-- project's own taxonomy.
--
-- Root cause, confirmed directly against live data: a handful of
-- sub-concepts are legitimately tagged under two different parent
-- Basiskonzepte (a concept really can relate to more than one), but only
-- one of the two copies ever got a real definition written. The other
-- copy -- a distinct row, its own id -- sits empty and renders as a dead
-- tag. "Anpassung und Angepasstheit" (screenshotted by Susan under
-- Struktur und Funktion) has real content under its Evolutive-Entwicklung
-- copy; "Fließgleichgewicht" has real content under its
-- Stoff-/Energieumwandlung copy but is empty under Steuerung und Regelung.
-- Fixed by copying the real definition across, not deleting either copy --
-- both parent associations are real curriculum content, only the data was
-- incomplete.
--
-- Separately, a live check of every one of this project's own sub-concept
-- rows found 15 more that have never had a definition written at all (not
-- duplicates -- genuinely new content). These are standard
-- biology/biology-didactics concepts named directly in the Thüringen MNT/
-- Biologie curriculum's own Basiskonzepte framework; definitions below are
-- AI-drafted to match this project's existing style (1-2 sentence
-- definition + one concrete Beispiel), same discipline as the already-live
-- rows -- not yet reviewed by a subject-matter expert. Flagged to Susan/
-- Dustin for review, same as any other AI-drafted curriculum content in
-- this project.

-- ---- Duplicate-content merge ----
UPDATE lpm_schema_elements
SET definition = 'Merkmale, die durch natürliche Selektion entstanden sind, weil sie das Überleben oder den Fortpflanzungserfolg in einer bestimmten Umwelt erhöht haben.',
    metadata = metadata || '{"beispiel":"Das Fell des Eisbären als Anpassung an arktische Kälte."}'::jsonb
WHERE id = '4f68d0c0-d7e4-4ceb-97d2-330f10713d60'::uuid;

UPDATE lpm_schema_elements
SET definition = 'Ein für offene, lebende Systeme charakteristischer Zustand, in dem sich Zu- und Abfluss von Stoffen und Energie die Waage halten, sodass innere Zustandsgrößen konstant bleiben, obwohl fortlaufend Materie und Energie durch das System hindurchfließen — im Unterschied zu einem geschlossenen System, das einem statischen Gleichgewicht zustrebt.',
    metadata = metadata || '{"beispiel":"Der Wassergehalt des menschlichen Körpers bleibt trotz ständiger Wasseraufnahme und -abgabe nahezu konstant, weil Zufuhr und Ausscheidung fortlaufend aneinander angeglichen werden."}'::jsonb
WHERE id = '52df2759-22a0-44c1-bad9-bdbae69a8c11'::uuid;

-- ---- Genuinely new definitions (15 real gaps) ----
UPDATE lpm_schema_elements SET definition = 'Die Kopplung einer energieliefernden (exergonen) an eine energieverbrauchende (endergone) Reaktion, sodass die freigesetzte Energie den sonst nicht freiwillig ablaufenden Prozess antreibt.',
  metadata = metadata || '{"beispiel":"Die Hydrolyse von ATP liefert die Energie, die an den Aufbau komplexer Moleküle wie Proteine gekoppelt ist."}'::jsonb
WHERE id = 'a4fea8b0-1264-43c8-ab4c-ce962327d26a'::uuid;

UPDATE lpm_schema_elements SET definition = 'Bei jeder Energieumwandlung in einem lebenden System geht ein Teil der Energie als nicht mehr nutzbare Wärme verloren, weshalb Lebewesen auf eine ständige Energiezufuhr angewiesen sind.',
  metadata = metadata || '{"beispiel":"Nur ein Bruchteil der mit der Nahrung aufgenommenen Energie steht einem Organismus tatsächlich für Wachstum zur Verfügung, der Rest wird als Wärme abgegeben."}'::jsonb
WHERE id = '59dd49f3-1858-4891-bbd8-92c7a008c2af'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Aufnahme, Weiterleitung, Verarbeitung und Beantwortung von Signalen durch ein Lebewesen oder eine seiner Teilstrukturen.',
  metadata = metadata || '{"beispiel":"Das Gehirn verarbeitet Sinnesreize und löst darauf abgestimmte Reaktionen aus."}'::jsonb
WHERE id = 'c6c8fd2d-6987-447f-9b0c-e86c10084ec5'::uuid;

UPDATE lpm_schema_elements SET definition = 'Ein Regelkreis, bei dem die Abweichung eines Zustands von seinem Sollwert eine Gegenreaktion auslöst, welche die Abweichung verringert und den Zustand stabilisiert.',
  metadata = metadata || '{"beispiel":"Steigt die Körpertemperatur über den Sollwert, wird durch Schwitzen Wärme abgegeben, bis die Temperatur wieder sinkt."}'::jsonb
WHERE id = '3681e72e-4710-41da-9ccb-046628762706'::uuid;

UPDATE lpm_schema_elements SET definition = 'Systeme, die sowohl Stoffe als auch Energie mit ihrer Umgebung austauschen — im Gegensatz zu geschlossenen Systemen, die nur Energie, oder isolierten Systemen, die weder Stoffe noch Energie austauschen.',
  metadata = metadata || '{"beispiel":"Ein Lebewesen nimmt ständig Nahrung und Sauerstoff auf und gibt Stoffwechselendprodukte sowie Wärme ab."}'::jsonb
WHERE id = '5ff075a2-7b3d-4a93-bae7-d75b78a9127b'::uuid;

UPDATE lpm_schema_elements SET definition = 'Ein Regelkreis, bei dem eine Abweichung vom Ausgangszustand eine Reaktion auslöst, die diese Abweichung verstärkt, statt sie auszugleichen.',
  metadata = metadata || '{"beispiel":"Bei der Geburt verstärken Wehen die Ausschüttung von Oxytocin, was wiederum die Wehen verstärkt, bis das Kind geboren ist."}'::jsonb
WHERE id = '3e44a913-ee29-460c-9966-a383349ac270'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Fähigkeit eines Lebewesens, Veränderungen seiner Umwelt wahrzunehmen und mit einer angepassten Verhaltens- oder Stoffwechselreaktion darauf zu reagieren.',
  metadata = metadata || '{"beispiel":"Pflanzen richten ihre Blätter nach der Lichtquelle aus (Phototropismus)."}'::jsonb
WHERE id = '8a6b4be3-8942-479b-942f-8fb11bfb7b50'::uuid;

UPDATE lpm_schema_elements SET definition = 'Der wiederholte Durchlauf von Stoffen (z. B. Kohlenstoff, Stickstoff, Wasser) durch Organismen und ihre unbelebte Umgebung, im Unterschied zum gerichteten Energiefluss, der ein Ökosystem letztlich als Wärme verlässt.',
  metadata = metadata || '{"beispiel":"Kohlenstoff gelangt durch Photosynthese in Pflanzen, wird über die Nahrungskette weitergegeben und durch Atmung oder Verwesung wieder als CO2 freigesetzt."}'::jsonb
WHERE id = 'a6c1d105-286c-4240-9db6-9c1851ee30fc'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Übersetzung einer Information in ein übertragbares Signal (Codierung) und ihre Rückübersetzung in eine für den Empfänger nutzbare Form (Decodierung).',
  metadata = metadata || '{"beispiel":"Die Basensequenz der DNA wird bei der Proteinbiosynthese in eine Aminosäuresequenz übersetzt (decodiert)."}'::jsonb
WHERE id = 'e3e511e0-2950-4026-a57e-442c206f75a7'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Weitergabe von Veränderungen in der Genaktivität (z. B. durch chemische Markierungen der DNA), ohne dass sich die DNA-Sequenz selbst ändert — oft durch Umwelteinflüsse ausgelöst und teils über Zellteilungen oder Generationen hinweg weitergegeben.',
  metadata = metadata || '{"beispiel":"Ernährungsbedingungen der Mutter während der Schwangerschaft können die Genaktivität des Kindes epigenetisch beeinflussen."}'::jsonb
WHERE id = 'fe794c62-8a4e-4b54-9221-5e4107d2ef8b'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Weitergabe von Merkmalen von einer Generation zur nächsten über die in der DNA codierte genetische Information.',
  metadata = metadata || '{"beispiel":"Die Augenfarbe eines Kindes wird durch die von beiden Elternteilen geerbten Genvarianten bestimmt."}'::jsonb
WHERE id = '5851bfb6-38a1-46dc-80ea-e97b2d142f2f'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Aufrechterhaltung eines stabilen inneren Milieus eines Organismus (z. B. Temperatur, pH-Wert, Blutzuckerspiegel) trotz wechselnder äußerer Bedingungen, meist durch negative Rückkopplung erreicht.',
  metadata = metadata || '{"beispiel":"Der Blutzuckerspiegel wird durch das Zusammenspiel von Insulin und Glukagon innerhalb enger Grenzen konstant gehalten."}'::jsonb
WHERE id = '2f3ef1ab-5882-4720-afee-1f48c05bb6ec'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Weitergabe einer von vorangehenden Generationen veränderten Umwelt (z. B. eines Lebensraums oder einer Ressource) an nachfolgende Generationen, unabhängig von genetischer oder sozialer Weitergabe.',
  metadata = metadata || '{"beispiel":"Biber verändern durch den Bau von Dämmen ihren Lebensraum so nachhaltig, dass nachfolgende Bibergenerationen in dieser veränderten Umwelt aufwachsen (Nischenkonstruktion)."}'::jsonb
WHERE id = 'e32cd062-e674-46d4-91cd-86541a4a32f5'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Umwandlung eines von außen auf eine Zelle einwirkenden Signals (z. B. eines Hormons) in eine innerzelluläre Reaktion, meist über eine Kaskade von Molekülen.',
  metadata = metadata || '{"beispiel":"Bindet Adrenalin an einen Rezeptor der Zellmembran, löst dies über eine Signalkaskade die Freisetzung von Glukose aus Glykogenspeichern aus."}'::jsonb
WHERE id = '876b0ce3-b903-4bcc-9364-382a7ceae31e'::uuid;

UPDATE lpm_schema_elements SET definition = 'Die Weitergabe von Verhaltensweisen, Fertigkeiten oder Wissen zwischen Individuen durch Beobachtung, Nachahmung oder Lehren, unabhängig von genetischer Vererbung.',
  metadata = metadata || '{"beispiel":"Schimpansen lernen den Gebrauch von Werkzeugen zum Termitenangeln von älteren Gruppenmitgliedern."}'::jsonb
WHERE id = 'df02b3b0-a83a-49e6-9834-f6e799d4d576'::uuid;

-- Real feedback (Susan, 2026-10-21, rows f2b5f676 + 20714c6a): these two
-- Lernziele's wording had drifted from the primary curriculum document,
-- same wording-drift pattern already fixed for 5 other rows in migration
-- 153. Corrected to Susan's exact quoted text (she is working directly
-- from the official document). Only description/content.originaltext
-- change -- every other field (basiskonzeptbezug reasoning, didactic
-- strategies, etc.) is untouched and still describes the same real
-- learning goal.
UPDATE lpm_data_objects
SET description = 'den Bau von Blüten beschreiben, vergleichen – Formenvielfalt, gleiche Teile (Kelchblätter, Kronblätter, Staubblätter, Fruchtblätter)',
    content = jsonb_set(content, '{originaltext}', '"den Bau von Blüten beschreiben, vergleichen – Formenvielfalt, gleiche Teile (Kelchblätter, Kronblätter, Staubblätter, Fruchtblätter)"'::jsonb)
WHERE id = 'b4f4976a-06d2-5886-8934-4ef6446e797f'::uuid;

UPDATE lpm_data_objects
SET description = 'ungeschlechtliche und geschlechtliche Fortpflanzung vergleichen: Unterschiede – geschlechtliche Fortpflanzung (Befruchtung einer Eizelle), ungeschlechtliche Fortpflanzung (ohne Befruchtung, z. B. Stecklinge); Gemeinsamkeit – Erzeugung von Nachkommen',
    content = jsonb_set(content, '{originaltext}', '"ungeschlechtliche und geschlechtliche Fortpflanzung vergleichen: Unterschiede – geschlechtliche Fortpflanzung (Befruchtung einer Eizelle), ungeschlechtliche Fortpflanzung (ohne Befruchtung, z. B. Stecklinge); Gemeinsamkeit – Erzeugung von Nachkommen"'::jsonb)
WHERE id = 'd7934092-7129-541e-b4b5-631e42b700e6'::uuid;
