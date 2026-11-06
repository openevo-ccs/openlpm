SET search_path = public, extensions;

-- Real bug, found by tracing Susan Hanisch's own feedback directly (fe028b37,
-- a5351658, both still 'open' as of this fix, 2026-10-04): she reported "the
-- topics are updated but the learning goals within them are still the old
-- ones" even after today's restructuring/grade_band/branch_id fixes
-- (migrations 097/102/103/104) were confirmed live. Checked her exact named
-- example ("naturwissenschaftliche Informationen...Erfassen und Auswerten")
-- directly against the live database: the item exists, is accepted, has the
-- right content and the right branch_id -- it is NOT missing or stale.
--
-- The real cause: migration 101 ("30 genuinely missing Thuringia MNT 2026
-- learning objectives") inserted those 30 rows without ever setting
-- curriculum_sequence. The student view's "Reihenfolge im Lehrplan" sort
-- (student-lernziele-page.tsx's sortByCurriculumOrder) sorts items with no
-- sequence value to the very end of the ENTIRE grade-5/6 list (a flat sort,
-- not grouped by topic) -- confirmed live: exactly these 30 rows, spanning 7
-- different Lernbereiche, all have curriculum_sequence IS NULL. Reading
-- through in curriculum order, every topic's genuinely-new-for-2026 content
-- is torn out of its own section and dumped in an unordered pile at the very
-- bottom, while the old, already-sequenced content reads normally -- which
-- is exactly what "topics are new, learning goals within them are still old"
-- looks like from the student side. Confirmed independently: Dustin's own
-- live screenshot of this exact sort only showed the 5 already-sequenced
-- 2.2.1 items; the new 6th one ("Naturwissenschaftliche Informationen
-- darstellen") was never in frame because it was sorted to position ~290+
-- of 299, unrelated to its real topic.
--
-- Fix: give each of the 30 rows a real curriculum_sequence value, placed
-- next to its nearest real neighbor within its own Lernbereich, using the
-- real 2026 document's own internal ordering (LP Thueringen MNT Gym 2026
-- Erprobungsfassung.md, read directly for this fix) to decide which
-- neighbor. This is a reasoned placement, not a sourced original-document
-- position -- these items have no 2015 source id to place by (same honest
-- caveat migration 091 documented for its own 9 reasoned-placement items).
-- Three Lernbereiche (2.2.3, 2.2.6, 2.2.8) had zero already-sequenced
-- siblings under their OWN label to anchor against (the existing sequence
-- numbers reflect each item's position in the OLD 2015 source material, not
-- the new 2026 topic structure, so a brand-new-in-2026 item sometimes has no
-- same-topic anchor at all) -- placed against the nearest thematically
-- related anchor instead, noted inline per group.

-- 2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden (anchors: 0-4, next real value 95)
-- Document order after "Arbeitsmittel sachgerecht verwenden" (seq 4): Vergleichen, Ordnen,
-- Begründen, Modelle (all part of the same source bullet as items 0-4), then Deduktion/
-- Induktion, then "naturwissenschaftliche Informationen" (two separate later bullets).
UPDATE lpm_data_objects SET curriculum_sequence = 3.1 WHERE id = 'a7e4c339-daa0-4503-9b0e-ac3a4fba1fdd'; -- Kriteriengeleitet vergleichen
UPDATE lpm_data_objects SET curriculum_sequence = 3.2 WHERE id = '47859379-98a7-448b-a77c-213b7c011787'; -- Ordnen und klassifizieren
UPDATE lpm_data_objects SET curriculum_sequence = 3.3 WHERE id = '288a0087-b03a-4942-b5a7-9e6a81dbfac4'; -- Begründen mit Ursache-Wirkungs-Beziehungen
UPDATE lpm_data_objects SET curriculum_sequence = 3.4 WHERE id = 'e5123fef-4f67-4fb6-9e0e-a3c0bafb22d1'; -- Modelle zur Veranschaulichung nutzen
UPDATE lpm_data_objects SET curriculum_sequence = 4.1 WHERE id = '10161325-c6eb-43f4-9b11-bdb3af113fcc'; -- Deduktion und Induktion anwenden
UPDATE lpm_data_objects SET curriculum_sequence = 4.2 WHERE id = '5dcd1531-8572-4b55-bc81-5f905efd37de'; -- Naturwissenschaftliche Informationen darstellen (Susan's named example)

-- 2.2.6 Die Vielfalt der Lebewesen (no same-topic anchor; placed right after the
-- nearest preceding real anchor, 2.2.5's Kohaesion/Adhaesion at seq 28.5 -- 2.2.6
-- is a short orienting section that comes right after 2.2.5 in the real document).
UPDATE lpm_data_objects SET curriculum_sequence = 28.6 WHERE id = 'f8bbea9b-816c-45c1-b6b2-1b1a82bc04f1'; -- Lebewesen vorgegebenen Gruppen zuordnen
UPDATE lpm_data_objects SET curriculum_sequence = 28.7 WHERE id = '9b6309b5-643c-4fb0-b559-1174cc06a3da'; -- Lebewesen von Nichtlebendem abgrenzen

-- 2.2.3 Koerper - Stoffe - Eigenschaften (anchors: 30-33, next real value 68).
-- Document order: Koerper (Aggregatzustand, Volumen/Masse) comes BEFORE Stoffe
-- (Reinstoffe, Eigenschaften<->Verwendung, Modellbegriff, Teilchenmodell, Trennung).
UPDATE lpm_data_objects SET curriculum_sequence = 29.1 WHERE id = 'fc796478-14b1-450e-b903-97f95a05a27a'; -- Koerper nach Aggregatzustand einteilen
UPDATE lpm_data_objects SET curriculum_sequence = 29.2 WHERE id = 'f3f357d4-7a4d-4ebe-8136-32ac9c50c4a5'; -- Bedeutung von Volumen- und Massebestimmung erlaeutern
UPDATE lpm_data_objects SET curriculum_sequence = 33.1 WHERE id = 'a7012615-24ea-4c09-91de-f8e327119b41'; -- Reinstoffe anhand von Eigenschaften beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 33.2 WHERE id = '173c7a7e-056c-4757-92a1-eb91f8bfec60'; -- Zusammenhang Eigenschaften und Verwendung erlaeutern
UPDATE lpm_data_objects SET curriculum_sequence = 33.3 WHERE id = '9c597ab6-9a6c-4f7a-a433-e111eeb077ab'; -- Modellbegriff definieren
UPDATE lpm_data_objects SET curriculum_sequence = 33.4 WHERE id = '2fbb7024-d681-4945-9515-bc77b4ba56c3'; -- Stoffgemische mit dem Teilchenmodell beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 33.5 WHERE id = '148db929-57e0-43d2-9398-83ced9e55da2'; -- Bedeutung der Stofftrennung im Alltag erlaeutern

-- 2.2.4 Chemische Reaktionen (anchors: 36, 39, 61). "Bedeutung chemischer Reaktionen"
-- is the section's opening framing sentence in the real document -- goes first.
UPDATE lpm_data_objects SET curriculum_sequence = 35.5 WHERE id = '68cc8b6c-0710-4294-86b9-564b84d5e66b'; -- Bedeutung chemischer Reaktionen erlaeutern
UPDATE lpm_data_objects SET curriculum_sequence = 36.5 WHERE id = '649d5d41-9c4a-4314-afab-b3decb16acf2'; -- Chemische Reaktionen von physikalischen Vorgaengen unterscheiden

-- 2.2.7 Samenpflanzen (anchors: 8-43, 100). Placed next to their clearest same-topic
-- kin: Bestaeubung/Bluetenbau next to "Begriff Samenpflanze definieren"(11)/"Bluetenbau
-- beschreiben"(15); Befruchtung/Fruchtbildung right after "Fortpflanzung und
-- Entwicklung...beschreiben"(16); the usage/significance item next to the other
-- usage item (100).
UPDATE lpm_data_objects SET curriculum_sequence = 14.5 WHERE id = '3f4e53a4-d510-433d-a308-c1f2b3465360'; -- Bestaeubung und Bluetenbau verknuepfen
UPDATE lpm_data_objects SET curriculum_sequence = 16.5 WHERE id = 'a95d79eb-4ea6-482e-b16f-c45948c925e0'; -- Befruchtung und Fruchtbildung beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 99.5 WHERE id = '6421c82e-5e45-4f71-9e91-f0a3b30b44a0'; -- Bedeutung wildwachsender Samenpflanzen erlaeutern

-- 2.2.8 Wirbeltiere (anchors: 45-72, 90; Schutz-subsection 94-104). The three
-- "weitere Wirbeltierklassen / Gegenueberstellung" items placed near the end of the
-- main anchored cluster; Saeugen/Nesthocker and Voegel-Fortbewegung placed next to
-- the one Saeugetier-themed anchor (90) since they're the same kind of vertebrate-
-- class-specific content.
UPDATE lpm_data_objects SET curriculum_sequence = 71.1 WHERE id = '18764a36-2467-4f26-a484-50eee5deb515'; -- Fortbewegung und Koerperbedeckung der Kriechtiere beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 71.2 WHERE id = 'ff968272-1426-4b51-b548-d303b892a368'; -- Entwicklung der Lurche beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 71.3 WHERE id = '3f5d448d-3446-4331-82b4-d22f3f144562'; -- Wechselwarme und gleichwarme Wirbeltiere vergleichen
UPDATE lpm_data_objects SET curriculum_sequence = 89.5 WHERE id = 'f02f3c2e-ad0e-49d4-8534-1f1874babf36'; -- Saeugen und Nesthocker/Nestfluechter beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 89.6 WHERE id = '66fc118c-02c3-4642-ae4a-761146121217'; -- Fortbewegung der Voegel beschreiben

-- 2.2.9 Der Mensch - Gesunderhaltung (anchors scattered 54-87, including the
-- already-fractional 84.5/86.5 health-education additions). The skeletal/muscular
-- items placed together right before the "Massnahmen zur Gesunderhaltung des Stuetz-
-- und Bewegungssystems" anchor (73, which IS about the muscular/skeletal system);
-- the nutrient-pathway item placed right before the nutrient-content anchor (83).
UPDATE lpm_data_objects SET curriculum_sequence = 72.5 WHERE id = '67912053-96bf-4aa8-9c7d-e99c706435f5'; -- Zusammenwirken von Muskulatur und Skelett beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 72.6 WHERE id = '16b57533-6fb5-4c10-965f-8ac390baa407'; -- Skelettgliederung beschreiben
UPDATE lpm_data_objects SET curriculum_sequence = 72.7 WHERE id = '27d2384c-4773-42f4-899e-adb3493501e1'; -- Knochenfunktionen erlaeutern
UPDATE lpm_data_objects SET curriculum_sequence = 72.8 WHERE id = 'cdb43ae5-86da-4114-93b9-b9f856e9267f'; -- Gelenke als Voraussetzung fuer Beweglichkeit erlaeutern
UPDATE lpm_data_objects SET curriculum_sequence = 82.5 WHERE id = 'ca3b1b28-91a6-4484-b65f-fbd1a4f238ec'; -- Weg der Naehrstoffe im Koerper beschreiben
