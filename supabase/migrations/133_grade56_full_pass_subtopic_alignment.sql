-- Full pass, 2026-10-15: generalizes the fix already verified correct for
-- 2.2.2 and 2.2.8 (migrations 130/132) across the rest of Grade 5/6.
-- Every item below was checked directly against the real document (LP
-- Thueringen MNT Gym 2026 Erprobungsfassung) before being touched.
--
-- The recurring pattern found: several legacy items carry an unterthema
-- like "Fachpraktisches Arbeiten -- Pflanzen/Kraft" as if that were its
-- own real subtopic. The real document has no such subtopic anywhere --
-- "Fachpraktisch" (➢) activities are always listed INSIDE whichever named
-- subtopic they practice, never as their own separate one. Each item below
-- is reassigned to the real subtopic its specific activity actually
-- belongs under.
--
-- Sections deliberately left untouched, with reasons already written up in
-- lab_manager's design-notes audit: 2.2.1 and 2.2.4 have no named
-- subtopics anywhere in the real document (just a flat list/paragraph), so
-- today's existing groupings aren't factually wrong, just one reasonable
-- editorial choice among others -- touching them would be a judgment call
-- nobody asked for. 2.2.10's 6 generic items describe the real document's
-- own shared 4-step Bionik method, not tied to one specific case study --
-- matches the source as written.
SET search_path = public, extensions;

-- 2.2.2 + 2.2.3 combined-thema item: "Stoffgemische experimentell
-- trennen" -- its content (separating substance mixtures) is the real
-- "Stoffe und ihre Eigenschaften" subtopic's own closing content
-- ("Trennen von Stoffgemischen beschreiben... Bedeutung der
-- Stofftrennung"), not "Aufbau von Stoffen" (not a real subtopic name).
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Stoffe und ihre Eigenschaften"'), updated_at = now()
WHERE id = '10cc8691-99e6-516d-832f-061141793176';

-- 2.2.3 Körper – Stoffe – Eigenschaften: real subtopics are "Körper" and
-- "Stoffe und ihre Eigenschaften" (migration 101's newer items already use
-- these correctly). "Aufbau von Stoffen" is not a real subtopic name --
-- these 4 items' content (Teilchenmodell, Aggregatzustände, Temperatur,
-- Reinstoffe/Stoffgemische, Trennverfahren) is the real "Stoffe und ihre
-- Eigenschaften" subtopic's own text.
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Stoffe und ihre Eigenschaften"'), updated_at = now()
WHERE id IN ('4b3d2b67-a944-5436-975b-c5b98625566d', '03a9bc29-e441-5a5d-b9bc-2327156d35b9', '7f692716-6082-55db-bb9d-2788c9411a0f', '1672e278-f278-5617-b572-467120bdbdd4');

-- "Volumen von Körpern experimentell ermitteln" is the real "Körper"
-- subtopic's own Fachpraktisch activity ("Volumina bestimmen... Massen
-- bestimmen durch Wiegen"), not "Fachpraktisches Arbeiten -- Kraft".
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Körper"'), updated_at = now()
WHERE id = '7c0b5e01-c875-5781-a758-6a28ce4d1e07';

-- 2.2.5 Kohäsion, Adhäsion, Kapillarität: real subtopics are "Kohäsion,
-- Adhäsion" and "Kapillarität". "Kapillarität untersuchen" is that real
-- subtopic's own Fachpraktisch activity ("Abhaengigkeit der Steighoehe von
-- Wasser vom Durchmesser der Kapillarroehrchen"), not "Fachpraktisches
-- Arbeiten -- Pflanzen" (a leftover from this item's old Samenpflanzen
-- filing, never updated when migration 097 moved its thema to 2.2.5).
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Kapillarität"'), updated_at = now()
WHERE id = 'f2cc5aa7-8c66-5885-956e-21866e332b01';

-- "Kohaesion und Adhaesion" had no unterthema set at all -- giving it the
-- real subtopic's own name, matching its own title almost exactly.
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Kohäsion, Adhäsion"'), updated_at = now()
WHERE id = '0130a025-7ebe-4a4f-a5d1-3e44b5ace875';

-- 2.2.7 Samenpflanzen: 3 more Fachpraktisch-mislabeled items, each moved
-- to the real subtopic whose own Fachpraktisch list literally names this
-- activity.
-- "Fortpflanzung und Entwicklung der Samenpflanzen" Fachpraktisch list:
-- "Bluetenzergliedern, Bluetendiagramm erstellen (KB); Staerke-...und
-- Fettnachweis...in Samen; Keimungs-/Wachstumsbedingungen untersuchen".
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Fortpflanzung und Entwicklung der Samenpflanzen"'), updated_at = now()
WHERE id IN ('c7c1a118-efda-59ea-8ff2-5a0357724320', '42c9090a-e55a-53c4-ba6f-7d6c26f838c7', '206e608f-bc89-525c-8dfd-48d4ffcf7ee4');

-- "Ernährung der Samenpflanzen" Fachpraktisch list: "Aufsteigen von
-- gefaerbtem Wasser (z.B. Weisse Taubnessel)" -- the real content behind
-- "Wasserleitung in der Sprossachse untersuchen".
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Ernährung der Samenpflanzen"'), updated_at = now()
WHERE id = 'ffcb41d6-c83f-566a-babc-f77ff4531eef';

-- 2.2.9 Der Mensch – Gesunderhaltung: "Staerke- und Fettnachweis in
-- Nahrungsmitteln" is the real "Ernaehrung" subtopic's own Fachpraktisch
-- activity ("Staerke-/Fettnachweis in Lebensmitteln"), not "Nachweis von
-- Stoffen" (not a real subtopic name here).
UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Ernährung"'), updated_at = now()
WHERE id = '01c1fd65-e510-5aa8-b238-3e83bf997ef6';
