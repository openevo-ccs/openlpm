-- Thuringia MNT (grade 5/6) 2026 restructuring: real content, built from the
-- actual new and old curriculum documents, not guessed.
--
-- Triggered by real feedback from Susan Hanisch (Uni Jena, OpenLPM's first
-- intensive pilot user), relayed by Dustin 2026-10-04: she wasn't seeing the
-- state of Thuringia's grade 5/6 updates reflected in the live
-- evomentor-thuringia project. Checking the actual live database directly
-- (not relying on prior session notes) showed why: an earlier pass
-- (2026-10-02) had already added the genuinely NEW 2026 content (migration
-- 086 -- the four Bionik case studies, Kohaesion/Adhaesion, two health-ed
-- items) and confirmed it live, but never did the actual RESTRUCTURING --
-- re-filing the 121 pre-existing items from their old 2015 "Modul" labels
-- into the real 2026 "Lernbereich" structure, which is exactly the
-- "arrangement changed" update Susan was asking about. This migration does
-- that restructuring, plus resolves the one real open question that pass
-- left unanswered: whether the ~41 items with no visible 2026 counterpart
-- actually moved to a later grade/subject or were genuinely cut.
--
-- That open question is answered here with real primary-source checking,
-- not guesswork: the new grade 7-10 "Physik und Astronomie" curriculum
-- (Erprobungsfassung 2026) was downloaded live from
-- schulportal-thueringen.de (tspi=20567, same publication batch as the
-- Bio/MNT 2026 documents already in this repo) and read directly via
-- pdftotext, alongside the existing Biologie 2026 and MNT 2026 documents --
-- not previously checked anywhere in this ecosystem. Every one of the ~41
-- "dropped"/"dropped-probable" items from
-- EvoMentor_DE/data/thuringia_2026_lp_data/MNT 2026 Item-Level
-- Lernziele-Diff.csv was checked by hand against all three documents for
-- its specific vocabulary (Hebel/Goldene Regel der Mechanik,
-- Waermeuebertragung, Bewegung/Kraft/Auftrieb, Oekosystem/Nahrungskette,
-- Mikroskop, artgerecht, Sucht/Alkohol, Herbar, Bestimmungsschluessel,
-- Klimadiagramm, Regelkreis, Rohstoff, Flugapparat, Witterung, and more).
SET search_path = public, extensions;

-- ============================================================
-- Part 1: re-file the 80 existing grade 5/6 MNT items that are still
-- genuinely taught in Thuringia's new 2026 MNT curriculum, from their
-- old 2015 "Modul" label to the real 2026 "Lernbereich" label they now
-- live under. No wording changes -- this is purely which unit each item
-- is filed under, using the item-by-item mapping already built and
-- checked against the real 2026 document (EvoMentor_DE/data/
-- thuringia_2026_lp_data/MNT 2026 Item-Level Lernziele-Diff.csv).
-- ============================================================

-- MNT-56-M1-NWA-1a (same): Fragen an die Natur stellen
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden"'), updated_at = now() WHERE id = '5505cca7-ad59-559a-b52d-e189e6216f3e';

-- MNT-56-M1-NWA-1b (same): Vermutungen aufstellen
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden"'), updated_at = now() WHERE id = '6d6870cc-6989-589c-8d9c-a9c646ed6d2f';

-- MNT-56-M1-NWA-1c (reworded-narrowed): Fragen mit Beobachtung/Experiment beantworten, Grenzen erkennen
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden"'), updated_at = now() WHERE id = '59217437-cc96-52b4-af1c-972d77c7a4b2';

-- MNT-56-M1-NWA-2a (reworded-narrowed): Sinne bewusst zum Beobachten nutzen; Möglichkeiten/Grenzen erkennen
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden"'), updated_at = now() WHERE id = 'ba79c252-b7ab-569e-9ea5-0ffc6ba38dfc';

-- MNT-56-M1-NWA-2b (reworded-expanded): Hilfsmittel sachgerecht nutzen (messen/beobachten)
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden"'), updated_at = now() WHERE id = 'a518c1c4-1286-552b-9155-6e3e30e0ff3e';

-- MNT-56-M1-NWA-3a (moved): Sachverhalte den Bereichen Mensch/Natur/Technik zuordnen
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.2 Mensch – Natur – Technik
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.2 Mensch – Natur – Technik"'), updated_at = now() WHERE id = 'de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7';

-- MNT-56-M1-NWA-3c (moved): Vernetzung von Mensch, Natur, Technik erläutern
--   Modul 1: Naturwissenschaftliches Arbeiten -> 2.2.2 Mensch – Natur – Technik
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.2 Mensch – Natur – Technik"'), updated_at = now() WHERE id = 'a8d25f6e-9820-53fd-93d3-b251c863c9b6';

-- MNT-56-M2-PFL-1a (same): Bau von Samenpflanzen betrachten/beschreiben
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'b6489681-7c40-5ae6-adb9-a8e0d73cc33e';

-- MNT-56-M2-PFL-1b (same): Pflanzenorgane benennen (Wurzel/Sprossachse/Laubblätter/Blüten)
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '4d321a47-3a11-5f77-b541-08b5df7918f8';

-- MNT-56-M2-PFL-2 (same): Samenpflanzen vergleichen: Vielfalt-gleicher-Grundaufbau
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'd0d80b71-0e1f-576c-a3ad-a9600c4c5e40';

-- MNT-56-M2-PFL-3 (moved): Begriff Samenpflanze definieren
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '8af9598d-58d6-55c5-89ca-d575f9f9ed26';

-- MNT-56-M2-FOR-2 (same): Blütenbau beschreiben/vergleichen
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'b4f4976a-06d2-5886-8934-4ef6446e797f';

-- MNT-56-M2-FOR-3 (reworded-expanded): Fortpflanzung/Entwicklung von Samenpflanzen beschreiben
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'c41dc217-6ba3-57b4-9cde-de22d68bebf8';

-- MNT-56-M2-FOR-4 (same): Keimungs-/Wachstumsbedingungen nennen
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '02e3a499-d497-5bfc-82fb-e23491526c0a';

-- MNT-56-M2-FOR-5 (same): Geschlechtliche/ungeschlechtliche Fortpflanzung vergleichen
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'd7934092-7129-541e-b4b5-631e42b700e6';

-- MNT-56-M2-FPA-2 (reworded-expanded): Blüten zergliedern
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'c7c1a118-efda-59ea-8ff2-5a0357724320';

-- MNT-56-M2-FPA-3 (same): Keimungs-/Wachstumsbedingungen ermitteln
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '42c9090a-e55a-53c4-ba6f-7d6c26f838c7';

-- MNT-56-M2-NAC-1 (reworded-expanded): Nachweis von Stärke/Fett in Samen
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '206e608f-bc89-525c-8dfd-48d4ffcf7ee4';

-- MNT-56-M2-ERN-2 (reworded-expanded): Fotosynthese: Herstellung körpereigener Stoffe
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '1fdb5b8b-238f-5042-a8e2-07ed83535545';

-- MNT-56-M2-ERN-3 (reworded-expanded): Wasseraufnahme (Oberflächenvergrößerung)/Transport beschreiben
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '9fc5fa06-610c-5212-aac5-cf05c7bcb300';

-- MNT-56-M2-FPA-4a (moved): Untersuchungen: Kapillarität
--   Modul 2: Samenpflanzen -> 2.2.5 Kohäsion, Adhäsion, Kapillarität
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.5 Kohäsion, Adhäsion, Kapillarität"'), updated_at = now() WHERE id = 'f2cc5aa7-8c66-5885-956e-21866e332b01';

-- MNT-56-M2-FPA-4b (same): Untersuchungen: Wasserleitung in der Sprossachse
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'ffcb41d6-c83f-566a-babc-f77ff4531eef';

-- MNT-56-M2-AUF-1 (moved): Teilchenmodell/Aggregatzustände erläutern
--   Modul 2: Samenpflanzen -> 2.2.3 Körper – Stoffe – Eigenschaften
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.3 Körper – Stoffe – Eigenschaften"'), updated_at = now() WHERE id = '4b3d2b67-a944-5436-975b-c5b98625566d';

-- MNT-56-M2-AUF-2 (moved): Temperatur/Teilchenbewegung erläutern
--   Modul 2: Samenpflanzen -> 2.2.3 Körper – Stoffe – Eigenschaften
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.3 Körper – Stoffe – Eigenschaften"'), updated_at = now() WHERE id = '03a9bc29-e441-5a5d-b9bc-2327156d35b9';

-- MNT-56-M2-AUF-3 (moved): Reinstoffe/Stoffgemische vergleichen
--   Modul 2: Samenpflanzen -> 2.2.3 Körper – Stoffe – Eigenschaften
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.3 Körper – Stoffe – Eigenschaften"'), updated_at = now() WHERE id = '7f692716-6082-55db-bb9d-2788c9411a0f';

-- MNT-56-M2-AUF-4a (moved): Stoffeigenschaften <-> Trennverfahren
--   Modul 2: Samenpflanzen -> 2.2.3 Körper – Stoffe – Eigenschaften
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.3 Körper – Stoffe – Eigenschaften"'), updated_at = now() WHERE id = '1672e278-f278-5617-b572-467120bdbdd4';

-- MNT-56-M2-AUF-4b (moved): Stoffgemische trennen (Dekantieren/magn. Trennung/Eindampfen)
--   Modul 2: Samenpflanzen -> 2.2.2 Mensch – Natur – Technik + 2.2.3 Körper – Stoffe – Eigenschaften
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.2 Mensch – Natur – Technik + 2.2.3 Körper – Stoffe – Eigenschaften"'), updated_at = now() WHERE id = '10cc8691-99e6-516d-832f-061141793176';

-- MNT-56-M2-AUF-5 (absorbed-crosscutting): Temperaturmessungen durchführen
--   Modul 2: Samenpflanzen -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = '3e791200-6110-568b-8fa5-82cc9238f089';

-- MNT-56-M2-UMW-1 (moved): Stoffumwandlungen an einfachen Beispielen beschreiben
--   Modul 2: Samenpflanzen -> 2.2.4 Chemische Reaktionen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.4 Chemische Reaktionen"'), updated_at = now() WHERE id = '748857e0-ac20-5867-8351-796eeb6611e9';

-- MNT-56-M2-UMW-3 (moved): Stoffumwandlungen experimentell (Kerzenwachs, Eisenwolle)
--   Modul 2: Samenpflanzen -> 2.2.4 Chemische Reaktionen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.4 Chemische Reaktionen"'), updated_at = now() WHERE id = '68461c4a-2927-5ae2-bc27-2c61228a018a';

-- MNT-56-M2-ORD-1a (same): Nach Wuchsformen ordnen (Kräuter/Sträucher/Bäume)
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '03a9004d-853c-5a29-a911-597aaf8b8127';

-- MNT-56-M2-ORD-1b (same): Nach Nutzung ordnen (Wild-/Kulturpflanzen)
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = '364e7135-e167-521f-abd9-a5d401237a1d';

-- MNT-56-M2-ORD-1c (reworded-expanded): Nach Verwandtschaft ordnen (Pflanzenfamilien)
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'd3bc4da1-e7d0-54a0-ba53-88d20cb2b784';

-- MNT-56-M2-ORD-2 (reworded-narrowed): Zwei Pflanzenfamilien definieren
--   Modul 2: Samenpflanzen -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'b60088aa-780c-5a06-83df-2c25d0d9a760';

-- MNT-56-M3-WIR-1 (same): Bau verschiedener Wirbeltiere beschreiben/vergleichen
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = 'afa7d719-fb4c-5410-afa6-1ce2e3182128';

-- MNT-56-M3-WIR-2 (reworded-expanded): Begriff Wirbeltier definieren
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '015d0a14-02d0-5ded-8244-bf1876f2a951';

-- MNT-56-M3-WIR-3 (same): Wirbeltierklassen und Vertreter nennen
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '6fde47d3-6de9-531a-8a50-3ad783413c57';

-- MNT-56-M3-ERN-2 (reworded-narrowed): Körpereigene Stoffe mit Teilchenmodell beschreiben
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = 'b62370af-2fe2-5a6c-9b4a-f65a7b008337';

-- MNT-56-M3-ERN-3 (same): Blut als Transportmedium erläutern
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '61336f13-3e2a-5d89-b720-bc019a870094';

-- MNT-56-M3-NAC-1 (moved): Nachweis von Stärke/Fett in Nahrungsmitteln
--   Modul 3: Wirbeltiere -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '01c1fd65-e510-5aa8-b238-3e83bf997ef6';

-- MNT-56-M3-ATM-1 (reworded-expanded): Bau der Atmungsorgane <-> Lebensraum (Kiemen/Haut/Lunge)
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = 'b2dc23c5-661a-532c-8247-2829885f1d2f';

-- MNT-56-M3-ATM-2 (same): Gasaustausch + Bedeutung des Sauerstoffs
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '905a4704-c4fc-5ed8-b46f-589338375239';

-- MNT-56-M3-FBW-1 (reworded-expanded): Körperbau/Fortbewegung/Lebensraum (Struktur-Funktion)
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = 'f4d3b010-c86d-5569-9737-6c776e803acc';

-- MNT-56-M3-FOR-2 (reworded-expanded): Befruchtungsformen vergleichen/definieren
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '47322576-0224-581b-a15c-5a2b08ad7247';

-- MNT-56-M3-FOR-3 (reworded-expanded): Befruchtung/Eibau/Entwicklung/Lebensraum verknüpfen
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '37cce1bb-7cbf-5c24-bb71-51277b0c612a';

-- MNT-56-M3-ENE-1 (moved): Verbrennung als Stoffumwandlung mit Sauerstoff
--   Modul 3: Wirbeltiere -> 2.2.4 Chemische Reaktionen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.4 Chemische Reaktionen"'), updated_at = now() WHERE id = '341b6c40-ed57-586e-91ab-587f4f0c6721';

-- MNT-56-M3-KRA-3 (reworded-narrowed): Strömungsverläufe beschreiben (Stromlinienkörper/Flügel/Verwirbelung)
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = 'c1cc6b14-9c5f-5f0d-a0a0-8ebc9d635eb8';

-- MNT-56-M3-FPA-1b (moved): Volumen von Körpern experimentell ermitteln
--   Modul 3: Wirbeltiere -> 2.2.3 Körper – Stoffe – Eigenschaften
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.3 Körper – Stoffe – Eigenschaften"'), updated_at = now() WHERE id = '7c0b5e01-c875-5781-a758-6a28ce4d1e07';

-- MNT-56-M3-ORD-1a (same): Nach Verwandtschaft ordnen (Wirbeltierklassen)
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = 'f6c0b12c-177d-57f5-9baf-4fbc1f080af9';

-- MNT-56-M3-ORD-1b (reworded-expanded): Nach Nutzung ordnen (Heim-/Nutz-/Wildtiere)
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '393ea953-4880-51f3-9503-6f8b534f3126';

-- MNT-56-M3-ORD-2 (same): Merkmale der 5 Wirbeltierklassen nennen, Beispiele zuordnen
--   Modul 3: Wirbeltiere -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '5addd20b-ae9a-5ac2-9c45-f7d2ed1a242d';

-- MNT-56-M4-GES-1 (reworded-expanded): Vorbeugung von Haltungsschäden begründen
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = 'df9b858f-e765-5fef-be27-d90b789b3da6';

-- MNT-56-M4-GES-2 (reworded-expanded): Gesundheitsfördernde Ernährung begründen
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '678fe211-d660-5bbe-bb8d-5688ec0b8781';

-- MNT-56-M4-GES-4 (reworded-narrowed): Körperhygiene begründen (Zahnpflege/Hautschutz)
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '32a2ac6a-65ac-5380-9bec-ef7160df2fb7';

-- MNT-56-M4-ERN-1 (reworded-expanded): Nahrungsmittel nach Nährstoffen/Energiegehalt ordnen
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '05deb095-b225-5d30-930e-b12966e4d6bb';

-- MNT-56-M4-SEX-1 (reworded-expanded): Körperliche/Verhaltensänderungen in der Pubertät nennen
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '1f1f0869-8f45-5a69-8681-1b36b73e7699';

-- MNT-56-M4-SEX-2 (same): Geschlechtsorgane + Menstruation/Pollution beschreiben
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '6e32379d-010e-58a6-91b7-384f7779e9bc';

-- MNT-56-M4-SEX-3 (reworded-expanded): Fortpflanzung/Entwicklung des Menschen beschreiben
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = '502540d2-8051-58e4-bcef-4b0f2fc931ca';

-- MNT-56-M4-SEX-4 (same): Hygiene der Geschlechtsorgane begründen
--   Modul 4: Gesunderhaltung -> 2.2.9 Der Mensch – Gesunderhaltung
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = 'd9247686-f293-5d47-9cc1-bd53150143ee';

-- MNT-56-M5-LR-3 (reworded-narrowed): Bau/Lebensweise/Lebensraum (Struktur-Funktion: Temp/Aktivität, Körperbedeckung/Dämmung, Farbe/Tarnung)
--   Modul 5: Leben in einem Lebensraum -> 2.2.8 Wirbeltiere
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now() WHERE id = '30abcc70-ab22-52c9-87f0-895e38202d5f';

-- MNT-56-M5-LR-7 (moved-narrowed): Auswirkungen von Lebensraumveränderungen erläutern
--   Modul 5: Leben in einem Lebensraum -> 2.2.8 Wirbeltiere (Schutz von Wirbeltieren)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere (Schutz von Wirbeltieren)"'), updated_at = now() WHERE id = '8943afd8-3ac7-525f-a4df-bce4f8d264c3';

-- MNT-56-M5-FPA-1a (reworded-narrowed): Lupe und Mikroskop sachgerecht handhaben
--   Modul 5: Leben in einem Lebensraum -> 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(content, '{thema}', '"2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden"'), '{migration_note_2026}', '"Dieses Lernziel verband ursprünglich zwei Fertigkeiten. Die Lupe bleibt als wiederkehrendes Hilfsmittel erhalten (jetzt verteilt über mehrere Lernbereiche: Samenpflanzen, Wirbeltiere, Bionik). Das Mikroskopieren selbst kommt im neuen Klasse-5/6-Dokument nirgends mehr vor -- es erscheint aber breit in der Biologie ab Klasse 7, bereits als eigenes Fach in OpenLPM vorhanden."'), updated_at = now() WHERE id = '4b6fd514-838b-5ec7-84d5-5883dcb43f06';

-- MNT-56-M5-NUT-1 (moved-narrowed): Nutzung von Pflanzen UND Tieren begründen
--   Modul 5: Leben in einem Lebensraum -> 2.2.7 Samenpflanzen
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.7 Samenpflanzen"'), updated_at = now() WHERE id = 'b4055e65-e605-5b8c-b6d8-1cc21947800c';

-- MNT-56-M5-MEN-1a (moved-narrowed): Einfluss von Eingriffen auf einzelne Lebewesen bewerten
--   Modul 5: Leben in einem Lebensraum -> 2.2.8 Wirbeltiere (Schutz von Wirbeltieren)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere (Schutz von Wirbeltieren)"'), updated_at = now() WHERE id = 'af819a99-ad45-50bf-a00f-3b989fb5ab6c';

-- MNT-56-M5-MEN-1b (moved-narrowed): Einfluss von Eingriffen auf den Lebensraum bewerten
--   Modul 5: Leben in einem Lebensraum -> 2.2.8 Wirbeltiere (Schutz von Wirbeltieren)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere (Schutz von Wirbeltieren)"'), updated_at = now() WHERE id = 'ff60d353-d357-5efa-9f78-527d45f1eec9';

-- MNT-56-M5-MEN-2 (moved-narrowed): Umweltschutz begründen (Lebensgrundlagen, Artenschutz)
--   Modul 5: Leben in einem Lebensraum -> 2.2.8 Wirbeltiere (Schutz von Wirbeltieren)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere (Schutz von Wirbeltieren)"'), updated_at = now() WHERE id = 'bac4e87c-18bc-59f2-bd73-cb3bbe2448d4';

-- MNT-56-M5-MED-1a (absorbed-crosscutting): Informationen aus Medien kritisch erschließen, dokumentieren
--   Modul 5: Leben in einem Lebensraum -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = 'af5b32b6-9c93-5ab8-a179-f00d2a875c67';

-- MNT-56-M5-MED-1b (absorbed-crosscutting): Informationen auf Aufgabenrelevanz einschätzen
--   Modul 5: Leben in einem Lebensraum -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = '5af67527-ef92-5b2f-bd5e-7077344fd5e7';

-- MNT-56-M6-BIO-1 (absorbed-crosscutting): Bedeutung von Naturvorbildern für Technik erläutern
--   Modul 6: Bionik -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = 'a65e2a25-f479-5b2b-aae9-34c927152dd2';

-- MNT-56-M6-BIO-2a (reworded-narrowed): Festlegen der technisch zu realisierenden Funktion
--   Modul 6: Bionik -> 2.2.10 Bionik - vom Entdecken zum Erfinden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), updated_at = now() WHERE id = 'fd5a26b5-5f51-5be3-bd09-28c7559e8ce1';

-- MNT-56-M6-BIO-2b (same): Ermittlung biologischer Vorbilder, Erkennen des Prinzips
--   Modul 6: Bionik -> 2.2.10 Bionik - vom Entdecken zum Erfinden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), updated_at = now() WHERE id = '47a3dd16-ade5-58bc-b6a7-e08256bc3672';

-- MNT-56-M6-BIO-2c (same): Entwicklung von Funktionsmodellen
--   Modul 6: Bionik -> 2.2.10 Bionik - vom Entdecken zum Erfinden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), updated_at = now() WHERE id = '68df89df-92ce-55cf-b6f8-b77864fe4a6b';

-- MNT-56-M6-BIO-2d (same): Übertragung der Erkenntnisse auf technische Objekte
--   Modul 6: Bionik -> 2.2.10 Bionik - vom Entdecken zum Erfinden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), updated_at = now() WHERE id = 'a4e7cd8b-f828-59b3-8073-27469dd064bc';

-- MNT-56-M6-PRO-1a (reworded-expanded): Vorgehensweise der Bionik am ausgewählten Beispiel umsetzen
--   Modul 6: Bionik -> 2.2.10 Bionik - vom Entdecken zum Erfinden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), updated_at = now() WHERE id = '858afecb-1cf2-5b96-acdb-155cb9a032b9';

-- MNT-56-M6-PRO-1b (reworded-expanded): Anschauungsmodell herstellen, Bedeutung erläutern
--   Modul 6: Bionik -> 2.2.10 Bionik - vom Entdecken zum Erfinden
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.10 Bionik - vom Entdecken zum Erfinden"'), updated_at = now() WHERE id = '3567aeb7-d9af-5298-b227-533a9df8c167';

-- MNT-56-M6-PRO-2a (absorbed-crosscutting): Lern-/Arbeitsprozess der Gruppe organisieren
--   Modul 6: Bionik -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = 'bd99afc8-8b1d-5c64-9249-a9ac4f0cf981';

-- MNT-56-M6-PRO-2b (absorbed-crosscutting): Arbeitstechniken situationsbezogen auswählen
--   Modul 6: Bionik -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = 'f51b7a9e-5485-5608-be64-bf872ddfcc0f';

-- MNT-56-M6-PRO-2c (absorbed-crosscutting): Eigenes Arbeits-/Sozialverhalten einschätzen
--   Modul 6: Bionik -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = '690d09af-c38b-55a5-908f-aedab943d2d2';

-- MNT-56-M6-PRO-2d (absorbed-crosscutting): Wege/Ergebnisse der Gruppenarbeit analysieren
--   Modul 6: Bionik -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = '92e6dcbf-2396-5c19-a492-a4c931f8ec5c';

-- MNT-56-M6-PRO-2e (absorbed-crosscutting): Arbeitsergebnisse präsentieren
--   Modul 6: Bionik -> Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"Fächerübergreifende Kompetenz (keine feste Lernbereichs-Zuordnung in 2026)"'), updated_at = now() WHERE id = '798b015d-95ce-5eb4-90b3-a5bca6e71833';

-- ============================================================
-- Part 2: resolve the 41 grade 5/6 items that had no obvious home in
-- the 2026 MNT document. Checked directly against three real, primary
-- source documents (not guessed):
--   - LP Thüringen MNT Gym 2026 Erprobungsfassung (already in-repo)
--   - LP Thüringen Bio Gym 2026 Erprobungsfassung (already in-repo)
--   - LP Physik und Astronomie, Gymnasium, Erprobungsfassung 2026
--     (fetched live from schulportal-thueringen.de, tspi=20567/20581,
--     same publication batch as the Bio/MNT 2026 documents -- this is a
--     brand-new grade-7-10 subject curriculum, not previously tracked
--     anywhere in this ecosystem, replacing MNT from grade 7 onward)
--
-- None of these are deleted. All kept as status='archived' (so they stop
-- showing in Browse, per listTopics()'s status filter, but remain
-- queryable history) with a real resolution note in content.migration_note_2026,
-- explaining specifically where the content actually went or why it
-- looks like a genuine cut -- not a generic 'removed' flag.
-- ============================================================

-- MNT-56-M3-BEW-1a [moved to a later grade/subject]: Begriff Bewegung erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Bewegung als Begriff reicht jetzt in die Physik: Thüringens neuer Physik-Lehrplan (Erprobungsfassung 2026, Klassenstufe 9, Lernbereich 2.2.2.1 \"Bewegungen beschreiben\") behandelt Bewegung und Ruhe in Abhängigkeit vom Bezugssystem ausführlich -- bislang nicht als eigener Lerngegenstand in OpenLPM abgebildet, da Physik als Fach hier noch nicht eigenständig erfasst ist."'), updated_at = now() WHERE id = 'ada075bb-f60b-530d-8e70-6f20cf4ecb88';

-- MNT-56-M3-BEW-1b [moved to a later grade/subject]: Geschwindigkeit (Weg/Zeit) qualitativ kennzeichnen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Geschwindigkeit als Größe erscheint jetzt im neuen Physik-Lehrplan (Klassenstufe 9, 2.2.2.1), dort mit Gleichungen und Diagrammen vertieft -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = '14f19e13-d879-5dd5-8228-ce950acd343f';

-- MNT-56-M3-KRA-1 [moved to a later grade/subject]: Kraft als Wechselwirkungsgröße, Kraftarten nennen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Kraft als Begriff findet sich jetzt im neuen Physik-Lehrplan (Klassenstufe 9, Lernbereich 2.2.2.2 \"Kraft als Ursache für Bewegungen\") deutlich vertieft (Kraftwirkungen, Masse vs. Gewichtskraft) -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = 'b9918f2b-0092-53ab-97b3-a3c38f2b12a4';

-- MNT-56-M3-KRA-2 [moved to a later grade/subject]: Auftriebskräfte aus dem Alltag nennen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Auftrieb ist jetzt explizit Teil des neuen Physik-Lehrplans (Klassenstufe 9, 2.2.2.2: \"die Gewichtskraft als Ursache des Schweredrucks... den Auftrieb als Folge des Schweredrucks beschreiben\") -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = '86171694-2fc6-5486-a399-9d10f6836306';

-- MNT-56-M3-FPA-1a [moved to a later grade/subject]: Auftriebskräfte in Wasser experimentell ermitteln
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Das Auftriebs-Experiment selbst ist jetzt im neuen Physik-Lehrplan als Schülerexperiment vorgesehen (Klassenstufe 9, 2.2.2.2: \"Schülerexperiment mit Protokoll: Messung der Auftriebskraft\") -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = 'eb423993-0fe1-5ae7-a77a-2554395d934c';

-- MNT-56-M4-HEB-1a [moved to a later grade/subject]: Hebelgesetz anwenden
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Das Hebelgesetz erscheint jetzt als \"Goldene Regel der Mechanik\" im neuen Physik-Lehrplan (Klassenstufe 10, Lernbereich 2.3.3 \"Erhaltungssätze\"), dort mit Berechnungen vertieft -- gleiches physikalisches Prinzip, später und strenger behandelt. Noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = '775e365b-0fae-53c7-81b8-b90a0bdd8fec';

-- MNT-56-M4-HEB-1b [moved to a later grade/subject]: Hebel im Gleichgewicht experimentell untersuchen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Das Experiment zum Hebel im Gleichgewicht erscheint jetzt im neuen Physik-Lehrplan als Schülerexperiment zur \"Goldenen Regel der Mechanik\" (Klassenstufe 10, 2.3.3) -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = '0508ea86-1052-59a5-83c7-7a2022482216';

-- MNT-56-M4-WAR-1a [moved to a later grade/subject]: Wärme als Energiemaß kennzeichnen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Wärme als physikalische Größe ist jetzt Teil des neuen Physik-Lehrplans (Klassenstufe 8, Lernbereich 2.1.7 \"Wärmelehre\": \"Wärme und thermische Energie als physikalische Größen charakterisieren\") -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = '4facff5c-9169-597f-b5a1-f2624ed26848';

-- MNT-56-M4-WAR-1b [moved to a later grade/subject]: Wärmeübertragung beschreiben
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Wärmeübertragung erscheint wörtlich im neuen Physik-Lehrplan (Klassenstufe 8, 2.1.7: \"Arten der Wärmeübertragung (Leitung, Strömung/Konvektion, Strahlung) beschreiben\") -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = 'cb71013c-06fa-52f0-95a5-fcf093af9c06';

-- MNT-56-M4-WAR-2 [moved to a later grade/subject]: Wärmedämmung erläutern (Gebäude/Technik)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Wärmedämmung erscheint wörtlich im neuen Physik-Lehrplan (Klassenstufe 8, 2.1.7: \"Wärmeübertragung bzw. Wärmedämmung\" als Beispielexperiment) -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = 'e884a95e-18c0-5308-9bec-237befa6c124';

-- MNT-56-M2-UMW-2b [moved to a later grade/subject]: Weitere Energieumwandlungen nennen (z.B. Strahlung)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Energieumwandlungen (inkl. Strahlung) sind jetzt Teil des neuen Physik-Lehrplans (Klassenstufe 7/8, Lernbereich 2.1.4 \"Energie, Energieerhaltung und Energieentwertung\") -- noch nicht als eigenständiges Fach in OpenLPM abgebildet."'), updated_at = now() WHERE id = '45b7b39d-112a-5162-a733-6bf8a219b36e';

-- MNT-56-M5-LR-1 [moved to a later grade/subject]: Lebewesen eines Lebensraums nennen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Lebewesen eines Lebensraums zu nennen ist jetzt Teil des Biologie-Lehrplans (Klassenstufen 7/8, Lernbereich \"Ökosystem\": Biotop/Biozönose, biotische Wechselbeziehungen) -- bereits als eigenes Fach (Biologie Kl. 7/8) in OpenLPM vorhanden, diese spezifische Zuordnung wurde hier aber nicht neu geprüft."'), updated_at = now() WHERE id = '3fe39e9a-7b88-55f0-97dd-1d5b66c58d17';

-- MNT-56-M5-LR-2 [moved to a later grade/subject]: Lebensraum charakterisieren (eigene Beobachtung/Messung)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Einen Lebensraum durch eigene Beobachtung zu charakterisieren ist jetzt Teil des Biologie-Lehrplans Kl. 7/8 (Ökosystem-Lernbereich: ökologischer Toleranzbereich, abiotische/biotische Faktoren) -- bereits als eigenes Fach in OpenLPM vorhanden."'), updated_at = now() WHERE id = '06bbb029-3afe-5f62-b357-ef237013705b';

-- MNT-56-M5-LR-4 [moved to a later grade/subject]: Nahrungsketten beschreiben
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Nahrungsketten erscheinen wörtlich im Biologie-Lehrplan Kl. 7/8 (Ökosystem-Lernbereich) und vertieft in Kl. 9/10 (Trophieebenen) -- bereits als eigenes Fach in OpenLPM vorhanden."'), updated_at = now() WHERE id = 'a1abbe2d-1eb3-5e5a-8b5d-c802cd41026b';

-- MNT-56-M5-LR-5 [moved to a later grade/subject]: Bedeutung des Lebensraums für die Lebensgemeinschaft
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Die Bedeutung des Lebensraums für die Lebensgemeinschaft ist jetzt Teil des Biologie-Ökosystem-Lernbereichs (Kl. 7/8: Ökosystem als Einheit von Biotop und Biozönose) -- bereits als eigenes Fach in OpenLPM vorhanden."'), updated_at = now() WHERE id = 'f0996360-2799-52f3-a596-b0f6bf281163';

-- MNT-56-M5-LR-6 [moved to a later grade/subject]: Veränderungen der Lebensgemeinschaft über Zeit beschreiben
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Veränderungen der Lebensgemeinschaft über Zeit sind jetzt Teil des Biologie-Ökosystem-Lernbereichs (Kl. 7/8, vertieft Kl. 9/10: räumliche und zeitliche Struktur von Ökosystemen, Stabilität) -- bereits als eigenes Fach in OpenLPM vorhanden."'), updated_at = now() WHERE id = '52d96368-757a-55c1-aabc-6d607f9894fb';

-- MNT-56-M5-FPA-1b [moved to a later grade/subject]: Präparate anfertigen und mikroskopieren
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Mikroskopieren wird nicht aufgegeben -- der Begriff \"Mikroskop\" kommt im Biologie-Lehrplan 2026 an über einem Dutzend Stellen in Kl. 7-10 vor (Zellbiologie, Genetik u.a.) -- bereits breit als eigenes Fach in OpenLPM vorhanden, nur nicht mehr als eigener Punkt in Klasse 5/6."'), updated_at = now() WHERE id = '69eae84c-d2dc-58fe-9a72-6567d186464f';

-- MNT-56-M5-NUT-2 [moved to a later grade/subject]: Artgerechte Haltung/Pflege ableiten, begründen, bewerten
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Artgerechte Tierhaltung bleibt erhalten: das Wort \"artgerecht\" erscheint im Biologie-Lehrplan 2026, und MNT 2026 selbst führt im Wirbeltiere-Lernbereich (2.2.8) einen neuen Unterpunkt \"Schutz von Wirbeltieren\" -- nicht gestrichen, nur anders zugeordnet."'), updated_at = now() WHERE id = '342a95b6-2e0c-51b9-bb0d-6541ae099fe9';

-- MNT-56-M4-GES-3 [moved to a later grade/subject]: Verzicht auf Rauchen/Alkohol/Drogen begründen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Teilweise erhalten: Suchtmittel-Vermeidung (Alkohol, THC) und Drogen als Nervengifte mit Suchtpotenzial erscheinen wörtlich im Biologie-Lehrplan 2026 (spätere Klassenstufe) -- aber \"Rauchen\" als Begriff kommt in keinem der drei neuen Dokumente (MNT, Biologie, Physik) mehr vor. Eher eine Verschiebung mit Umformulierung als ein vollständiger Wegfall."'), updated_at = now() WHERE id = '3ae98a27-c528-5454-9542-ba165905e710';

-- MNT-56-M2-FPA-1b [genuine cut, confirmed]: Samenpflanzen herbarisieren
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: \"Herbar\" bzw. Herbarisieren kommt in keinem der drei neuen Dokumente (MNT, Biologie, Physik 2026) vor. Sieht nach einem echten Wegfall aus, kein Hinweis auf eine Verschiebung."'), updated_at = now() WHERE id = '2ce6e67b-b284-55c2-8a0e-91aab2ebe37d';

-- MNT-56-M2-EXK-1 [genuine cut, confirmed]: Exkurs: Prinzip Vielfalt-Grundaufbau in der Technik
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Als \"Exkurs\" (ausdrücklich optionaler Zusatz, kein Pflichtinhalt) im alten Lehrplan markiert -- im neuen Dokument nicht wiederzufinden. Der Wegfall eines optionalen Exkurses ist weniger gewichtig als der Wegfall von Pflichtinhalt."'), updated_at = now() WHERE id = '22278bb5-0029-5206-ab04-883f3ee5ae71';

-- MNT-56-M3-EXK-1 [genuine cut, confirmed]: Exkurs: Bedeutung der Klassifizierung in Alltag/Technik
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Ebenfalls ein als \"Exkurs\" markierter optionaler Zusatz -- im neuen Dokument nicht wiederzufinden."'), updated_at = now() WHERE id = '832a3021-46c6-5eb8-8de9-4512a90cd314';

-- MNT-56-M3-EXK-2 [genuine cut, confirmed]: Exkurs: Prinzip Vielfalt-Grundaufbau in der Technik
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Ebenfalls ein als \"Exkurs\" markierter optionaler Zusatz (identisch mit MNT-56-M2-EXK-1 aus einem anderen Modul) -- im neuen Dokument nicht wiederzufinden."'), updated_at = now() WHERE id = '15ec1131-8417-5760-bb8f-40166e326a7b';

-- MNT-56-M2-FLI-1 [genuine cut, confirmed]: Bau von Samen/Früchten <-> Verbreitungsart
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: kein Treffer für \"Flugzeug\", \"Flugapparat\" oder \"Fallschirm\" in MNT, Biologie oder Physik 2026. Die Analogie Samenbau<->Verbreitung scheint ersatzlos gestrichen."'), updated_at = now() WHERE id = 'e8e032ce-14cc-5a20-87b9-8b1a579383b8';

-- MNT-56-M2-FLI-2 [genuine cut, confirmed]: Flugapparate Natur (Samen) <-> Technik (Flugzeug/Fallschirm)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gleiche Prüfung wie oben (Flugzeug/Flugapparat/Fallschirm): kein Treffer. Scheint ersatzlos gestrichen."'), updated_at = now() WHERE id = 'a4814137-dd30-5fda-9cd6-0361ddb7713f';

-- MNT-56-M4-GES-5 [genuine cut, confirmed]: Witterungsgerechte Kleidung begründen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: kein Treffer für \"Witterung\" in MNT, Biologie oder Physik 2026. Scheint ersatzlos gestrichen."'), updated_at = now() WHERE id = 'e6f0417a-59f6-50a4-be6c-1d7f65e19d0e';

-- MNT-56-M5-FPA-2a [genuine cut, confirmed]: Temperatur/Niederschlag messen, erfassen, grafisch darstellen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: kein Treffer für \"Niederschlag\" in MNT, Biologie oder Physik 2026. Gehört eventuell zum Fach Geographie/Erdkunde, das in diesem Ökosystem (noch) nicht erfasst ist -- ungeklärt, ob verschoben oder gestrichen."'), updated_at = now() WHERE id = 'f3744988-3b9a-51ed-a78f-58b523727336';

-- MNT-56-M5-FPA-2b [genuine cut, confirmed]: Klimadiagramme auswerten
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gleiche Prüfung: kein Treffer für \"Klimadiagramm\" in MNT, Biologie oder Physik 2026. Gleiche Unsicherheit wie oben (möglicherweise Geographie/Erdkunde)."'), updated_at = now() WHERE id = 'b2a24d86-ea16-5b00-9cc2-eb10d9ed3a76';

-- MNT-56-M5-FPA-3 [genuine cut, confirmed]: Mit Bestimmungsschlüssel Pflanzen/Tiere bestimmen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: kein Treffer für \"Bestimmungsschlüssel\" in MNT, Biologie oder Physik 2026. Scheint ersatzlos gestrichen."'), updated_at = now() WHERE id = '5cd78299-ff27-5c58-b1b7-05866124e2a5';

-- MNT-56-M5-ROH-1 [genuine cut, confirmed]: Vom Rohstoff zum Endprodukt (Korn->Brot, Baum->Papier, Schwein->Thüringer Bratwurst)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: \"Rohstoff\" kommt in MNT 2026 nur noch als allgemeine Erwähnung in der Einleitung vor (\"Nutzung der Natur... zur Gewinnung von Nahrung/Rohstoffen\"), nicht mehr als eigene Stoffkette (Korn->Brot, Baum->Papier, Schwein->Bratwurst). Diese konkrete Einheit scheint gestrichen."'), updated_at = now() WHERE id = 'a0863ee7-12a5-5cdc-9984-896e663c0080';

-- MNT-56-M5-REG-1 [genuine cut, confirmed]: Technische Regelkreise erläutern (Aquarien/Ställe/Gewächshäuser)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Gezielt geprüft: \"Regelkreis\" kommt im Biologie-Lehrplan 2026 nur noch als biologisches Beispiel vor (Blutzuckerregulation über Insulin/Glukagon), nicht mehr als technisches Beispiel (Aquarium/Stall/Gewächshaus-Thermostat). Die technische Version scheint gestrichen, das Grundprinzip \"Regelkreis\" lebt an anderer Stelle weiter."'), updated_at = now() WHERE id = 'b6ddec02-ecca-5f45-9ed8-040cfd04a74a';

-- MNT-56-M1-NWA-3b [generic framing, idea persists]: Bedeutung naturwissenschaftlicher Erkenntnisse erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Bedeutung naturwissenschaftlicher Erkenntnisse\") -- keine eigene Prüfziffer mehr im neuen Dokument, aber der zugrundeliegende Gedanke bleibt implizit Teil der Lernbereiche 2.2.1/2.2.2."'), updated_at = now() WHERE id = '6e2ed1c6-a5d8-5708-9bd4-4023c2d4397f';

-- MNT-56-M2-FPA-1a [generic framing, idea persists]: Samenpflanzen zergliedern + zeichnerisch darstellen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Die konkrete Ziertechnik \"zergliedern + zeichnerisch darstellen\" wurde gezielt geprüft (\"zergliedern\": kein Treffer) -- die allgemeine Pflanzenbau-Thematik bleibt aber in 2.2.7 Samenpflanzen erhalten, nur ohne diese spezifische praktische Übung als eigenen Punkt."'), updated_at = now() WHERE id = '83463332-e1a7-5ab9-b539-9a776b298e23';

-- MNT-56-M2-FOR-1 [generic framing, idea persists]: Bedeutung der Fortpflanzung erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Bedeutung der Fortpflanzung\" bei Pflanzen) -- keine eigene Prüfziffer mehr, Fortpflanzungsinhalte selbst bleiben in 2.2.7 Samenpflanzen erhalten."'), updated_at = now() WHERE id = '9ba69125-6225-5751-8ec7-9ffe2af92cc7';

-- MNT-56-M2-ERN-1 [generic framing, idea persists]: Bedeutung der Ernährung (Pflanzen) erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Bedeutung der Ernährung\" bei Pflanzen) -- Photosynthese/Nährstoffinhalte selbst bleiben in 2.2.7 Samenpflanzen erhalten, nur nicht mehr als eigene \"Warum wichtig\"-Frage."'), updated_at = now() WHERE id = 'bc5e5e49-5891-5f9c-9114-6a25616f79d3';

-- MNT-56-M2-UMW-2a [generic framing, idea persists]: Stoffe als Energieträger (energiearm/-reich) kennzeichnen
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Stoffe als Energieträger\") -- das zugrundeliegende Energiekonzept bleibt in 2.2.3/2.2.4 erhalten, nur nicht mehr als eigener Punkt."'), updated_at = now() WHERE id = 'a2257a7e-5dc1-5627-ba3b-252c3e6d3a9f';

-- MNT-56-M2-ORD-3 [generic framing, idea persists]: Bedeutung der Einteilung von Samenpflanzen erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Bedeutung der Einteilung\") -- die Einteilung von Samenpflanzen selbst bleibt in 2.2.7 erhalten."'), updated_at = now() WHERE id = '7d862b16-69b6-56ad-bf5d-b8e882648797';

-- MNT-56-M3-ERN-1 [generic framing, idea persists]: Bedeutung der Ernährung erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Bedeutung der Ernährung\" bei Wirbeltieren) -- Ernährungsinhalte selbst bleiben in 2.2.8 Wirbeltiere erhalten."'), updated_at = now() WHERE id = '10e90682-0ed8-57c8-bd44-18957c3611be';

-- MNT-56-M3-ERN-4 [generic framing, idea persists]: Struktur-Funktion: Körperbau und Ernährung
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Struktur-Funktion-Formulierung (Körperbau und Ernährung) -- Inhalte selbst bleiben in 2.2.8 Wirbeltiere erhalten, nur nicht mehr als eigener Struktur-Funktion-Punkt."'), updated_at = now() WHERE id = '27ca973a-69e4-57ea-9864-22783484a9f4';

-- MNT-56-M3-ORD-1c [generic framing, idea persists]: Nach Ernährungsweise ordnen (Fleisch-/Pflanzen-/Allesfresser)
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Die Einteilung nach Ernährungsweise (Fleisch-/Pflanzen-/Allesfresser) -- keine eigene Prüfziffer mehr, aber die zugrundeliegende Wirbeltier-Thematik bleibt in 2.2.8 erhalten."'), updated_at = now() WHERE id = '9aa1e09b-08b9-5b0f-86c1-4c5135b33e97';

-- MNT-56-M3-FOR-1 [generic framing, idea persists]: Bedeutung der Fortpflanzung (Wirbeltiere) erläutern
UPDATE lpm_data_objects SET status = 'archived', content = jsonb_set(content, '{migration_note_2026}', '"Allgemeine Rahmen-Formulierung (\"Bedeutung der Fortpflanzung\" bei Wirbeltieren) -- Fortpflanzungsinhalte selbst bleiben in 2.2.8 Wirbeltiere erhalten."'), updated_at = now() WHERE id = '4ae65434-62dc-5630-922e-b0546603cadf';

