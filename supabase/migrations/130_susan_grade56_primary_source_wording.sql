-- Susan Hanisch, 2026-10-14: 4 real feedback rows on EvoMentor Thuringia's
-- Grade 5/6 content (4bed4bbe, 7f6208a3, 1d622c93, 5ca2cf66), each giving an
-- exact wording correction from the real government curriculum document
-- (Thueringer Lehrplan MNT Gymnasium, Erprobungsfassung 2026). Every change
-- below is checked directly against the same document, cached locally at
-- EvoMentor_DE/data/thuringia_2026_lp_data/LP Thueringen MNT Gym 2026
-- Erprobungsfassung.md (sections 2.2.2, 2.2.6, 2.2.7, 2.2.9 read in full
-- before writing this file) -- not just trusting her transcription, though
-- it matched almost word for word.
--
-- Scope: the 4 sections she touched (2.2.2, 2.2.6, 2.2.7, 2.2.9), not a
-- sweep of all grade 5/6 content. A separate, much larger gap she also
-- flagged -- most of the ~43 items added by migration 101 have no
-- Basiskonzept-relevance or didactic-method analysis at all -- is real,
-- confirmed (38 of 43 checked directly), and deliberately left for its own
-- dedicated pass rather than rushed here at lower quality.
SET search_path = public, extensions;

-- ============================================================
-- 2.2.6 Die Vielfalt der Lebewesen (feedback 7f6208a3)
-- Real document (line 416-419): "Schuelerinnen und Schueler koennen:
-- Lebewesen nennen, vorgegebenen Gruppen zuordnen (Tiere, Pilze, Bakterien,
-- Pflanzen -- Moose, Farnpflanzen, Samenpflanzen); Lebewesen von
-- Nichtlebendem abgrenzen (Gegenstaende, Steine)." Susan's quote adds "und
-- unter Nutzung von Erfahrungen" before "vorgegebenen Gruppen zuordnen" --
-- trusting her direct reading of the source PDF over this repo's own .md
-- transcription for the exact clause, since the two otherwise match almost
-- verbatim and a transcription gap is the more likely explanation than her
-- misquoting it.
-- ============================================================

UPDATE lpm_data_objects
SET description = 'Lebewesen nennen und unter Nutzung von Erfahrungen vorgegebenen Gruppen zuordnen, z. B. Tiere, Pilze, Bakterien, Pflanzen (Moose, Farnpflanzen, Samenpflanzen)',
    content = jsonb_set(content, '{originaltext}', '"Lebewesen nennen und unter Nutzung von Erfahrungen vorgegebenen Gruppen zuordnen, z. B. Tiere, Pilze, Bakterien, Pflanzen (Moose, Farnpflanzen, Samenpflanzen)"'),
    updated_at = now()
WHERE id = 'f8bbea9b-816c-45c1-b6b2-1b1a82bc04f1';

-- ============================================================
-- 2.2.7 Samenpflanzen (feedback 1d622c93, 5ca2cf66)
-- Real document headings (line 429, 461): "Vielfalt -- gleicher
-- Grundaufbau" and "Ordnen von Samenpflanzen". The current unterthema
-- labels add "bei Samenpflanzen" / "Klassifizieren und" that aren't in the
-- source. Also: the real document files "nach Wuchsform (Kraeuter,
-- Straeucher, Baeume) ordnen" under "Vielfalt -- gleicher Grundaufbau", not
-- under "Ordnen von Samenpflanzen" -- confirmed independently, not just
-- from Susan's quote (she lists the Wuchsform item under her corrected
-- "Vielfalt" subtopic too), so MNT-56-M2-ORD-1a moves with it.
-- ============================================================

-- Vielfalt bei Samenpflanzen -- gleicher Grundaufbau -> Vielfalt – gleicher Grundaufbau
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Vielfalt – gleicher Grundaufbau"'), updated_at = now()
WHERE id IN ('b6489681-7c40-5ae6-adb9-a8e0d73cc33e', '4d321a47-3a11-5f77-b541-08b5df7918f8', '8af9598d-58d6-55c5-89ca-d575f9f9ed26');

-- MNT-56-M2-FOR-2 (Samenpflanzen vergleichen): wording tightened to Susan's
-- exact quote, matching the real document's own phrasing more closely.
UPDATE lpm_data_objects
SET title = 'Samenpflanzen vergleichen – Formenvielfalt, gleiche Gliederung',
    description = 'Samenpflanzen vergleichen – Formenvielfalt, gleiche Gliederung',
    content = jsonb_set(content, '{unterthema}', '"Vielfalt – gleicher Grundaufbau"'),
    updated_at = now()
WHERE id = 'd0d80b71-0e1f-576c-a3ad-a9600c4c5e40';

-- MNT-56-M2-ORD-1a (Wuchsformen): moves from "Ordnen von Samenpflanzen" to
-- "Vielfalt – gleicher Grundaufbau", per the real document's own filing.
UPDATE lpm_data_objects
SET description = 'Samenpflanzen nach der Wuchsform (Kräuter, Sträucher, Bäume) ordnen',
    content = jsonb_set(jsonb_set(content, '{unterthema}', '"Vielfalt – gleicher Grundaufbau"'), '{originaltext}', '"Samenpflanzen nach der Wuchsform (Kräuter, Sträucher, Bäume) ordnen"'),
    updated_at = now()
WHERE id = '03a9004d-853c-5a29-a911-597aaf8b8127';

-- Klassifizieren und Ordnen von Samenpflanzen -> Ordnen von Samenpflanzen
-- (the remaining 3 items: Nutzung, Pflanzenfamilien, Vertreter-Vergleich)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Ordnen von Samenpflanzen"'), updated_at = now()
WHERE id IN ('364e7135-e167-521f-abd9-a5d401237a1d', 'd3bc4da1-e7d0-54a0-ba53-88d20cb2b784', 'b60088aa-780c-5a06-83df-2c25d0d9a760');

-- MNT-56-M2-ORD-1c + ORD-2: Susan's corrected text covers both items --
-- the comparison-and-classification half goes on ORD-1c, the
-- distinguishing-from-other-families half on ORD-2, so neither item is
-- deleted or merged and each one's own wording matches a real piece of her
-- quoted text.
UPDATE lpm_data_objects
SET description = 'Zwei Vertreter einer Pflanzenfamilie (z. B. Kreuzblütengewächse) hinsichtlich ausgewählter Merkmale vergleichen und aufgrund von Gemeinsamkeiten der Pflanzenfamilie zuordnen (Aufbau von Blüten und Sprossachsen, Stellung der Laubblätter an der Sprossachse, Fruchtformen)',
    content = jsonb_set(content, '{originaltext}', '"Zwei Vertreter einer Pflanzenfamilie (z. B. Kreuzblütengewächse) hinsichtlich ausgewählter Merkmale vergleichen und aufgrund von Gemeinsamkeiten der Pflanzenfamilie zuordnen (Aufbau von Blüten und Sprossachsen, Stellung der Laubblätter an der Sprossachse, Fruchtformen)"'),
    updated_at = now()
WHERE id = 'd3bc4da1-e7d0-54a0-ba53-88d20cb2b784';

UPDATE lpm_data_objects
SET title = 'Pflanzenfamilie von anderen Pflanzenfamilien abgrenzen',
    description = 'Die ausgewählte Pflanzenfamilie von anderen Pflanzenfamilien abgrenzen',
    content = jsonb_set(content, '{originaltext}', '"Die ausgewählte Pflanzenfamilie von anderen Pflanzenfamilien abgrenzen"'),
    updated_at = now()
WHERE id = 'b60088aa-780c-5a06-83df-2c25d0d9a760';

-- New: "die Einteilung von Samenpflanzen nach verschiedenen
-- Ordnungskriterien erlaeutern" -- Susan's second quoted goal for this
-- subtopic, a synthesis-level objective (explaining classification
-- criteria in general) that no existing item covers; MNT-56-M2-ORD-1b only
-- covers the Wild-/Kulturpflanzen criterion specifically.
INSERT INTO lpm_data_objects (
  id, object_type, title, description, grade_band, subject_area, content,
  schema_version, status, project_id, branch_id, curriculum_sequence
) VALUES (
  gen_random_uuid(), 'performance_indicator',
  'Einteilung von Samenpflanzen nach Ordnungskriterien erläutern',
  'Die Einteilung von Samenpflanzen nach verschiedenen Ordnungskriterien erläutern (z. B. Wild- und Kulturpflanzen, Pflanzenfamilien)',
  '5', 'MNT',
  jsonb_build_object(
    'thema', '2.2.7 Samenpflanzen',
    'unterthema', 'Ordnen von Samenpflanzen',
    '_source_file', 'lernziele_MNT56.json',
    'originaltext', 'Die Einteilung von Samenpflanzen nach verschiedenen Ordnungskriterien erläutern (z. B. Wild- und Kulturpflanzen, Pflanzenfamilien)',
    'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.7',
    'source_detail', 'Added 2026-10-14 from Susan Hanisch''s direct feedback (row 5ca2cf66), checked against the real document. Basiskonzept/method analysis below is Claude-drafted and unreviewed -- Susan still needs to check it before it counts as validated, same as the rest of this project''s AI-drafted content.',
    'curriculum_version', '2026-erprobungsfassung',
    'kognitionsverb', 'erläutern',
    'abstraktionsgrad', 'mittel',
    'ist_praktisch', false,
    'ist_konzeptanker', false,
    'basiskonzeptbezug', jsonb_build_array(
      jsonb_build_object(
        'basiskonzept_id', 'bk_evolutive_entwicklung',
        'relevanz_beurteilung', 2,
        'begruendung', 'Die Einteilung in Pflanzenfamilien ist keine beliebige Sortierung, sondern spiegelt tatsaechliche Verwandtschaft wider -- zwei Pflanzen landen in derselben Familie, weil sie von einer gemeinsamen Vorfahrin abstammen, nicht nur weil sie aehnlich aussehen. Fuer Fuenft-/Sechstklaessler steht die Kriterien geleitete Einteilung selbst im Vordergrund, nicht die stammesgeschichtliche Begruendung dahinter; der Bezug ist real, aber noch nicht Unterrichtsgegenstand.',
        'relevante_evolutionskonzepte', jsonb_build_array('Verwandtschaft und Abstammung'),
        'relevante_teilkonzepte', '[]'::jsonb,
        'relevante_unterkonzepte_taxonomie', '[]'::jsonb,
        'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb
      ),
      jsonb_build_object(
        'basiskonzept_id', 'bk_individuelle_entwicklung',
        'relevanz_beurteilung', 1,
        'begruendung', 'Die Einteilung nach Ordnungskriterien betrifft, welcher Gruppe eine Pflanze angehoert, nicht ihre eigene Entwicklung vom Samen zur ausgewachsenen Pflanze.',
        'relevante_teilkonzepte', '[]'::jsonb,
        'relevante_unterkonzepte_taxonomie', '[]'::jsonb,
        'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb
      ),
      jsonb_build_object(
        'basiskonzept_id', 'bk_struktur_funktion',
        'relevanz_beurteilung', 2,
        'begruendung', 'Die Kriterien, nach denen Samenpflanzen eingeteilt werden -- etwa Bluetenbau oder Nutzung -- sind an aeusseren Strukturmerkmalen festgemacht. Das Lernziel selbst fragt aber nach der Einteilung an sich, nicht danach, wie Struktur und Funktion einer Pflanze zusammenhaengen.',
        'relevante_teilkonzepte', '[]'::jsonb,
        'relevante_unterkonzepte_taxonomie', '[]'::jsonb,
        'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb
      ),
      jsonb_build_object(
        'basiskonzept_id', 'bk_steuerung_regelung',
        'relevanz_beurteilung', 1,
        'begruendung', 'Ordnungskriterien fuer Pflanzen betreffen keine Steuerungs- oder Regelungsprozesse.',
        'relevante_teilkonzepte', '[]'::jsonb,
        'relevante_unterkonzepte_taxonomie', '[]'::jsonb,
        'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb
      ),
      jsonb_build_object(
        'basiskonzept_id', 'bk_stoff_energie_umwandlung',
        'relevanz_beurteilung', 1,
        'begruendung', 'Das Kriterium "Wild- vs. Kulturpflanze" beruehrt zwar Nutzung durch den Menschen, aber keine Stoff- oder Energieumwandlung selbst.',
        'relevante_teilkonzepte', '[]'::jsonb,
        'relevante_unterkonzepte_taxonomie', '[]'::jsonb,
        'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb
      ),
      jsonb_build_object(
        'basiskonzept_id', 'bk_information_kommunikation',
        'relevanz_beurteilung', 1,
        'begruendung', 'Klassifikation ist eine Form der Informationsordnung, aber kein Informations- oder Kommunikationsprozess zwischen Lebewesen, wie ihn dieses Basiskonzept meint.',
        'relevante_teilkonzepte', '[]'::jsonb,
        'relevante_unterkonzepte_taxonomie', '[]'::jsonb,
        'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb
      )
    ),
    'basiskonzepte_primaer', jsonb_build_array('bk_evolutive_entwicklung', 'bk_struktur_funktion'),
    'teilkonzept_primaer', 'bk_evolutive_entwicklung__verwandtschaft',
    'kognitive_anforderung', 'reproduktion_und_verstaendnis',
    'systemebene_primaer', 'Organismus',
    'empfohlenes_quartal', 'Q1',
    'empfohlene_klassenstufe', '5',
    'didaktische_strategien', jsonb_build_object(
      'top3_methoden', jsonb_build_array(
        jsonb_build_object('rang', 1, 'favorit', false, 'methode', 'Konzeptuelles Lernen', 'beschreibung', 'Die Klasse sortiert mitgebrachte oder abgebildete Pflanzen zunaechst nach einem selbst gewaehlten Kriterium, dann nach Wild-/Kulturpflanze, dann nach Pflanzenfamilie -- und vergleicht, welche Einteilung am meisten ueber die Pflanze verraet.'),
        jsonb_build_object('rang', 2, 'favorit', false, 'methode', 'Kooperative Lernformen', 'beschreibung', 'Gruppen erhalten je ein Ordnungskriterium und praesentieren der Klasse, wie "ihre" Einteilung dieselben Pflanzen anders gruppiert.'),
        jsonb_build_object('rang', 3, 'favorit', false, 'methode', '(bioethische) Diskussion', 'beschreibung', 'Diskussion: Warum braucht man mehrere Ordnungskriterien statt nur eines? Woran erkennt man, ob ein Kriterium gut geeignet ist?')
      ),
      'bezug_zum_lehrplan_kontext', 'Fasst die vorangegangenen Einzelkriterien (Wuchsform, Nutzung, Pflanzenfamilie) zu einer allgemeinen Aussage ueber Ordnungskriterien zusammen -- Abschluss des Unterthemas "Ordnen von Samenpflanzen".',
      'moegliche_fehlvorstellungen', 'Schueler:innen nehmen oft an, es gaebe nur eine "richtige" Einteilung von Pflanzen; der Vergleich mehrerer Kriterien macht deutlich, dass die Wahl des Kriteriums vom Zweck der Einteilung abhaengt.',
      'evolutionsdidaktischer_impuls', 'Leitfrage: "Warum landen zwei sehr unterschiedlich aussehende Pflanzen manchmal in derselben Pflanzenfamilie?" -- bereitet vor, dass Verwandtschaft (nicht nur aeusserliche Aehnlichkeit) spaeter als Ordnungsprinzip eingefuehrt wird.'
    ),
    'basiskonzepte_sekundaer', jsonb_build_array('bk_individuelle_entwicklung'),
    'interleaving_empfehlung', '[]'::jsonb,
    'ermoeglichende_lernziele', '[]'::jsonb,
    'voraussetzende_lernziele', jsonb_build_array('MNT-56-M2-ORD-1c'),
    'skalenuebergang_erforderlich', false,
    'geschaetzte_unterrichtsstunden', 1
  ),
  'evomentor_de_lernziel_v1.2', 'accepted',
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a',
  (SELECT branch_id FROM lpm_data_objects WHERE id = 'd3bc4da1-e7d0-54a0-ba53-88d20cb2b784'),
  43.5
);

-- ============================================================
-- 2.2.9 Der Mensch – Gesunderhaltung: "Sexualitaet und Entwicklung" is not
-- the real document's subtopic name. The real heading (line 539) is
-- "Sexualitaet und Fortpflanzung" -- confirmed independently while
-- checking Susan's 2.2.2/2.2.6/2.2.7 items, same section family. Fixing
-- the 4 existing items plus the 2 that were added later with no subtopic
-- label at all.
-- ============================================================

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Sexualität und Fortpflanzung"'), updated_at = now()
WHERE id IN (
  '1f1f0869-8f45-5a69-8681-1b36b73e7699', '6e32379d-010e-58a6-91b7-384f7779e9bc',
  '502540d2-8051-58e4-bcef-4b0f2fc931ca', 'd9247686-f293-5d47-9cc1-bd53150143ee',
  'c2b5ff73-faa0-43fa-9f00-234bb52fe29f', 'ecee12a1-7638-4d84-a4a5-72f0e27c3ca0'
);

-- ============================================================
-- 2.2.2 Mensch – Natur – Technik (feedback 4bed4bbe): the real document has
-- THREE subtopics -- "Beziehungen zwischen Mensch, Natur und Technik",
-- "Naturwissenschaftliches Arbeiten", "Fachpraktisches Arbeiten". Current
-- data only has 2 items, both under a made-up "Vernetzung
-- Mensch-Natur-Technik" label matching none of the three. Renaming the
-- existing 2 to the real subtopic 1 heading and adding the 2 missing
-- learning goals (subtopics 2 and 3) with their real wording.
-- ============================================================

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Beziehungen zwischen Mensch, Natur und Technik"'), updated_at = now()
WHERE id IN ('de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7', 'a8d25f6e-9820-53fd-93d3-b251c863c9b6');

INSERT INTO lpm_data_objects (
  id, object_type, title, description, grade_band, subject_area, content,
  schema_version, status, project_id, branch_id, curriculum_sequence
) VALUES (
  gen_random_uuid(), 'performance_indicator',
  'Schrittfolge des Forschenden Lernens an einem Beispiel anwenden',
  'Nach der Schrittfolge des Forschenden Lernens an einem konkreten Beispiel vorgehen (gleiche 6-Schritt-Folge wie in Abschnitt 2.2.1: Fragen stellen, Vermutungen aufstellen, Experimente planen, durchführen, Ergebnisse beobachten/dokumentieren, auswerten)',
  '5', 'MNT',
  jsonb_build_object(
    'thema', '2.2.2 Mensch – Natur – Technik',
    'unterthema', 'Naturwissenschaftliches Arbeiten',
    '_source_file', 'lernziele_MNT56.json',
    'originaltext', 'Die Schrittfolge des Forschenden Lernens an einem konkreten Beispiel anwenden (gleiche 6-Schritt-Folge wie in §2.2.1).',
    'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.2',
    'source_detail', 'Added 2026-10-14 from Susan Hanisch''s direct feedback (row 4bed4bbe): this subtopic existed in the real curriculum document but had no corresponding item in OpenLPM at all. Basiskonzept/method analysis below is Claude-drafted and unreviewed.',
    'curriculum_version', '2026-erprobungsfassung',
    'kognitionsverb', 'anwenden',
    'abstraktionsgrad', 'niedrig',
    'ist_praktisch', true,
    'ist_konzeptanker', false,
    'basiskonzeptbezug', jsonb_build_array(
      jsonb_build_object('basiskonzept_id', 'bk_evolutive_entwicklung', 'relevanz_beurteilung', 1, 'begruendung', 'Das Anwenden einer Forschungsmethode an einem beliebigen Beispiel hat keinen inhaltlichen Bezug zu Evolution -- welches Beispiel gewaehlt wird, legt der Lehrplan bewusst offen.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_individuelle_entwicklung', 'relevanz_beurteilung', 1, 'begruendung', 'Methodenanwendung an einem freien Beispiel beruehrt keine individuellen Entwicklungsprozesse.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_struktur_funktion', 'relevanz_beurteilung', 1, 'begruendung', 'Kein struktureller Bezug bei dieser allgemeinen Methodenuebung.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_steuerung_regelung', 'relevanz_beurteilung', 1, 'begruendung', 'Kein Bezug zu Steuerungs- oder Regelungsprozessen.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_stoff_energie_umwandlung', 'relevanz_beurteilung', 1, 'begruendung', 'Haengt ganz vom spaeter gewaehlten konkreten Beispiel ab, nicht vom Lernziel selbst.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_information_kommunikation', 'relevanz_beurteilung', 2, 'begruendung', 'Das Dokumentieren und Auswerten von Beobachtungen -- ein fester Teil der 6-Schritt-Folge -- ist eine Form naturwissenschaftlicher Informationsverarbeitung und -darstellung, auch wenn das Lernziel selbst die Methode in den Vordergrund stellt, nicht das Kommunizieren von Ergebnissen.', 'relevante_unterkonzepte', jsonb_build_array('Dokumentation und Auswertung'), 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb)
    ),
    'basiskonzepte_primaer', jsonb_build_array('bk_information_kommunikation'),
    'teilkonzept_primaer', 'bk_information_kommunikation__dokumentation',
    'kognitive_anforderung', 'anwendung',
    'systemebene_primaer', null,
    'empfohlenes_quartal', 'Q1',
    'empfohlene_klassenstufe', '5',
    'didaktische_strategien', jsonb_build_object(
      'top3_methoden', jsonb_build_array(
        jsonb_build_object('rang', 1, 'favorit', false, 'methode', 'Forschendes Lernen', 'beschreibung', 'Die Klasse durchlaeuft die 6 Schritte gemeinsam an einem einfachen Alltagsbeispiel (z. B. "Warum beschlaegt ein kaltes Glas?"), jeder Schritt wird einzeln benannt und an der Tafel festgehalten.'),
        jsonb_build_object('rang', 2, 'favorit', false, 'methode', 'Erfahrungs-/handlungsorientiertes Lernen', 'beschreibung', 'Schueler:innen fuehren den Schritt "Experimente durchfuehren" selbst praktisch aus, statt ihn nur beschrieben zu bekommen.'),
        jsonb_build_object('rang', 3, 'favorit', false, 'methode', 'Kooperative Lernformen', 'beschreibung', 'In Kleingruppen wird je ein eigenes, einfaches Beispiel durch alle 6 Schritte gefuehrt und der Klasse vorgestellt.')
      ),
      'bezug_zum_lehrplan_kontext', 'Ueberfuehrt die in Abschnitt 2.2.1 eingefuehrte 6-Schritt-Folge des Forschenden Lernens erstmals in die Anwendung an einem konkreten Beispiel -- Bruecke zwischen den allgemeinen Methoden aus 2.2.1 und ihrem spaeteren fachlichen Einsatz.',
      'moegliche_fehlvorstellungen', 'Schueler:innen ueberspringen oft den Schritt "begruendete Vermutung aufstellen" und gehen direkt zum Experimentieren -- die explizite Benennung jedes Schritts hilft, das zu vermeiden.',
      'evolutionsdidaktischer_impuls', null
    ),
    'basiskonzepte_sekundaer', '[]'::jsonb,
    'interleaving_empfehlung', '[]'::jsonb,
    'ermoeglichende_lernziele', '[]'::jsonb,
    'voraussetzende_lernziele', jsonb_build_array('MNT-56-M1-NWA-1a', 'MNT-56-M1-NWA-1b', 'MNT-56-M1-NWA-1c'),
    'skalenuebergang_erforderlich', false,
    'geschaetzte_unterrichtsstunden', 1
  ),
  'evomentor_de_lernziel_v1.2', 'accepted',
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a',
  (SELECT branch_id FROM lpm_data_objects WHERE id = 'de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7'),
  6
);

INSERT INTO lpm_data_objects (
  id, object_type, title, description, grade_band, subject_area, content,
  schema_version, status, project_id, branch_id, curriculum_sequence
) VALUES (
  gen_random_uuid(), 'performance_indicator',
  'Stoffgemisch aus Eisenspänen, Sand und Kies trennen',
  'Nach der Schrittfolge des Forschenden Lernens ein Stoffgemisch aus Eisenspänen, Sand und Kies trennen (mit Magnet und Sieb)',
  '5', 'MNT',
  jsonb_build_object(
    'thema', '2.2.2 Mensch – Natur – Technik',
    'unterthema', 'Fachpraktisches Arbeiten',
    '_source_file', 'lernziele_MNT56.json',
    'originaltext', 'Nach der Schrittfolge des Forschenden Lernens ein Stoffgemisch aus Eisenspänen, Sand und Kies trennen (mit Magnet und Sieb).',
    'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.2',
    'source_detail', 'Added 2026-10-14 from Susan Hanisch''s direct feedback (row 4bed4bbe), exact wording from her quote, matching the real document. Basiskonzept/method analysis below is Claude-drafted and unreviewed.',
    'curriculum_version', '2026-erprobungsfassung',
    'kognitionsverb', 'trennen',
    'abstraktionsgrad', 'niedrig',
    'ist_praktisch', true,
    'ist_konzeptanker', false,
    'basiskonzeptbezug', jsonb_build_array(
      jsonb_build_object('basiskonzept_id', 'bk_evolutive_entwicklung', 'relevanz_beurteilung', 1, 'begruendung', 'Das Trennen eines unbelebten Stoffgemischs hat keinen biologischen oder evolutionaeren Bezug.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_individuelle_entwicklung', 'relevanz_beurteilung', 1, 'begruendung', 'Kein Bezug zu individuellen Entwicklungsprozessen von Lebewesen.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_struktur_funktion', 'relevanz_beurteilung', 2, 'begruendung', 'Die Trennmethode nutzt gezielt unterschiedliche physikalische Eigenschaften der drei Stoffe (Eisenspaene magnetisch, Sand/Kies unterschiedliche Korngroesse) -- ein frueher, wenn auch nicht-biologischer Fall davon, wie eine Struktureigenschaft eine Funktion (hier: Trennbarkeit) ermoeglicht.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_steuerung_regelung', 'relevanz_beurteilung', 1, 'begruendung', 'Kein Steuerungs- oder Regelungsprozess beteiligt.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_stoff_energie_umwandlung', 'relevanz_beurteilung', 2, 'begruendung', 'Es handelt sich um eine physikalische Stofftrennung, nicht um eine Stoffumwandlung (die Stoffe selbst aendern sich nicht) -- trotzdem eine fruehe, konkrete Begegnung mit dem allgemeinen Thema "Stoffe und ihre Eigenschaften", das spaeter in Abschnitt 2.2.3 vertieft wird.', 'relevante_unterkonzepte', jsonb_build_array('Stofftrennung'), 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_information_kommunikation', 'relevanz_beurteilung', 1, 'begruendung', 'Kein Informations- oder Kommunikationsbezug im Sinn dieses Basiskonzepts.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb)
    ),
    'basiskonzepte_primaer', jsonb_build_array('bk_struktur_funktion', 'bk_stoff_energie_umwandlung'),
    'teilkonzept_primaer', 'bk_stoff_energie_umwandlung__stofftrennung',
    'kognitive_anforderung', 'anwendung',
    'systemebene_primaer', null,
    'empfohlenes_quartal', 'Q1',
    'empfohlene_klassenstufe', '5',
    'didaktische_strategien', jsonb_build_object(
      'top3_methoden', jsonb_build_array(
        jsonb_build_object('rang', 1, 'favorit', false, 'methode', 'Erfahrungs-/handlungsorientiertes Lernen', 'beschreibung', 'Jede:r Schueler:in trennt das Stoffgemisch selbst mit Magnet und Sieb und protokolliert die einzelnen Schritte.'),
        jsonb_build_object('rang', 2, 'favorit', false, 'methode', 'Forschendes Lernen', 'beschreibung', 'Vor dem Trennen eine begruendete Vermutung aufstellen, welcher Stoff sich wie trennen laesst und warum -- anschliessend ueberpruefen.'),
        jsonb_build_object('rang', 3, 'favorit', false, 'methode', 'Kooperative Lernformen', 'beschreibung', 'Partnerarbeit: eine Person fuehrt die Trennung durch, die andere dokumentiert und stellt Rueckfragen zur Begruendung.')
      ),
      'bezug_zum_lehrplan_kontext', 'Erstes konkretes, fachpraktisches Beispiel fuer die in Abschnitt 2.2.1 eingefuehrte Forschendes-Lernen-Methode und fuer das spaeter in Abschnitt 2.2.3 vertiefte Thema Stofftrennung.',
      'moegliche_fehlvorstellungen', 'Manche Kinder erwarten, dass ein Magnet auch Sand "anziehen" koennte, wenn man ihn nur stark genug macht -- ein guter Anlass, Magnetismus als stoffspezifische Eigenschaft (nur bei Eisen/Stahl) zu klaeren.',
      'evolutionsdidaktischer_impuls', null
    ),
    'basiskonzepte_sekundaer', '[]'::jsonb,
    'interleaving_empfehlung', '[]'::jsonb,
    'ermoeglichende_lernziele', '[]'::jsonb,
    'voraussetzende_lernziele', '[]'::jsonb,
    'skalenuebergang_erforderlich', false,
    'geschaetzte_unterrichtsstunden', 1
  ),
  'evomentor_de_lernziel_v1.2', 'accepted',
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a',
  (SELECT branch_id FROM lpm_data_objects WHERE id = 'de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7'),
  6.5
);
