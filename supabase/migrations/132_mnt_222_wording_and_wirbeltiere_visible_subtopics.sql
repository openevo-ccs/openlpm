-- Two real gaps found 2026-10-15 after Susan said it was "still a mess":
--
-- 1. Feedback 96a8f2c9 (2026-10-14 11:07, never checked before now): she
--    flagged the SAME 2.2.2 "Beziehungen zwischen Mensch, Natur und
--    Technik" subtopic migration 130 already renamed -- but 130 only
--    renamed the unterthema LABEL, never fixed the actual learning-goal
--    TEXT underneath it. The 2 original items still said what they said
--    before, now just filed under a correctly-named subtopic they don't
--    actually match. Real cause of this specific complaint.
--
-- 2. Migration 131's 2.2.8 Wirbeltiere crosswalk (the real subtopic
--    structure, linked to existing items via the new
--    lpm_data_object_framework_tags table) is correct but invisible --
--    nothing in the app reads that table. Susan is still looking at the
--    exact same "Ernaehrung der Wirbeltiere" / "Atmung der Wirbeltiere"
--    labels as before, because nothing ever updated content.unterthema
--    itself. This migration applies that same, already-verified mapping
--    directly to the visible field, using the real document's own
--    subtopic names (lab_manager's design-notes audit, Finding 2).
SET search_path = public, extensions;

-- ============================================================
-- Part 1: 2.2.2 "Beziehungen zwischen Mensch, Natur und Technik" --
-- real text (LP Thueringen MNT Gym 2026 Erprobungsfassung, line 327-333)
-- is ONE combined learning goal with 3 examples, not two unrelated items.
-- ============================================================

UPDATE lpm_data_objects
SET title = 'Alltagsbeispiele für Beziehungen zwischen Mensch, Natur und Technik nennen',
    description = 'Alltagsbeispiele für Beziehungen zwischen Mensch, Natur und Technik nennen, z. B.: Nutzung der Natur durch den Menschen als Lebensraum und zur Gewinnung von Nahrung und Rohstoffen (BNE); Beeinflussung der Natur durch den Menschen (z. B. Anlegen von Teichen, Veränderung von Lebensräumen durch Städte- und Straßenbau) (DB, BNE); Erforschung der Natur und Nutzung von Erkenntnissen (z. B. Auto- und Flugzeugbau, Medizin) sowie Nutzung der Technik (z. B. Messgeräte, Mikroskope, Maschinen)',
    content = jsonb_set(content, '{originaltext}', '"Alltagsbeispiele für Beziehungen zwischen Mensch, Natur und Technik nennen, z. B.: Nutzung der Natur durch den Menschen als Lebensraum und zur Gewinnung von Nahrung und Rohstoffen (BNE); Beeinflussung der Natur durch den Menschen (z. B. Anlegen von Teichen, Veränderung von Lebensräumen durch Städte- und Straßenbau) (DB, BNE); Erforschung der Natur und Nutzung von Erkenntnissen (z. B. Auto- und Flugzeugbau, Medizin) sowie Nutzung der Technik (z. B. Messgeräte, Mikroskope, Maschinen)"'),
    updated_at = now()
WHERE id = 'a8d25f6e-9820-53fd-93d3-b251c863c9b6';

-- The second pre-existing item under this subtopic ("Sachverhalte den
-- Bereichen MNT zuordnen") does not correspond to anything in the real
-- subtopic's text -- the real subtopic is one combined goal, not two.
-- Archived rather than left presented as real 2026 document content, with
-- an honest note instead of a silent delete.
UPDATE lpm_data_objects
SET status = 'archived',
    content = jsonb_set(content, '{migration_note_2026}', '"Archiviert 2026-10-15: entspricht keinem eigenstaendigen Lernziel im echten 2026er Dokument unter 2.2.2 Beziehungen zwischen Mensch, Natur und Technik -- die reale Textstelle ist EIN kombiniertes Lernziel (siehe a8d25f6e), kein zweites."'),
    updated_at = now()
WHERE id = 'de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7';

-- ============================================================
-- Part 2: make the 2.2.8 Wirbeltiere crosswalk actually visible. Same
-- mapping migration 131 already put in lpm_data_object_framework_tags
-- (verified correct there), applied directly to content.unterthema so it
-- shows up on the real Lernziele page, not only in a backend table.
-- ============================================================

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Vielfalt und Einteilung"'), updated_at = now()
WHERE id IN ('afa7d719-fb4c-5410-afa6-1ce2e3182128', '6fde47d3-6de9-531a-8a50-3ad783413c57');

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Körpergliederung und Körperbau"'), updated_at = now()
WHERE id = '015d0a14-02d0-5ded-8244-bf1876f2a951';

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Angepasstheit – Säugetiere"'), updated_at = now()
WHERE id IN (
  'b62370af-2fe2-5a6c-9b4a-f65a7b008337', '61336f13-3e2a-5d89-b720-bc019a870094',
  'b2dc23c5-661a-532c-8247-2829885f1d2f', 'f4d3b010-c86d-5569-9737-6c776e803acc',
  '47322576-0224-581b-a15c-5a2b08ad7247', '37cce1bb-7cbf-5c24-bb71-51277b0c612a',
  'c1cc6b14-9c5f-5f0d-a0a0-8ebc9d635eb8'
);

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Gegenüberstellung und Ordnen"'), updated_at = now()
WHERE id IN ('393ea953-4880-51f3-9503-6f8b534f3126', 'f6c0b12c-177d-57f5-9baf-4fbc1f080af9', '5addd20b-ae9a-5ac2-9c45-f7d2ed1a242d', '30abcc70-ab22-52c9-87f0-895e38202d5f');

UPDATE lpm_data_objects SET content = jsonb_set(content, '{unterthema}', '"Schutz von Wirbeltieren"'), updated_at = now()
WHERE id IN ('8943afd8-3ac7-525f-a4df-bce4f8d264c3', 'af819a99-ad45-50bf-a00f-3b989fb5ab6c', 'ff60d353-d357-5efa-9f78-527d45f1eec9', 'bac4e87c-18bc-59f2-bd73-cb3bbe2448d4');

-- The 4 "2.2.8 Wirbeltiere (Schutz von Wirbeltieren)" items above were
-- filed under a second, separate thema value -- the real document has ONE
-- Lernbereich "2.2.8 Wirbeltiere" with "Schutz von Wirbeltieren" as its
-- 6th subtopic, not a second thema. Folding them into the single real
-- thema now that their unterthema correctly says which subtopic they're
-- under.
UPDATE lpm_data_objects SET content = jsonb_set(content, '{thema}', '"2.2.8 Wirbeltiere"'), updated_at = now()
WHERE id IN ('8943afd8-3ac7-525f-a4df-bce4f8d264c3', 'af819a99-ad45-50bf-a00f-3b989fb5ab6c', 'ff60d353-d357-5efa-9f78-527d45f1eec9', 'bac4e87c-18bc-59f2-bd73-cb3bbe2448d4');
