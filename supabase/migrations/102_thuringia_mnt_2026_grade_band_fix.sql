-- Thuringia MNT 2026 (grade 5/6): fix a real data-model violation found via
-- direct live-site verification (Playwright, signed in as Susan's own real
-- account) after she reported still not seeing the updates. Root cause: both
-- migration 086 (2026-10-02) and migration 101 (this session) wrote the
-- literal string '5/6' into grade_band for new items. That breaks an
-- established, load-bearing invariant this app's own code comments document
-- explicitly: grade_band stores ONE real grade per item; the UI layer (both
-- learning-goals-page.tsx and student-lernziele-page.tsx) groups '5' and '6'
-- into a combined 'Kl. 5/6' filter chip for DISPLAY, but neither page's
-- grouping logic recognizes the literal string '5/6' as belonging to that
-- group. Confirmed live: filtering to "Grade 5" or "Grade 6" specifically on
-- the real production site showed 51 + 29 = 80 items, not the 117 that are
-- actually accepted and live -- the missing 37 are exactly migration 086's 7
-- items plus migration 101's 30 items, all mis-tagged '5/6'.
--
-- Each item below gets the single real grade already established by the
-- MAJORITY of existing items in its own Lernbereich (e.g. Samenpflanzen is
-- 18 grade-5 items vs. 1 grade-6 item live today), not a guess. Two Lernbereich
-- labels are also consolidated from a stray ASCII-spelled duplicate
-- ('Kohaesion...', 'Sexualitaet...') into the proper unicode spelling already
-- used by the rest of that same Lernbereich's items, so Browse doesn't show
-- it as two separate groups.

-- Moeglichkeiten zur Schwangerschaftsverhuetung: grade_band 5/6 -> 6, thema -> '2.2.9 Der Mensch – Gesunderhaltung'
UPDATE lpm_data_objects SET grade_band = '6', content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = 'ecee12a1-7638-4d84-a4a5-72f0e27c3ca0';

-- Kriteriengeleitet vergleichen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'a7e4c339-daa0-4503-9b0e-ac3a4fba1fdd';

-- Ordnen und klassifizieren: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '47859379-98a7-448b-a77c-213b7c011787';

-- Begründen mit Ursache-Wirkungs-Beziehungen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '288a0087-b03a-4942-b5a7-9e6a81dbfac4';

-- Modelle zur Veranschaulichung nutzen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'e5123fef-4f67-4fb6-9e0e-a3c0bafb22d1';

-- Deduktion und Induktion anwenden: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '10161325-c6eb-43f4-9b11-bdb3af113fcc';

-- Naturwissenschaftliche Informationen darstellen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '5dcd1531-8572-4b55-bc81-5f905efd37de';

-- Körper nach Aggregatzustand einteilen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'fc796478-14b1-450e-b903-97f95a05a27a';

-- Bedeutung von Volumen- und Massebestimmung erläutern: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'f3f357d4-7a4d-4ebe-8136-32ac9c50c4a5';

-- Reinstoffe anhand von Eigenschaften beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'a7012615-24ea-4c09-91de-f8e327119b41';

-- Zusammenhang Eigenschaften und Verwendung erläutern: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '173c7a7e-056c-4757-92a1-eb91f8bfec60';

-- Modellbegriff definieren: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '9c597ab6-9a6c-4f7a-a433-e111eeb077ab';

-- Stoffgemische mit dem Teilchenmodell beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '2fbb7024-d681-4945-9515-bc77b4ba56c3';

-- Bedeutung der Stofftrennung im Alltag erläutern: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '148db929-57e0-43d2-9398-83ced9e55da2';

-- Bedeutung chemischer Reaktionen erläutern: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '68cc8b6c-0710-4294-86b9-564b84d5e66b';

-- Chemische Reaktionen von physikalischen Vorgängen unterscheiden: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '649d5d41-9c4a-4314-afab-b3decb16acf2';

-- Lebewesen vorgegebenen Gruppen zuordnen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'f8bbea9b-816c-45c1-b6b2-1b1a82bc04f1';

-- Lebewesen von Nichtlebendem abgrenzen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '9b6309b5-643c-4fb0-b559-1174cc06a3da';

-- Bestäubung und Blütenbau verknüpfen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '3f4e53a4-d510-433d-a308-c1f2b3465360';

-- Befruchtung und Fruchtbildung beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'a95d79eb-4ea6-482e-b16f-c45948c925e0';

-- Bedeutung wildwachsender Samenpflanzen erläutern: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '6421c82e-5e45-4f71-9e91-f0a3b30b44a0';

-- Wechselwarme und gleichwarme Wirbeltiere vergleichen: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '3f5d448d-3446-4331-82b4-d22f3f144562';

-- Entwicklung der Lurche beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'ff968272-1426-4b51-b548-d303b892a368';

-- Säugen und Nesthocker/Nestflüchter beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = 'f02f3c2e-ad0e-49d4-8534-1f1874babf36';

-- Fortbewegung und Körperbedeckung der Kriechtiere beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '18764a36-2467-4f26-a484-50eee5deb515';

-- Fortbewegung der Vögel beschreiben: grade_band 5/6 -> 5
UPDATE lpm_data_objects SET grade_band = '5', updated_at = now() WHERE id = '66fc118c-02c3-4642-ae4a-761146121217';

-- Skelettgliederung beschreiben: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = '16b57533-6fb5-4c10-965f-8ac390baa407';

-- Knochenfunktionen erläutern: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = '27d2384c-4773-42f4-899e-adb3493501e1';

-- Gelenke als Voraussetzung für Beweglichkeit erläutern: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = 'cdb43ae5-86da-4114-93b9-b9f856e9267f';

-- Zusammenwirken von Muskulatur und Skelett beschreiben: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = '67912053-96bf-4aa8-9c7d-e99c706435f5';

-- Weg der Nährstoffe im Körper beschreiben: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = 'ca3b1b28-91a6-4484-b65f-fbd1a4f238ec';

-- Kohaesion und Adhaesion: grade_band 5/6 -> 5, thema -> '2.2.5 Kohäsion, Adhäsion, Kapillarität'
UPDATE lpm_data_objects SET grade_band = '5', content = jsonb_set(content, '{thema}', '"2.2.5 Kohäsion, Adhäsion, Kapillarität"'), updated_at = now() WHERE id = '0130a025-7ebe-4a4f-a5d1-3e44b5ace875';

-- Bionik: Der Klettverschluss: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = 'ffd21b65-dd3d-4c5b-9bf0-1e4b9a6fdd08';

-- Bionik: Die Leichtbauweise: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = 'd9ed3d9a-4344-4813-bc0d-551641038def';

-- Bionik: Der Lotuseffekt: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = 'cc6fc4d8-88e3-4fce-80ec-2272bb5527ee';

-- Bionik: Vom Nebeltrinkerkaefer zur Trinkwassergewinnung: grade_band 5/6 -> 6
UPDATE lpm_data_objects SET grade_band = '6', updated_at = now() WHERE id = '9dbd79a7-02e0-4f13-92ed-87c6f56a367a';

-- Akzeptanz unterschiedlicher sexueller Orientierungen und Identitaeten: grade_band 5/6 -> 6, thema -> '2.2.9 Der Mensch – Gesunderhaltung'
UPDATE lpm_data_objects SET grade_band = '6', content = jsonb_set(content, '{thema}', '"2.2.9 Der Mensch – Gesunderhaltung"'), updated_at = now() WHERE id = 'c2b5ff73-faa0-43fa-9f00-234bb52fe29f';

