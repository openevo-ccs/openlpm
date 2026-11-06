-- Dustin/Susan provided a reviewed CSV ("Gym 5,6 MNT topics and
-- subtopics") giving the authoritative final topic/subtopic structure for
-- Grade 5/6, with a column stating whether each subtopic is taken
-- verbatim from the curriculum ("Curriculum"), adapted from it
-- ("Curriculum, modified" -- mostly the "Fachpraktische Arbeiten (X)"
-- entries, which this project is now splitting OUT as their own
-- subtopics rather than merging into the main content subtopic the way
-- migrations 130-133 did), or invented where the real document has no
-- named subtopic at all ("newly generated" -- 2.2.4's "Chemische
-- Reaktionen" heading).
--
-- This corrects several choices made in migration 133 specifically: that
-- migration merged every practical (Fachpraktisch) activity into its
-- parent content subtopic, reasoning the real document doesn't name
-- Fachpraktisch as its own subtopic. The CSV says otherwise -- Susan/
-- Dustin want "Fachpraktische Arbeiten (X)" kept as its own real,
-- separate subtopic throughout, not folded in. Splitting those back out
-- here.
--
-- Origin tracking: the CSV's own "Origin of Unterthema" column is stored
-- going forward as content.unterthema_origin ('curriculum',
-- 'curriculum_modified', 'newly_generated', or absent when the CSV says
-- "(none)").
SET search_path = public, extensions;

-- ============================================================
-- 2.2.1: CSV says "(none)" -- no named subtopic exists for this
-- Lernbereich at all. Clearing every current unterthema value (they were
-- this project's own earlier editorial grouping, not real subtopic
-- names, and the CSV now settles that they shouldn't be presented as
-- subtopics).
-- ============================================================
UPDATE lpm_data_objects SET content = content - 'unterthema' - 'unterthema_origin', updated_at = now()
WHERE id IN (
  '5505cca7-ad59-559a-b52d-e189e6216f3e','6d6870cc-6989-589c-8d9c-a9c646ed6d2f','59217437-cc96-52b4-af1c-972d77c7a4b2',
  'ba79c252-b7ab-569e-9ea5-0ffc6ba38dfc','a7e4c339-daa0-4503-9b0e-ac3a4fba1fdd','47859379-98a7-448b-a77c-213b7c011787',
  '288a0087-b03a-4942-b5a7-9e6a81dbfac4','e5123fef-4f67-4fb6-9e0e-a3c0bafb22d1','a518c1c4-1286-552b-9155-6e3e30e0ff3e',
  '10161325-c6eb-43f4-9b11-bdb3af113fcc','5dcd1531-8572-4b55-bc81-5f905efd37de','4b6fd514-838b-5ec7-84d5-5883dcb43f06',
  'df68570d-0569-4402-bb72-0001ac556b75'
);

-- ============================================================
-- 2.2.2: already matches the CSV exactly (3 subtopics, same names) --
-- just tagging origin for all 3.
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('a1c69f68-f997-4d00-bfc3-80e54920c509', 'edc9754e-ee0c-4d75-848a-e48910ae6e2d', 'a8d25f6e-9820-53fd-93d3-b251c863c9b6');

-- ============================================================
-- 2.2.3 Körper – Stoffe – Eigenschaften: split the 2 Fachpraktisch items
-- back out into their own real subtopic, per the CSV.
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktische Arbeiten (Körper)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = '7c0b5e01-c875-5781-a758-6a28ce4d1e07';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktische Arbeiten (Stoffe)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = '10cc8691-99e6-516d-832f-061141793176';

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('fc796478-14b1-450e-b903-97f95a05a27a','f3f357d4-7a4d-4ebe-8136-32ac9c50c4a5','4b3d2b67-a944-5436-975b-c5b98625566d','03a9bc29-e441-5a5d-b9bc-2327156d35b9','7f692716-6082-55db-bb9d-2788c9411a0f','1672e278-f278-5617-b572-467120bdbdd4','a7012615-24ea-4c09-91de-f8e327119b41','173c7a7e-056c-4757-92a1-eb91f8bfec60','9c597ab6-9a6c-4f7a-a433-e111eeb077ab','2fbb7024-d681-4945-9515-bc77b4ba56c3','148db929-57e0-43d2-9398-83ced9e55da2');

-- ============================================================
-- 2.2.4 Chemische Reaktionen: CSV gives this section named subtopics for
-- the first time -- "Chemische Reaktionen" (newly generated, since the
-- real document has no heading here) and "Fachpraktische Arbeiten"
-- (curriculum, the one experimental item).
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Chemische Reaktionen"'), '{unterthema_origin}', '"newly_generated"'), updated_at = now()
WHERE id IN ('68cc8b6c-0710-4294-86b9-564b84d5e66b','748857e0-ac20-5867-8351-796eeb6611e9','649d5d41-9c4a-4314-afab-b3decb16acf2','341b6c40-ed57-586e-91ab-587f4f0c6721');

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktische Arbeiten"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = '68461c4a-2927-5ae2-bc27-2c61228a018a';

-- ============================================================
-- 2.2.5 Kohäsion, Adhäsion, Kapillarität: split Kapillarität's one
-- Fachpraktisch item out into its own subtopic. (No current item exists
-- for "Fachpraktisches Arbeiten (Kohäsion, Adhäsion)" or the Kapillarität
-- main-content subtopic itself -- real gaps, left open rather than
-- guessed at.)
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktisches Arbeiten (Kapillarität)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = 'f2cc5aa7-8c66-5885-956e-21866e332b01';

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = '0130a025-7ebe-4a4f-a5d1-3e44b5ace875';

-- ============================================================
-- 2.2.7 Samenpflanzen: split 4 Fachpraktisch items back out; fold the
-- old "Nutzung, Haltung und Pflege von Pflanzen und Tieren" label (not
-- in the CSV) into the real "Bedeutung von Samenpflanzen und Nutzung
-- durch den Menschen" subtopic.
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktische Arbeiten (Ernährung Samenpflanzen)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = 'ffcb41d6-c83f-566a-babc-f77ff4531eef';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktische Arbeiten (Fortpflanzung, Entwicklung Samenpflanzen)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id IN ('c7c1a118-efda-59ea-8ff2-5a0357724320', '42c9090a-e55a-53c4-ba6f-7d6c26f838c7', '206e608f-bc89-525c-8dfd-48d4ffcf7ee4');

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Bedeutung von Samenpflanzen und Nutzung durch den Menschen"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = 'b4055e65-e605-5b8c-b6d8-1cc21947800c';

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('b6489681-7c40-5ae6-adb9-a8e0d73cc33e','4d321a47-3a11-5f77-b541-08b5df7918f8','d0d80b71-0e1f-576c-a3ad-a9600c4c5e40','8af9598d-58d6-55c5-89ca-d575f9f9ed26','03a9004d-853c-5a29-a911-597aaf8b8127','1fdb5b8b-238f-5042-a8e2-07ed83535545','9fc5fa06-610c-5212-aac5-cf05c7bcb300','3f4e53a4-d510-433d-a308-c1f2b3465360','b4f4976a-06d2-5886-8934-4ef6446e797f','c41dc217-6ba3-57b4-9cde-de22d68bebf8','a95d79eb-4ea6-482e-b16f-c45948c925e0','02e3a499-d497-5bfc-82fb-e23491526c0a','d7934092-7129-541e-b4b5-631e42b700e6','364e7135-e167-521f-abd9-a5d401237a1d','d3bc4da1-e7d0-54a0-ba53-88d20cb2b784','b60088aa-780c-5a06-83df-2c25d0d9a760','6e6774a9-3ed6-4dcd-a55c-33cd6767bacc','6421c82e-5e45-4f71-9e91-f0a3b30b44a0');

-- ============================================================
-- 2.2.8 Wirbeltiere: rename to the CSV's exact fuller subtopic names,
-- and split "Weitere Wirbeltierklassen" into its real 4 per-class
-- subtopics (Fische/Lurche/Kriechtiere/Vögel) -- the real document
-- treats each as its own short case study, not one combined group.
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Die Vielfalt der Wirbeltiere und ihre Einteilung in Wirbeltierklassen"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('afa7d719-fb4c-5410-afa6-1ce2e3182128', '6fde47d3-6de9-531a-8a50-3ad783413c57');

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = '015d0a14-02d0-5ded-8244-bf1876f2a951';

-- "Gasaustausch und Bedeutung des Sauerstoffs beschreiben" was still
-- labelled "Atmung der Wirbeltiere" (never caught in 132/133) -- the real
-- document's own "Angepasstheit – Säugetiere" subtopic explicitly
-- includes "Sauerstoffaufnahme ueber Lunge", so it belongs with the other
-- 8 Säugetiere items, not its own invented label.
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Angepasstheit an Lebensweise und Lebensräume (Säugetiere)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id IN ('b62370af-2fe2-5a6c-9b4a-f65a7b008337','61336f13-3e2a-5d89-b720-bc019a870094','b2dc23c5-661a-532c-8247-2829885f1d2f','f4d3b010-c86d-5569-9737-6c776e803acc','47322576-0224-581b-a15c-5a2b08ad7247','37cce1bb-7cbf-5c24-bb71-51277b0c612a','c1cc6b14-9c5f-5f0d-a0a0-8ebc9d635eb8','f02f3c2e-ad0e-49d4-8534-1f1874babf36','905a4704-c4fc-5ed8-b46f-589338375239');

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Gegenüberstellung und Ordnen der Wirbeltierklassen"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('f6c0b12c-177d-57f5-9baf-4fbc1f080af9','393ea953-4880-51f3-9503-6f8b534f3126','3f5d448d-3446-4331-82b4-d22f3f144562','5addd20b-ae9a-5ac2-9c45-f7d2ed1a242d','30abcc70-ab22-52c9-87f0-895e38202d5f');

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Angepasstheit an Lebensweise und Lebensräume (Lurche)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = 'ff968272-1426-4b51-b548-d303b892a368';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Angepasstheit an Lebensweise und Lebensräume (Kriechtiere)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = '18764a36-2467-4f26-a484-50eee5deb515';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Angepasstheit an Lebensweise und Lebensräume (Vögel)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = '66fc118c-02c3-4642-ae4a-761146121217';

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('8943afd8-3ac7-525f-a4df-bce4f8d264c3','af819a99-ad45-50bf-a00f-3b989fb5ab6c','ff60d353-d357-5efa-9f78-527d45f1eec9','bac4e87c-18bc-59f2-bd73-cb3bbe2448d4');

-- Missing entirely until now: Fische had zero dedicated coverage, the
-- only one of the 5 real vertebrate classes with none. Real document
-- text (2.2.8, "Weitere Wirbeltierklassen"): "Fische (Bachforelle):
-- Fortbewegung im Wasser (Stromlinienform, Schuppen, Flossen,
-- Schwimmblase); Atmung (Kiemen)."
INSERT INTO lpm_data_objects (
  id, object_type, title, description, grade_band, subject_area, content,
  schema_version, status, project_id, branch_id, curriculum_sequence
) VALUES (
  gen_random_uuid(), 'performance_indicator',
  'Fortbewegung und Atmung der Fische beschreiben',
  'Fortbewegung der Fische im Wasser (Stromlinienform, Schuppen, Flossen, Schwimmblase) und Atmung über die Kiemen beschreiben',
  '5/6', 'MNT',
  jsonb_build_object(
    'thema', '2.2.8 Wirbeltiere',
    'unterthema', 'Angepasstheit an Lebensweise und Lebensräume (Fische)',
    'unterthema_origin', 'curriculum_modified',
    '_source_file', 'lernziele_MNT56.json',
    'originaltext', 'Fische (Bachforelle): Fortbewegung im Wasser (Stromlinienform, Schuppen, Flossen, Schwimmblase); Atmung (Kiemen).',
    'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.8',
    'source_detail', 'Added 2026-10-18 while aligning the repository to Dustin/Susan''s reviewed topic/subtopic CSV: Fische was the one vertebrate class with no dedicated item at all. Basiskonzept/method analysis below is Claude-drafted and unreviewed.',
    'curriculum_version', '2026-erprobungsfassung',
    'kognitionsverb', 'beschreiben',
    'abstraktionsgrad', 'niedrig',
    'ist_praktisch', false,
    'ist_konzeptanker', false,
    'basiskonzeptbezug', jsonb_build_array(
      jsonb_build_object('basiskonzept_id', 'bk_evolutive_entwicklung', 'relevanz_beurteilung', 2, 'begruendung', 'Stromlinienform, Schuppen und Schwimmblase sind klassische Anpassungen an das Leben im Wasser -- ein greifbares, fuer Fuenft-/Sechstklaessler zugaengliches Beispiel dafuer, wie Koerperform zur Lebensweise passt, auch ohne die stammesgeschichtliche Herleitung explizit zu behandeln.', 'relevante_evolutionskonzepte', jsonb_build_array('Anpassung und Angepasstheit'), 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_individuelle_entwicklung', 'relevanz_beurteilung', 1, 'begruendung', 'Beschreibt eine bestehende Koerperform/Atmungsweise, keine individuelle Entwicklung ueber die Lebenszeit.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_struktur_funktion', 'relevanz_beurteilung', 3, 'begruendung', 'Ein zentrales Struktur-Funktion-Beispiel: Stromlinienform ermoeglicht schnelles Schwimmen, Schuppen schuetzen und verringern Reibung, Flossen steuern Richtung und Antrieb, die Schwimmblase reguliert den Auftrieb, Kiemen ermoeglichen Sauerstoffaufnahme aus dem Wasser -- jede Struktur hat eine klar benennbare Funktion fuer das Leben im Wasser.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_steuerung_regelung', 'relevanz_beurteilung', 2, 'begruendung', 'Die Schwimmblase reguliert den Auftrieb und damit die Position des Fisches im Wasser -- ein einfaches, aber echtes Regelungsbeispiel, auch wenn es hier nicht als solches benannt wird.', 'relevante_unterkonzepte', jsonb_build_array('Auftriebsregulation'), 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_stoff_energie_umwandlung', 'relevanz_beurteilung', 2, 'begruendung', 'Die Atmung ueber Kiemen ist der zentrale Ort der Sauerstoffaufnahme aus dem Wasser, Grundlage fuer die Energiegewinnung im Koerper -- derselbe Zusammenhang, der bei Saeugetieren ueber die Lunge laeuft.', 'relevante_unterkonzepte', jsonb_build_array('Gasaustausch'), 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb),
      jsonb_build_object('basiskonzept_id', 'bk_information_kommunikation', 'relevanz_beurteilung', 1, 'begruendung', 'Kein Informations- oder Kommunikationsbezug im Sinn dieses Basiskonzepts.', 'relevante_teilkonzepte', '[]'::jsonb, 'relevante_unterkonzepte_taxonomie', '[]'::jsonb, 'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb)
    ),
    'basiskonzepte_primaer', jsonb_build_array('bk_struktur_funktion'),
    'teilkonzept_primaer', 'bk_struktur_funktion__angepasstheit',
    'kognitive_anforderung', 'reproduktion_und_verstaendnis',
    'systemebene_primaer', 'Organismus',
    'empfohlenes_quartal', 'Q2',
    'empfohlene_klassenstufe', '5',
    'didaktische_strategien', jsonb_build_object(
      'top3_methoden', jsonb_build_array(
        jsonb_build_object('rang', 1, 'favorit', false, 'methode', 'Konzeptuelles Lernen', 'beschreibung', 'Ein echter Fisch (oder ein gutes Foto/Modell einer Bachforelle) wird Struktur fuer Struktur untersucht: Welche Form hat er? Wozu dienen Schuppen, Flossen, die Schwimmblase?'),
        jsonb_build_object('rang', 2, 'favorit', false, 'methode', 'Analogien und Vergleiche', 'beschreibung', 'Vergleich mit einem U-Boot oder einem stromlinienfoermig geformten Fahrzeug: Welche Form bewegt sich leicht durchs Wasser, welche nicht?'),
        jsonb_build_object('rang', 3, 'favorit', false, 'methode', '(bioethische) Diskussion', 'beschreibung', 'Warum braucht ein Fisch Kiemen und kein Saeugetier? Verknuepfung zum bereits behandelten Saeugetier-Beispiel.')
      ),
      'bezug_zum_lehrplan_kontext', 'Eine von vier kurzen Fallstudien zu "Weitere Wirbeltierklassen," parallel zu Lurchen, Kriechtieren und Voegeln -- rundet die Reihe der fuenf Wirbeltierklassen ab, nachdem Saeugetiere bereits ausfuehrlich behandelt wurden.',
      'moegliche_fehlvorstellungen', 'Manche Kinder glauben, Fische "trinken" Wasser, um zu atmen, statt dass sie dem Wasser geloesten Sauerstoff ueber die Kiemen entnehmen -- ein guter Anlass, den Unterschied zwischen Wasseraufnahme und Gasaustausch zu klaeren.',
      'evolutionsdidaktischer_impuls', 'Leitfrage: "Was haben Stromlinienform, Schuppen und Flossen gemeinsam?" -- bereitet vor, Struktur und Funktion als zusammenhaengendes Anpassungsprinzip zu erkennen, das bei jeder Wirbeltierklasse wiederkehrt.'
    ),
    'basiskonzepte_sekundaer', jsonb_build_array('bk_stoff_energie_umwandlung', 'bk_steuerung_regelung'),
    'interleaving_empfehlung', '[]'::jsonb,
    'ermoeglichende_lernziele', '[]'::jsonb,
    'voraussetzende_lernziele', jsonb_build_array('MNT-56-M3-WIR-1', 'MNT-56-M3-WIR-3'),
    'skalenuebergang_erforderlich', false,
    'geschaetzte_unterrichtsstunden', 1
  ),
  'evomentor_de_lernziel_v1.2', 'accepted',
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a',
  (SELECT branch_id FROM lpm_data_objects WHERE id = 'ff968272-1426-4b51-b548-d303b892a368'),
  89.55
);

-- ============================================================
-- 2.2.9 Der Mensch – Gesunderhaltung: fold "Gesunderhaltung des Körpers"
-- and "Zusammensetzung der Nahrung" (neither in the CSV) back into the
-- real subtopics their own content actually belongs under, and split the
-- one Fachpraktisch item out of "Ernährung".
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Bewegung/Körperhaltung"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = 'df9b858f-e765-5fef-be27-d90b789b3da6';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Ernährung"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('678fe211-d660-5bbe-bb8d-5688ec0b8781', '32a2ac6a-65ac-5380-9bec-ef7160df2fb7', '05deb095-b225-5d30-930e-b12966e4d6bb');

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{unterthema}', '"Fachpraktische Arbeiten (Ernährung)"'), '{unterthema_origin}', '"curriculum_modified"'), updated_at = now()
WHERE id = '01c1fd65-e510-5aa8-b238-3e83bf997ef6';

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id IN ('67912053-96bf-4aa8-9c7d-e99c706435f5','16b57533-6fb5-4c10-965f-8ac390baa407','27d2384c-4773-42f4-899e-adb3493501e1','cdb43ae5-86da-4114-93b9-b9f856e9267f','ca3b1b28-91a6-4484-b65f-fbd1a4f238ec','1f1f0869-8f45-5a69-8681-1b36b73e7699','c2b5ff73-faa0-43fa-9f00-234bb52fe29f','6e32379d-010e-58a6-91b7-384f7779e9bc','502540d2-8051-58e4-bcef-4b0f2fc931ca','ecee12a1-7638-4d84-a4a5-72f0e27c3ca0','d9247686-f293-5d47-9cc1-bd53150143ee');

-- ============================================================
-- 2.2.10 Bionik: the CSV treats this as ONE Lernbereich with 8
-- subtopics (each of the 4 named case studies plus its own Fachpraktisch
-- activity), not 4 separate numbered sub-sections the way this project's
-- data currently splits them. Consolidating the 4 case-study items into
-- the single real "2.2.10 Bionik" thema, matching its real Lehrplan
-- structure.
-- ============================================================
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), '{unterthema}', '"10.1 Der Klettverschluss"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = 'ffd21b65-dd3d-4c5b-9bf0-1e4b9a6fdd08';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), '{unterthema}', '"10.2 Die Leichtbauweise"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = 'd9ed3d9a-4344-4813-bc0d-551641038def';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), '{unterthema}', '"10.3 Vom Nebeltrinkerkäfer zur Trinkwassergewinnung"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = '9dbd79a7-02e0-4f13-92ed-87c6f56a367a';

UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), '{unterthema}', '"10.4 Der Lotuseffekt"'), '{unterthema_origin}', '"curriculum"'), updated_at = now()
WHERE id = 'cc6fc4d8-88e3-4fce-80ec-2272bb5527ee';

-- The 6 generic method-step items (not tied to one specific case study)
-- don't match any of the CSV's 8 case-study-specific subtopics. Moving
-- them to "Fächerübergreifende Kompetenz," the same bucket an identical
-- generic Bionik item (a65e2a25) already sits in.
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now()
WHERE id IN ('fd5a26b5-5f51-5be3-bd09-28c7559e8ce1','47a3dd16-ade5-58bc-b6a7-e08256bc3672','68df89df-92ce-55cf-b6f8-b77864fe4a6b','a4e7cd8b-f828-59b3-8073-27469dd064bc','858afecb-1cf2-5b96-acdb-155cb9a032b9','3567aeb7-d9af-5298-b227-533a9df8c167');
