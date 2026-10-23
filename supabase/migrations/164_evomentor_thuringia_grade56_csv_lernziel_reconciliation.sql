-- Susan Hanisch, 2026-10-23: supplied a reviewed CSV ("LP Thueringen Gym 5,6 MNT.csv")
-- giving BOTH the authoritative topic/subtopic structure (same lineage as migration 134's
-- topic CSV) AND, for the first time, the actual Lernziel wording for every grade-5/6 goal.
-- Her instruction: only the learning goals in this CSV should be in EvoMentor Thuringia's
-- grade 5/6 content -- nothing more, nothing less -- and the CSV's own line-wrap hyphen
-- artifacts (e.g. "Materia-lien", "zu-grunde", "Ad-haesion") needed cleaning before use.
--
-- Full reconciliation, checked row-by-row against the live data (173 rows) and the cleaned
-- CSV (174 rows), not just a column-count comparison:
--
-- 1) ALL 56 rows still carrying a pre-2026-reform label ("Modul 1-5", "Fächerübergreifende
--    Kompetenz") are removed. None of them correspond to anything in the CSV -- they cover
--    content the 2026 reform dropped entirely (old physics-mechanics module: Kraft, Hebel,
--    Waerme/Waermeuebertragung, Bewegung, Regelkreise; old ecology "Leben im Lebensraum"
--    content; and a generic, non-per-example Bionik/"Projekt" framing the CSV's much more
--    granular per-example structure replaces). A similarity scorer proposed 11 of these as
--    matches to some CSV line; each was checked by hand and is a false positive from
--    coincidental word overlap (e.g. "ein Beinmodell der Wirbeltiere herstellen" scored
--    against "die Bedeutung der Ernaehrung erlaeutern" -- unrelated content).
-- 2) 12 more rows already under a real 2026 "2.2.N" topic are removed: duplicates (two exact
--    copies of the same "Schutz von Wirbeltieren" row; a broken ASCII-umlaut duplicate of a
--    Pubertaet row the 2026-10-21 umlaut-restoration migration missed because it's a whole
--    duplicate row, not a column value), generic stubs superseded by more specific CSV
--    content already present, and 4 overly-condensed Bionik summary rows (one per real-world
--    example) that the CSV's 22-row granular, step-by-step breakdown replaces.
-- 3) 43 new rows are added for CSV content with no existing counterpart at all, concentrated
--    in Bionik (22 -- the full per-example Schrittfolge the old data only ever condensed),
--    Wirbeltiere (9), Kohaesion/Adhaesion/Kapillaritaet (5, one subtopic Susan named directly)
--    and smaller gaps elsewhere. New rows deliberately carry no basiskonzept/didactic-method
--    analysis yet -- same, already-established gap as migration 101's items (see the
--    2026-10-14/21 sessions) -- that is separate content-drafting work, not done here.
-- 4) 3 small wording extensions on existing rows that were genuinely close but missing one
--    explicit detail the CSV states (Massen-durch-Wiegen; Verbrennung's Waerme/Licht form;
--    the Grasfrosch item's "nach aeusserer Befruchtung").
--
-- Full reconciliation notes: lab_manager/docs/design-notes/
-- openlpm-evomentor-thuringia-grade56-csv-lernziel-reconciliation-2026-10-23.md
SET search_path = public, extensions;

-- ============================================================
-- Part 1: remove 68 rows with no real correspondence in the CSV
-- ============================================================
DELETE FROM lpm_data_objects WHERE id IN (
  '0130a025-7ebe-4a4f-a5d1-3e44b5ace875', '0508ea86-1052-59a5-83c7-7a2022482216', '06bbb029-3afe-5f62-b357-ef237013705b', '10e90682-0ed8-57c8-bd44-18957c3611be', '14f19e13-d879-5dd5-8228-ce950acd343f', '15ec1131-8417-5760-bb8f-40166e326a7b',
  '22278bb5-0029-5206-ab04-883f3ee5ae71', '27ca973a-69e4-57ea-9864-22783484a9f4', '2ce6e67b-b284-55c2-8a0e-91aab2ebe37d', '342a95b6-2e0c-51b9-bb0d-6541ae099fe9', '3567aeb7-d9af-5298-b227-533a9df8c167', '3ae98a27-c528-5454-9542-ba165905e710',
  '3e791200-6110-568b-8fa5-82cc9238f089', '3fe39e9a-7b88-55f0-97dd-1d5b66c58d17', '45b7b39d-112a-5162-a733-6bf8a219b36e', '47a3dd16-ade5-58bc-b6a7-e08256bc3672', '4ae65434-62dc-5630-922e-b0546603cadf', '4b6fd514-838b-5ec7-84d5-5883dcb43f06',
  '4facff5c-9169-597f-b5a1-f2624ed26848', '52d96368-757a-55c1-aabc-6d607f9894fb', '5af67527-ef92-5b2f-bd5e-7077344fd5e7', '5cd78299-ff27-5c58-b1b7-05866124e2a5', '68df89df-92ce-55cf-b6f8-b77864fe4a6b', '690d09af-c38b-55a5-908f-aedab943d2d2',
  '69eae84c-d2dc-58fe-9a72-6567d186464f', '6e2ed1c6-a5d8-5708-9bd4-4023c2d4397f', '748857e0-ac20-5867-8351-796eeb6611e9', '775e365b-0fae-53c7-81b8-b90a0bdd8fec', '798b015d-95ce-5eb4-90b3-a5bca6e71833', '7d862b16-69b6-56ad-bf5d-b8e882648797',
  '832a3021-46c6-5eb8-8de9-4512a90cd314', '83463332-e1a7-5ab9-b539-9a776b298e23', '858afecb-1cf2-5b96-acdb-155cb9a032b9', '86171694-2fc6-5486-a399-9d10f6836306', '92e6dcbf-2396-5c19-a492-a4c931f8ec5c', '9aa1e09b-08b9-5b0f-86c1-4c5135b33e97',
  '9ba69125-6225-5751-8ec7-9ffe2af92cc7', '9dbd79a7-02e0-4f13-92ed-87c6f56a367a', 'a0863ee7-12a5-5cdc-9984-896e663c0080', 'a1abbe2d-1eb3-5e5a-8b5d-c802cd41026b', 'a2257a7e-5dc1-5627-ba3b-252c3e6d3a9f', 'a4814137-dd30-5fda-9cd6-0361ddb7713f',
  'a4e7cd8b-f828-59b3-8073-27469dd064bc', 'a65e2a25-f479-5b2b-aae9-34c927152dd2', 'ada075bb-f60b-530d-8e70-6f20cf4ecb88', 'af5b32b6-9c93-5ab8-a179-f00d2a875c67', 'af819a99-ad45-50bf-a00f-3b989fb5ab6c', 'b2a24d86-ea16-5b00-9cc2-eb10d9ed3a76',
  'b6ddec02-ecca-5f45-9ed8-040cfd04a74a', 'b9918f2b-0092-53ab-97b3-a3c38f2b12a4', 'bc5e5e49-5891-5f9c-9114-6a25616f79d3', 'bd99afc8-8b1d-5c64-9249-a9ac4f0cf981', 'c2b5ff73-faa0-43fa-9f00-234bb52fe29f', 'cb71013c-06fa-52f0-95a5-fcf093af9c06',
  'cc6fc4d8-88e3-4fce-80ec-2272bb5527ee', 'd9ed3d9a-4344-4813-bc0d-551641038def', 'de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7', 'df68570d-0569-4402-bb72-0001ac556b75', 'e6f0417a-59f6-50a4-be6c-1d7f65e19d0e', 'e884a95e-18c0-5308-9bec-237befa6c124',
  'e8e032ce-14cc-5a20-87b9-8b1a579383b8', 'eb423993-0fe1-5ae7-a77a-2554395d934c', 'f0996360-2799-52f3-a596-b0f6bf281163', 'f3744988-3b9a-51ed-a78f-58b523727336', 'f51b7a9e-5485-5608-be64-bf872ddfcc0f', 'fd5a26b5-5f51-5be3-bd09-28c7559e8ce1',
  'ff60d353-d357-5efa-9f78-527d45f1eec9', 'ffd21b65-dd3d-4c5b-9bf0-1e4b9a6fdd08'
);

-- ============================================================
-- Part 2: 3 small wording extensions on existing rows
-- ============================================================
-- 2.2.3 Koerper: the existing row only mentioned Volumen; the CSV also wants Masse-durch-Wiegen
-- explicitly named as its own measurement method.
UPDATE lpm_data_objects
SET description = 'Experimente angeleitet durchführen: Ermitteln des Volumens von Körpern sowie Massen durch Wiegen (unter Verwendung geeigneter Materialien/Geräte für die Messbereiche)',
    content = jsonb_set(content, '{originaltext}', '"Experimente angeleitet durchführen: Ermitteln des Volumens von Körpern sowie Massen durch Wiegen (unter Verwendung geeigneter Materialien/Geräte für die Messbereiche)"'),
    updated_at = now()
WHERE id = '7c0b5e01-c875-5781-a758-6a28ce4d1e07';

-- 2.2.4 Chemische Reaktionen: name the energy form (Waerme/Licht) the CSV specifies, not just
-- generic "Freisetzung von Energie".
UPDATE lpm_data_objects
SET description = 'Verbrennungen als Stoffumwandlung mit Beteiligung von Sauerstoff unter Freisetzung von Energie in Form von Wärme bzw. Licht (DE) beschreiben',
    content = jsonb_set(content, '{originaltext}', '"Verbrennungen als Stoffumwandlung mit Beteiligung von Sauerstoff unter Freisetzung von Energie in Form von Wärme bzw. Licht (DE) beschreiben"'),
    updated_at = now()
WHERE id = '341b6c40-ed57-586e-91ab-587f4f0c6721';

-- 2.2.8 Wirbeltiere (Lurche): the CSV explicitly names aeussere Befruchtung as the first
-- Fortpflanzungs-step for the Grasfrosch example; the existing row started straight at Laich.
UPDATE lpm_data_objects
SET description = 'den Entwicklungsgang der Lurche nach äußerer Befruchtung vom Laich über die Larve (mit Kiemen und Ruderschwanz) zum erwachsenen Tier (mit Lunge) beschreiben (z. B. Grasfrosch)',
    content = jsonb_set(content, '{originaltext}', '"den Entwicklungsgang der Lurche nach äußerer Befruchtung vom Laich über die Larve (mit Kiemen und Ruderschwanz) zum erwachsenen Tier (mit Lunge) beschreiben (z. B. Grasfrosch)"'),
    updated_at = now()
WHERE id = 'ff968272-1426-4b51-b548-d303b892a368';

-- ============================================================
-- Part 3: add 43 rows for CSV content with no existing counterpart
-- ============================================================
INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Stoffe nennen, aus denen Körper bestehen',
  'Stoffe nennen, aus denen Körper bestehen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.3-STO-0", "thema": "2.2.3 Körper – Stoffe – Eigenschaften", "unterthema": "Stoffe und ihre Eigenschaften", "_source_id": "MNT56-CSV26-2.2.3-STO-0", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "Stoffe nennen, aus denen Körper bestehen", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Teilchenmodell zur Veranschaulichung der Teilchenbewegung (Kugelmodell)',
  'die Zusammensetzung der Stoffe aus Teilchen beschreiben (DS): Veranschaulichung der Teilchen und ihrer Bewegung mithilfe eines Modells (Kugeln)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.3-STO-K", "thema": "2.2.3 Körper – Stoffe – Eigenschaften", "unterthema": "Stoffe und ihre Eigenschaften", "_source_id": "MNT56-CSV26-2.2.3-STO-K", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Zusammensetzung der Stoffe aus Teilchen beschreiben (DS): Veranschaulichung der Teilchen und ihrer Bewegung mithilfe eines Modells (Kugeln)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Zusammenhang zwischen Teilchenanordnung/-bewegung und Aggregatzuständen',
  'die Zusammensetzung der Stoffe aus Teilchen beschreiben (DS): Zusammenhang zwischen Anordnung sowie Bewegung der Teilchen und den Aggregatzuständen (fest, flüssig, gasförmig)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.3-STO-A", "thema": "2.2.3 Körper – Stoffe – Eigenschaften", "unterthema": "Stoffe und ihre Eigenschaften", "_source_id": "MNT56-CSV26-2.2.3-STO-A", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Zusammensetzung der Stoffe aus Teilchen beschreiben (DS): Zusammenhang zwischen Anordnung sowie Bewegung der Teilchen und den Aggregatzuständen (fest, flüssig, gasförmig)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Kugelform eines Wassertropfens durch Kohäsion und Oberflächenspannung',
  'das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Kugelform eines Wassertropfens aufgrund anziehender Kräfte zwischen den Wasserteilchen (Kohäsion) und Oberflächenspannung',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.5-KOH-1", "thema": "2.2.5 Kohäsion, Adhäsion, Kapillarität", "unterthema": "Kohäsion, Adhäsion", "_source_id": "MNT56-CSV26-2.2.5-KOH-1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Kugelform eines Wassertropfens aufgrund anziehender Kräfte zwischen den Wasserteilchen (Kohäsion) und Oberflächenspannung", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Adhäsionskräfte zwischen Wasserteilchen und einem anderen Stoff (z. B. Glas)',
  'das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Kräfte zwischen Wasserteilchen und Teilchen eines anderen Stoffes, z. B. Glas (Adhäsion)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.5-KOH-2", "thema": "2.2.5 Kohäsion, Adhäsion, Kapillarität", "unterthema": "Kohäsion, Adhäsion", "_source_id": "MNT56-CSV26-2.2.5-KOH-2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Kräfte zwischen Wasserteilchen und Teilchen eines anderen Stoffes, z. B. Glas (Adhäsion)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Benetzung, wenn Adhäsion größer als Kohäsion',
  'das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Benetzung, wenn Adhäsion größer als Kohäsion (z. B. auf wasserliebenden Oberflächen bzw. bei flächigem Kontakt auf glatter Oberfläche)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.5-KOH-3", "thema": "2.2.5 Kohäsion, Adhäsion, Kapillarität", "unterthema": "Kohäsion, Adhäsion", "_source_id": "MNT56-CSV26-2.2.5-KOH-3", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Benetzung, wenn Adhäsion größer als Kohäsion (z. B. auf wasserliebenden Oberflächen bzw. bei flächigem Kontakt auf glatter Oberfläche)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Abperlen, wenn Adhäsion kleiner als Kohäsion',
  'das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Abperlen, wenn Adhäsion kleiner als Kohäsion (z. B. wasserabweisenden Oberflächen bzw. bei punktuellem Kontakt auf rauer/genoppter Oberfläche)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.5-KOH-4", "thema": "2.2.5 Kohäsion, Adhäsion, Kapillarität", "unterthema": "Kohäsion, Adhäsion", "_source_id": "MNT56-CSV26-2.2.5-KOH-4", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das Benetzen von Materialien mit Wasser und das Abperlen auf verschiedenen Materialien beschreiben und begründen (DS): Abperlen, wenn Adhäsion kleiner als Kohäsion (z. B. wasserabweisenden Oberflächen bzw. bei punktuellem Kontakt auf rauer/genoppter Oberfläche)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Alltagsbeispiele für Adhäsion',
  'Alltagsbeispiele für Adhäsion nennen (z. B. Kreide an Tafel)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.5-KOH-5", "thema": "2.2.5 Kohäsion, Adhäsion, Kapillarität", "unterthema": "Kohäsion, Adhäsion", "_source_id": "MNT56-CSV26-2.2.5-KOH-5", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "Alltagsbeispiele für Adhäsion nennen (z. B. Kreide an Tafel)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Gebildeter Sauerstoff als wichtiger Stoff für die Atmung vieler Lebewesen',
  'den gebildeten Sauerstoff als wichtigen Stoff für die Atmung vieler Lebewesen benennen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.7-ERN-O2", "thema": "2.2.7 Samenpflanzen", "unterthema": "Ernährung der Samenpflanzen", "_source_id": "MNT56-CSV26-2.2.7-ERN-O2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "den gebildeten Sauerstoff als wichtigen Stoff für die Atmung vieler Lebewesen benennen", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Weitere Untersuchungen zur Ernährung der Samenpflanzen (Leitgefäße, Transpiration, Wasseraufnahme, Licht/Wasser-Bedarf)',
  'kriteriengeleitet unter Verwendung einer Lupe betrachten: Sprossachsenquerschnitt (Erkennen der Leitgefäße); experimentieren: Abgabe von Wasserdampf über die Laubblätter (z. B. Beobachten von Wassertropfen an übergestülpter Folie); experimentieren sowie den Versuchsaufbau und die Bedeutung von Kontrollversuchen begründen: Nachweis der Wasseraufnahme über Wurzeln (z. B. Pflanze in Becherglas mit Wasser und Ölschicht); experimentieren sowie den Versuchsaufbau und die Bedeutung von Kontrollversuchen begründen: Bedeutung von Licht und Wasser für Pflanzen (z. B. Kressepflanzen in Gefäßen unter verschiedenen Bedingungen)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.7-ERN-FP", "thema": "2.2.7 Samenpflanzen", "unterthema": "Fachpraktische Arbeiten (Ernährung Samenpflanzen)", "_source_id": "MNT56-CSV26-2.2.7-ERN-FP", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "kriteriengeleitet unter Verwendung einer Lupe betrachten: Sprossachsenquerschnitt (Erkennen der Leitgefäße); experimentieren: Abgabe von Wasserdampf über die Laubblätter (z. B. Beobachten von Wassertropfen an übergestülpter Folie); experimentieren sowie den Versuchsaufbau und die Bedeutung von Kontrollversuchen begründen: Nachweis der Wasseraufnahme über Wurzeln (z. B. Pflanze in Becherglas mit Wasser und Ölschicht); experimentieren sowie den Versuchsaufbau und die Bedeutung von Kontrollversuchen begründen: Bedeutung von Licht und Wasser für Pflanzen (z. B. Kressepflanzen in Gefäßen unter verschiedenen Bedingungen)", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Bedeutung von Ernährung und Atmung bei Wirbeltieren',
  'die Bedeutung von Ernährung und Atmung erläutern: Aufnahme von Nahrung, Zerlegung der Nahrung in Bausteine und Aufnahme ins Blut; Aufnahme von Sauerstoff über die Lunge in das Blut; Transport der Nahrungsbausteine und des Sauerstoffs in alle Teile des Körpers; Verwendung zum Aufbau körpereigener Stoffe (z. B. Wachstum) und zur Bereitstellung von Energie',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-ERN-ATM", "thema": "2.2.8 Wirbeltiere", "unterthema": "Ernährung und Atmung", "_source_id": "MNT56-CSV26-2.2.8-ERN-ATM", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Bedeutung von Ernährung und Atmung erläutern: Aufnahme von Nahrung, Zerlegung der Nahrung in Bausteine und Aufnahme ins Blut; Aufnahme von Sauerstoff über die Lunge in das Blut; Transport der Nahrungsbausteine und des Sauerstoffs in alle Teile des Körpers; Verwendung zum Aufbau körpereigener Stoffe (z. B. Wachstum) und zur Bereitstellung von Energie", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Fortpflanzung und Entwicklung bei Wirbeltieren (allgemein)',
  'die Fortpflanzung und Entwicklung beschreiben: Geschlechtliche Fortpflanzung (Bildung von Eiern im Eierstock der Weibchen, Bildung von Samenzellen im Hoden der Männchen, innere Befruchtung, befruchtetes Ei, Entwicklung des Embryos, Geburt, Entwicklung zum erwachsenen Tier); Säugen der Neugeborenen mit Muttermilch; Unterscheidung zwischen Nesthocker und Nestflüchter',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-FOR-ENT", "thema": "2.2.8 Wirbeltiere", "unterthema": "Fortpflanzung und Entwicklung", "_source_id": "MNT56-CSV26-2.2.8-FOR-ENT", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Fortpflanzung und Entwicklung beschreiben: Geschlechtliche Fortpflanzung (Bildung von Eiern im Eierstock der Weibchen, Bildung von Samenzellen im Hoden der Männchen, innere Befruchtung, befruchtetes Ei, Entwicklung des Embryos, Geburt, Entwicklung zum erwachsenen Tier); Säugen der Neugeborenen mit Muttermilch; Unterscheidung zwischen Nesthocker und Nestflüchter", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Blutkreislauf bzw. Aufbau einer einfachen Lunge mit der Modellmethode darstellen',
  'unter Verwendung der Modellmethode z. B. den Blutkreislauf oder den Aufbau einer einfachen Lunge darstellen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-FP-MOD", "thema": "2.2.8 Wirbeltiere", "unterthema": "Fachpraktische Arbeiten (Ernährung, Atmung)", "_source_id": "MNT56-CSV26-2.2.8-FP-MOD", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "unter Verwendung der Modellmethode z. B. den Blutkreislauf oder den Aufbau einer einfachen Lunge darstellen", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Fortbewegung der Ringelnatter an Land (Bauchmuskeln und Bauchschuppen)',
  'die Angepasstheit an Lebensweise und Lebensräume am Beispiel (Ringelnatter) erläutern: Fortbewegung an Land - Bauchmuskeln und Bauchschuppen → Schlängeln',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-ANG-KRI", "thema": "2.2.8 Wirbeltiere", "unterthema": "Angepasstheit an Lebensweise und Lebensräume (Kriechtiere)", "_source_id": "MNT56-CSV26-2.2.8-ANG-KRI", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Angepasstheit an Lebensweise und Lebensräume am Beispiel (Ringelnatter) erläutern: Fortbewegung an Land - Bauchmuskeln und Bauchschuppen → Schlängeln", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Körpermodelle in einer Strömung untersuchen; Bau und Eigenschaften von Federn mit der Lupe',
  'Körpermodelle in einer Luft- oder in einer Wasserströmung untersuchen; Bau und Eigenschaften von Federn mit der Lupe untersuchen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-FP-ANG", "thema": "2.2.8 Wirbeltiere", "unterthema": "Fachpraktische Arbeiten (Angepasstheit)", "_source_id": "MNT56-CSV26-2.2.8-FP-ANG", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "Körpermodelle in einer Luft- oder in einer Wasserströmung untersuchen; Bau und Eigenschaften von Federn mit der Lupe untersuchen", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Die fünf Wirbeltierklassen hinsichtlich ihres Skeletts gegenüberstellen',
  'die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: Skelett (Schädel, Wirbelsäule, Schulter- und Beckengürtel, Arm- und Beinskelett) – unterschiedliche Ausprägung in Anpassung an Fortbewegung',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-GEG-SKE", "thema": "2.2.8 Wirbeltiere", "unterthema": "Gegenüberstellung und Ordnen der Wirbeltierklassen", "_source_id": "MNT56-CSV26-2.2.8-GEG-SKE", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: Skelett (Schädel, Wirbelsäule, Schulter- und Beckengürtel, Arm- und Beinskelett) – unterschiedliche Ausprägung in Anpassung an Fortbewegung", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Die fünf Wirbeltierklassen hinsichtlich Atmung/Atmungsorganen gegenüberstellen',
  'die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: Atmung/Atmungsorgane – Kiemen, Haut, Lunge',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-GEG-ATM", "thema": "2.2.8 Wirbeltiere", "unterthema": "Gegenüberstellung und Ordnen der Wirbeltierklassen", "_source_id": "MNT56-CSV26-2.2.8-GEG-ATM", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: Atmung/Atmungsorgane – Kiemen, Haut, Lunge", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Die fünf Wirbeltierklassen hinsichtlich ihrer Körperbedeckung gegenüberstellen',
  'die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: Körperbedeckung – feuchte, schleimige Haut/trockene Haut mit Hornschuppen, Federn, Haare',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-GEG-KOE", "thema": "2.2.8 Wirbeltiere", "unterthema": "Gegenüberstellung und Ordnen der Wirbeltierklassen", "_source_id": "MNT56-CSV26-2.2.8-GEG-KOE", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: Körperbedeckung – feuchte, schleimige Haut/trockene Haut mit Hornschuppen, Federn, Haare", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Die fünf Wirbeltierklassen hinsichtlich geschlechtlicher Fortpflanzung gegenüberstellen',
  'die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: geschlechtliche Fortpflanzung – äußere/innere Befruchtung, Entwicklung des Embryos innerhalb/außerhalb des Körpers',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.8-GEG-FOR", "thema": "2.2.8 Wirbeltiere", "unterthema": "Gegenüberstellung und Ordnen der Wirbeltierklassen", "_source_id": "MNT56-CSV26-2.2.8-GEG-FOR", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die fünf Wirbeltierklassen gegenüberstellen, Gemeinsamkeiten und Unterschiede nennen sowie Vertreter begründet zuordnen: geschlechtliche Fortpflanzung – äußere/innere Befruchtung, Entwicklung des Embryos innerhalb/außerhalb des Körpers", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Aufnahme der Nährstoffbausteine über den Darm ins Blut und ihre Verwendung als Baustoff/Energielieferant',
  'den Weg der Nährstoffe im Körper beschreiben (DS): Aufnahme der Nährstoffbausteine über den Darm in das Blut und Transport über das Blut; Verwendung der Nährstoffbausteine als Baustoff und als Energielieferant in verschiedenen Körperteilen (z. B. Muskel)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.9-ERN-WEG", "thema": "2.2.9 Der Mensch – Gesunderhaltung", "unterthema": "Ernährung", "_source_id": "MNT56-CSV26-2.2.9-ERN-WEG", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "den Weg der Nährstoffe im Körper beschreiben (DS): Aufnahme der Nährstoffbausteine über den Darm in das Blut und Transport über das Blut; Verwendung der Nährstoffbausteine als Baustoff und als Energielieferant in verschiedenen Körperteilen (z. B. Muskel)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Bedarfsangepasste Ernährung: Zusammenhang zwischen körperlicher Tätigkeit und Ernährung',
  'eine bedarfsangepasste Ernährung erläutern und beurteilen: Zusammenhang zwischen körperlicher Tätigkeit und Ernährung',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.9-ERN-BED", "thema": "2.2.9 Der Mensch – Gesunderhaltung", "unterthema": "Ernährung", "_source_id": "MNT56-CSV26-2.2.9-ERN-BED", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "eine bedarfsangepasste Ernährung erläutern und beurteilen: Zusammenhang zwischen körperlicher Tätigkeit und Ernährung", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Klettverschluss: biologisches Vorbild (Klettfrucht) und Prinzip (Widerhaken)',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern (DS):; Untersuchen von biologischen Vorbildern und Erkennen des Prinzips; Vorbild: Klettfrucht, die am Fell von Tieren haften bleibt, sich aber lösen lässt; Prinzip: biegsame Widerhaken, die bei Verhakung nicht abbrechen und sich immer wieder erneut verhaken können',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-KLE-1", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.1 Der Klettverschluss", "_source_id": "MNT56-CSV26-2.2.10-KLE-1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern (DS):; Untersuchen von biologischen Vorbildern und Erkennen des Prinzips; Vorbild: Klettfrucht, die am Fell von Tieren haften bleibt, sich aber lösen lässt; Prinzip: biegsame Widerhaken, die bei Verhakung nicht abbrechen und sich immer wieder erneut verhaken können", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Klettverschluss: Funktionsmodell entwickeln und technische Umsetzbarkeit prüfen',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern (DS):; Entwickeln eines Funktionsmodells und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: zwei Kunststoffstreifen, wovon einer flexible Widerhäkchen, der andere Schlaufen hat; Prüfen: z. B. Material, Zugbelastung, Haltbarkeit',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-KLE-2", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.1 Der Klettverschluss", "_source_id": "MNT56-CSV26-2.2.10-KLE-2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern (DS):; Entwickeln eines Funktionsmodells und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: zwei Kunststoffstreifen, wovon einer flexible Widerhäkchen, der andere Schlaufen hat; Prüfen: z. B. Material, Zugbelastung, Haltbarkeit", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Klettverschluss: Erkenntnisse auf technische Objekte übertragen',
  'Übertragen der gewonnenen Erkenntnisse auf technische Objekte; Klettverschluss für Schuhe und Jacken, der leicht und beliebig häufig zu öffnen und zu schließen ist',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-KLE-3", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.1 Der Klettverschluss", "_source_id": "MNT56-CSV26-2.2.10-KLE-3", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "Übertragen der gewonnenen Erkenntnisse auf technische Objekte; Klettverschluss für Schuhe und Jacken, der leicht und beliebig häufig zu öffnen und zu schließen ist", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Klettverschluss: biologisches Vorbild und technische Umsetzung vergleichen',
  'das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-KLE-4", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.1 Der Klettverschluss", "_source_id": "MNT56-CSV26-2.2.10-KLE-4", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Früchte einer Klettfrucht (Widerhaken) mit der Lupe betrachten',
  'kriteriengeleitet betrachten: Früchte einer Klettfrucht (Widerhaken) mit der Lupe betrachten',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-KLE-FP1", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "Fachpraktische Arbeiten (Klettverschluss)", "_source_id": "MNT56-CSV26-2.2.10-KLE-FP1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "kriteriengeleitet betrachten: Früchte einer Klettfrucht (Widerhaken) mit der Lupe betrachten", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Haft- und Klettband eines Klettverschlusses mit der Lupe betrachten',
  'kriteriengeleitet betrachten: Haft- und Klettband eines Klettverschlusses (z. B. aus Polyamid) mit der Lupe betrachten',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-KLE-FP2", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "Fachpraktische Arbeiten (Klettverschluss)", "_source_id": "MNT56-CSV26-2.2.10-KLE-FP2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "kriteriengeleitet betrachten: Haft- und Klettband eines Klettverschlusses (z. B. aus Polyamid) mit der Lupe betrachten", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Leichtbauweise: biologisches Vorbild (Bienenwaben, Knochen, Palmenblätter) und Prinzip',
  'die Schrittfolge der Bionik am konkreten Beispiel anwenden: Untersuchen von biologischen Vorbildern und Erkennen des Prinzips; Vorbild: feste, aber leichte Strukturen z. B. bei Bienenwaben, Knochen, Palmenblätter; Prinzip: hohe Stabilität bei geringem Materialeinsatz, z. B. durch Faltung',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LEI-1", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.2 Die Leichtbauweise", "_source_id": "MNT56-CSV26-2.2.10-LEI-1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel anwenden: Untersuchen von biologischen Vorbildern und Erkennen des Prinzips; Vorbild: feste, aber leichte Strukturen z. B. bei Bienenwaben, Knochen, Palmenblätter; Prinzip: hohe Stabilität bei geringem Materialeinsatz, z. B. durch Faltung", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Leichtbauweise: Funktionsmodell entwickeln und technische Umsetzbarkeit prüfen',
  'die Schrittfolge der Bionik am konkreten Beispiel anwenden: Entwickeln eines Funktionsmodells und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: selbstversteifende Wirkung von Wölb- und Faltungsstrukturen; Prüfen: Zusammenhang zwischen Strukturen und Festigkeit (Druckbelastung)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LEI-2", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.2 Die Leichtbauweise", "_source_id": "MNT56-CSV26-2.2.10-LEI-2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel anwenden: Entwickeln eines Funktionsmodells und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: selbstversteifende Wirkung von Wölb- und Faltungsstrukturen; Prüfen: Zusammenhang zwischen Strukturen und Festigkeit (Druckbelastung)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Leichtbauweise: Erkenntnisse auf technische Objekte übertragen (Brücken, Dächer, Verpackungen)',
  'die Schrittfolge der Bionik am konkreten Beispiel anwenden: Übertragen der gewonnenen Erkenntnisse auf technische Objekte; Bau von Brücken und Dächern, Verpackungsmaterialien',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LEI-3", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.2 Die Leichtbauweise", "_source_id": "MNT56-CSV26-2.2.10-LEI-3", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel anwenden: Übertragen der gewonnenen Erkenntnisse auf technische Objekte; Bau von Brücken und Dächern, Verpackungsmaterialien", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Leichtbauweise: biologisches Vorbild und technische Umsetzung vergleichen',
  'das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LEI-4", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.2 Die Leichtbauweise", "_source_id": "MNT56-CSV26-2.2.10-LEI-4", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Forschendes Lernen am Beispiel eines Brückenmodells',
  'die Methode des Forschenden Lernens am Beispiel eines Brückenmodells anwenden:; Formulieren von Fragen: Konstruktion einer leichten, stabilen Brücke (Modell) (KB); Formulieren von Vermutungen: Zusammenhang von Bauweise und Stabilität; Planen von Experimenten zur Überprüfung der Vermutungen: Untersuchen von Vorbildern aus der Natur: Betrachten des Querschnitts eines Knochens mit der Lupe oder Betrachten der Struktur eines Palmenblatts sowie Erkennen des Prinzips; Planen von Funktionsmodellen (Faltkonstruktionen) (KB); Durchführen von Experimenten: einfache Brückenmodelle (verschiedene Faltkonstruktionen, unterschiedliche Materialien) bauen, variieren und auf Stabilität testen (KB); Beobachten und Dokumentieren von Messergebnissen; Auswerten der Ergebnisse und Beantworten der gestellten Fragen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LEI-FP", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "Fachpraktische Arbeiten (Brückenmodell)", "_source_id": "MNT56-CSV26-2.2.10-LEI-FP", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Methode des Forschenden Lernens am Beispiel eines Brückenmodells anwenden:; Formulieren von Fragen: Konstruktion einer leichten, stabilen Brücke (Modell) (KB); Formulieren von Vermutungen: Zusammenhang von Bauweise und Stabilität; Planen von Experimenten zur Überprüfung der Vermutungen: Untersuchen von Vorbildern aus der Natur: Betrachten des Querschnitts eines Knochens mit der Lupe oder Betrachten der Struktur eines Palmenblatts sowie Erkennen des Prinzips; Planen von Funktionsmodellen (Faltkonstruktionen) (KB); Durchführen von Experimenten: einfache Brückenmodelle (verschiedene Faltkonstruktionen, unterschiedliche Materialien) bauen, variieren und auf Stabilität testen (KB); Beobachten und Dokumentieren von Messergebnissen; Auswerten der Ergebnisse und Beantworten der gestellten Fragen", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Nebeltrinkerkäfer: biologisches Vorbild (Wassergewinnung) und Prinzip',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern: Untersuchen von biologischen Vorbildern „Wassergewinnung des Nebeltrinkerkäfers" und Erkennen des Prinzips; Vorbild: Flügeldecken mit kleinen Höckern → Kondensation von Wasserdampf; Rillen → Transport der Wassertröpfchen zum Mund des Käfers; Prinzip: „wasserliebende" Stoffe mit vergrößerter Oberfläche → Kondensation; Rillen aus „wasserabweisenden" Stoffen → Transport von Wasser',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-NEB-1", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.3 Vom Nebeltrinkerkäfer zur Trinkwassergewinnung", "_source_id": "MNT56-CSV26-2.2.10-NEB-1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern: Untersuchen von biologischen Vorbildern „Wassergewinnung des Nebeltrinkerkäfers\" und Erkennen des Prinzips; Vorbild: Flügeldecken mit kleinen Höckern → Kondensation von Wasserdampf; Rillen → Transport der Wassertröpfchen zum Mund des Käfers; Prinzip: „wasserliebende\" Stoffe mit vergrößerter Oberfläche → Kondensation; Rillen aus „wasserabweisenden\" Stoffen → Transport von Wasser", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Nebeltrinkerkäfer: Funktionsmodelle entwickeln und technische Umsetzbarkeit prüfen',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern: Entwickeln von Funktionsmodellen und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: Netze zur Kondensation von Wasserdampf; Ablaufrinnen zum Auffangen des kondensierten Wassers; Prüfen: Menge des gewonnenen Wassers an verschiedenen Netzen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-NEB-2", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.3 Vom Nebeltrinkerkäfer zur Trinkwassergewinnung", "_source_id": "MNT56-CSV26-2.2.10-NEB-2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern: Entwickeln von Funktionsmodellen und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: Netze zur Kondensation von Wasserdampf; Ablaufrinnen zum Auffangen des kondensierten Wassers; Prüfen: Menge des gewonnenen Wassers an verschiedenen Netzen", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Nebeltrinkerkäfer: Erkenntnisse auf technische Objekte übertragen (Nebelkollektoren)',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern: Übertragen der gewonnenen Erkenntnisse auf technische Objekte; Nebelkollektoren (Netze und Auffangvorrichtungen) zur Gewinnung von Trinkwasser in Trockengebieten',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-NEB-3", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.3 Vom Nebeltrinkerkäfer zur Trinkwassergewinnung", "_source_id": "MNT56-CSV26-2.2.10-NEB-3", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern: Übertragen der gewonnenen Erkenntnisse auf technische Objekte; Nebelkollektoren (Netze und Auffangvorrichtungen) zur Gewinnung von Trinkwasser in Trockengebieten", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Nebeltrinkerkäfer: biologisches Vorbild und technische Umsetzung vergleichen',
  'das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-NEB-4", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.3 Vom Nebeltrinkerkäfer zur Trinkwassergewinnung", "_source_id": "MNT56-CSV26-2.2.10-NEB-4", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Modell einer Nebelfangeinrichtung gestalten, variieren und auf Effizienz untersuchen',
  'ein Modell einer Nebelfangeinrichtung gestalten, variieren (z. B. unterschiedliche Maschengröße des Netzes) und auf Effizienz untersuchen (KB)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-NEB-FP", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "Fachpraktische Arbeiten (Nebelfang)", "_source_id": "MNT56-CSV26-2.2.10-NEB-FP", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "ein Modell einer Nebelfangeinrichtung gestalten, variieren (z. B. unterschiedliche Maschengröße des Netzes) und auf Effizienz untersuchen (KB)", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Lotuseffekt: biologisches Vorbild (Laubblätter) und Prinzip (Wachsnoppen)',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern: Untersuchen von biologischen Vorbildern und Erkennen des Prinzips; Vorbild: Laubblätter, von denen Wassertropfen abperlen und dabei Schmutzteilchen mitnehmen; Prinzip: Oberfläche mit Wachsnoppen → Adhäsion eines Wassertropfens größer als Kohäsion → Abperlen der Wassertropfen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LOT-1", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.4 Der Lotuseffekt", "_source_id": "MNT56-CSV26-2.2.10-LOT-1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern: Untersuchen von biologischen Vorbildern und Erkennen des Prinzips; Vorbild: Laubblätter, von denen Wassertropfen abperlen und dabei Schmutzteilchen mitnehmen; Prinzip: Oberfläche mit Wachsnoppen → Adhäsion eines Wassertropfens größer als Kohäsion → Abperlen der Wassertropfen", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Lotuseffekt: Funktionsmodell entwickeln und technische Umsetzbarkeit prüfen',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern: Entwickeln eines Funktionsmodells und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: Verhalten von Wasser auf wasserabweisender, genoppter Oberfläche; Prüfen: verschiedene Materialien mit entsprechenden Oberflächen',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LOT-2", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.4 Der Lotuseffekt", "_source_id": "MNT56-CSV26-2.2.10-LOT-2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern: Entwickeln eines Funktionsmodells und Prüfen der technischen Umsetzbarkeit; Funktionsmodell: Verhalten von Wasser auf wasserabweisender, genoppter Oberfläche; Prüfen: verschiedene Materialien mit entsprechenden Oberflächen", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Lotuseffekt: Erkenntnisse auf technische Objekte übertragen (Autolacke, Textilien)',
  'die Schrittfolge der Bionik am konkreten Beispiel erläutern: Übertragen der gewonnenen Erkenntnisse auf technische Objekte (z. B. Autolacke, wasserabweisende Materialien für Zeltplanen, Wetterjacken und Schuhe)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LOT-3", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.4 Der Lotuseffekt", "_source_id": "MNT56-CSV26-2.2.10-LOT-3", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "die Schrittfolge der Bionik am konkreten Beispiel erläutern: Übertragen der gewonnenen Erkenntnisse auf technische Objekte (z. B. Autolacke, wasserabweisende Materialien für Zeltplanen, Wetterjacken und Schuhe)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Lotuseffekt: biologisches Vorbild und technische Umsetzung vergleichen',
  'das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LOT-4", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "10.4 Der Lotuseffekt", "_source_id": "MNT56-CSV26-2.2.10-LOT-4", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "das biologische Vorbild und die technische Umsetzung vergleichen (das beiden zugrunde liegende Prinzip als Gemeinsamkeit)", "unterthema_origin": "curriculum"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Verhalten von Wassertropfen auf Laubblättern mit unterschiedlicher Oberflächenbeschaffenheit beobachten',
  'Verhalten von Wassertropfen auf Laubblättern mit unterschiedlicher Oberflächenbeschaffenheit beobachten (z. B. Laubblätter von Kohlrabi, Gartenkresse, Erdbeere)',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LOT-FP1", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "Fachpraktische Arbeiten (Lotuseffekt)", "_source_id": "MNT56-CSV26-2.2.10-LOT-FP1", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "Verhalten von Wassertropfen auf Laubblättern mit unterschiedlicher Oberflächenbeschaffenheit beobachten (z. B. Laubblätter von Kohlrabi, Gartenkresse, Erdbeere)", "unterthema_origin": "curriculum_modified"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (
  '1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'performance_indicator',
  'Modellversuche zu Wassertropfen auf verschiedenen Oberflächen durchführen',
  'Modellversuche „Wassertropfen auf verschiedenen Oberflächen" durchführen, z. B.; Verhalten von Wassertropfen auf wasserliebenden und auf wasserabweisenden Oberflächen (z. B. unbehandelter und gewachster Baumwollstoff); Kontaktauflage eines wassergefüllten Ballons auf einer glatten und auf einer genoppten Oberfläche (z. B. Eierkarton, Akustikschaumstoff); „Mitnahme" von Rußteilchen beim Abrollen von Wassertropfen über eine schräg gestellte, berußte Glasplatte',
  '5/6', 'Biologie',
  '{"id": "MNT56-CSV26-2.2.10-LOT-FP2", "thema": "2.2.10 Bionik - vom Entdecken zum Erfinden", "unterthema": "Fachpraktische Arbeiten (Lotuseffekt)", "_source_id": "MNT56-CSV26-2.2.10-LOT-FP2", "_source_file": "LP_Thueringen_Gym_5_6_MNT_susan_2026_10_23.csv", "originaltext": "Modellversuche „Wassertropfen auf verschiedenen Oberflächen\" durchführen, z. B.; Verhalten von Wassertropfen auf wasserliebenden und auf wasserabweisenden Oberflächen (z. B. unbehandelter und gewachster Baumwollstoff); Kontaktauflage eines wassergefüllten Ballons auf einer glatten und auf einer genoppten Oberfläche (z. B. Eierkarton, Akustikschaumstoff); „Mitnahme\" von Rußteilchen beim Abrollen von Wassertropfen über eine schräg gestellte, berußte Glasplatte"}'::jsonb,
  'evomentor_de_lernziel_v1.2', 'accepted'
);

