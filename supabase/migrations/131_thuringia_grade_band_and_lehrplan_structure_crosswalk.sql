-- Susan Hanisch, 2026-10-14, relayed by Dustin: a comprehensive comparison
-- of EvoMentor Thuringia's Grade 5/6 content against the real 2026 MNT
-- document surfaced two structural issues, not just wording drift (full
-- writeup: lab_manager/docs/design-notes/
-- openlpm-thuringia-grade56-comprehensive-audit-2026-10-14.md). Dustin's
-- direction after seeing that writeup: fix the real structural mismatch,
-- AND make the structural difference itself queryable OpenLPM data via a
-- real crosswalk, using and extending the existing frameworks/
-- framework_tags/framework_crosswalks mechanism (migration 018, RFC-0003)
-- rather than inventing something new -- this is that mechanism's first
-- real use beyond its original seed data.
SET search_path = public, extensions;

-- ============================================================
-- Part 1: grade 5/6 is one combined band in the real document, not two.
-- Checked directly: "Klassenstufe 5" / "Klassenstufe 6" as an INDIVIDUAL
-- grade appears exactly once in the whole 666-line source, in the
-- front-matter rollout schedule (which year each grade starts using the
-- new curriculum) -- never as a content split. Every Lernbereich targets
-- "Klassenstufen 5/6" as one two-year competency, and the document says
-- outright the teacher decides how to arrange content across the two
-- years. 75 of EvoMentor Thuringia's 80 legacy-sourced items (migration
-- 097's "Modul N" re-filing never touched grade_band) plus 3 items this
-- session itself added earlier today (migration 130) carry an individual
-- "5" or "6" grade_band the source document never assigns. Retagging all
-- 78 to the real, unified "5/6" value -- matching what the project's
-- other 38 items (migration 101) already correctly used.
-- ============================================================

UPDATE lpm_data_objects SET grade_band = '5/6', updated_at = now()
WHERE id IN (
  '748857e0-ac20-5867-8351-796eeb6611e9','68461c4a-2927-5ae2-bc27-2c61228a018a','905a4704-c4fc-5ed8-b46f-589338375239',
  'f6c0b12c-177d-57f5-9baf-4fbc1f080af9','5addd20b-ae9a-5ac2-9c45-f7d2ed1a242d','8943afd8-3ac7-525f-a4df-bce4f8d264c3',
  'af819a99-ad45-50bf-a00f-3b989fb5ab6c','ff60d353-d357-5efa-9f78-527d45f1eec9','bac4e87c-18bc-59f2-bd73-cb3bbe2448d4',
  'af5b32b6-9c93-5ab8-a179-f00d2a875c67','5af67527-ef92-5b2f-bd5e-7077344fd5e7','a65e2a25-f479-5b2b-aae9-34c927152dd2',
  '4b3d2b67-a944-5436-975b-c5b98625566d','bd99afc8-8b1d-5c64-9249-a9ac4f0cf981','92e6dcbf-2396-5c19-a492-a4c931f8ec5c',
  '03a9bc29-e441-5a5d-b9bc-2327156d35b9','1fdb5b8b-238f-5042-a8e2-07ed83535545','015d0a14-02d0-5ded-8244-bf1876f2a951',
  '47322576-0224-581b-a15c-5a2b08ad7247','d7934092-7129-541e-b4b5-631e42b700e6','c7c1a118-efda-59ea-8ff2-5a0357724320',
  '05deb095-b225-5d30-930e-b12966e4d6bb','1f1f0869-8f45-5a69-8681-1b36b73e7699','4b6fd514-838b-5ec7-84d5-5883dcb43f06',
  'fd5a26b5-5f51-5be3-bd09-28c7559e8ce1','4d321a47-3a11-5f77-b541-08b5df7918f8','8af9598d-58d6-55c5-89ca-d575f9f9ed26',
  '37cce1bb-7cbf-5c24-bb71-51277b0c612a','341b6c40-ed57-586e-91ab-587f4f0c6721','b4055e65-e605-5b8c-b6d8-1cc21947800c',
  '798b015d-95ce-5eb4-90b3-a5bca6e71833','df9b858f-e765-5fef-be27-d90b789b3da6','678fe211-d660-5bbe-bb8d-5688ec0b8781',
  '32a2ac6a-65ac-5380-9bec-ef7160df2fb7','f51b7a9e-5485-5608-be64-bf872ddfcc0f','b4f4976a-06d2-5886-8934-4ef6446e797f',
  'c41dc217-6ba3-57b4-9cde-de22d68bebf8','02e3a499-d497-5bfc-82fb-e23491526c0a','42c9090a-e55a-53c4-ba6f-7d6c26f838c7',
  '206e608f-bc89-525c-8dfd-48d4ffcf7ee4','68df89df-92ce-55cf-b6f8-b77864fe4a6b','690d09af-c38b-55a5-908f-aedab943d2d2',
  'a4e7cd8b-f828-59b3-8073-27469dd064bc','9fc5fa06-610c-5212-aac5-cf05c7bcb300','f2cc5aa7-8c66-5885-956e-21866e332b01',
  'ffcb41d6-c83f-566a-babc-f77ff4531eef','7f692716-6082-55db-bb9d-2788c9411a0f','1672e278-f278-5617-b572-467120bdbdd4',
  '10cc8691-99e6-516d-832f-061141793176','3e791200-6110-568b-8fa5-82cc9238f089','d3bc4da1-e7d0-54a0-ba53-88d20cb2b784',
  'b60088aa-780c-5a06-83df-2c25d0d9a760','afa7d719-fb4c-5410-afa6-1ce2e3182128','6fde47d3-6de9-531a-8a50-3ad783413c57',
  'b62370af-2fe2-5a6c-9b4a-f65a7b008337','61336f13-3e2a-5d89-b720-bc019a870094','01c1fd65-e510-5aa8-b238-3e83bf997ef6',
  'b2dc23c5-661a-532c-8247-2829885f1d2f','f4d3b010-c86d-5569-9737-6c776e803acc','c1cc6b14-9c5f-5f0d-a0a0-8ebc9d635eb8',
  '7c0b5e01-c875-5781-a758-6a28ce4d1e07','30abcc70-ab22-52c9-87f0-895e38202d5f','b6489681-7c40-5ae6-adb9-a8e0d73cc33e',
  'd0d80b71-0e1f-576c-a3ad-a9600c4c5e40','47a3dd16-ade5-58bc-b6a7-e08256bc3672','858afecb-1cf2-5b96-acdb-155cb9a032b9',
  '3567aeb7-d9af-5298-b227-533a9df8c167','03a9004d-853c-5a29-a911-597aaf8b8127','502540d2-8051-58e4-bcef-4b0f2fc931ca',
  '6e32379d-010e-58a6-91b7-384f7779e9bc','d9247686-f293-5d47-9cc1-bd53150143ee','a8d25f6e-9820-53fd-93d3-b251c863c9b6',
  'de13e9e4-3e79-5e03-bff7-cdb9de9f8ee7','364e7135-e167-521f-abd9-a5d401237a1d','393ea953-4880-51f3-9503-6f8b534f3126',
  -- 3 items added by migration 130 earlier today, tagged '5' individually
  -- before this audit found the real document never does that -- fixing
  -- the same session's own inconsistency, not someone else's.
  '6e6774a9-3ed6-4dcd-a55c-33cd6767bacc','a1c69f68-f997-4d00-bfc3-80e54920c509','edc9754e-ee0c-4d75-848a-e48910ae6e2d'
);

-- ============================================================
-- Part 2: register the grade-band fact as real, queryable framework data
-- (migration 018's mechanism), not just a text value. Thuringia's own
-- combined band, crosswalked to (a) a new shared reference framework for
-- projects that DO use individually-numbered grades -- a real, existing
-- pattern in this same database (EvoMentor Bayern: '6','8','9','10','11',
-- '12') -- and (b) the existing ISCED age-band reference, honestly marked
-- as approximate/structural rather than claiming false precision: German
-- Gymnasium grade 5 starts around age 10, inside ISCED-1 (ages 6-11);
-- grade 6 straddles the ISCED-1/ISCED-2 boundary. A real nuance, not
-- glossed over.
-- ============================================================

INSERT INTO frameworks (project_id, framework_type, framework_key, label, source, version_note) VALUES
  ('1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'grade-band', 'evomentor-thuringia-klassenstufe-5-6-v1', 'Thüringen MNT Klassenstufe 5/6 (kombiniert)',
   'LP Thueringen MNT Gym 2026 Erprobungsfassung',
   'The real document treats Klassenstufe 5 and 6 as ONE combined two-year competency target with no per-item grade split -- "ueber die Anordnung der Lerninhalte innerhalb der Klassen-/Doppelklassenstufe entscheidet die Lehrkraft." This framework has exactly one tag for that reason: splitting it further would invent a distinction the source does not make.');

INSERT INTO framework_tags (framework_id, tag_key, label, definition, sort_order)
SELECT f.id, 'klassenstufe-5-6', 'Klassenstufe 5/6', 'Combined two-year competency target for Grade 5 and Grade 6, Thueringen Gymnasium MNT 2026 Erprobungsfassung. No individual grade-5-vs-6 split exists in the real document.', 0
FROM frameworks f WHERE f.framework_key = 'evomentor-thuringia-klassenstufe-5-6-v1';

-- Shared reference framework (project_id NULL), same pattern as migration
-- 018's isced-age-bands-v1 seed -- reusable by any project in this
-- ecosystem that models grades individually rather than in bands (e.g.
-- EvoMentor Bayern's real '6'/'8'/'9'/'10'/'11'/'12' grade_band values).
INSERT INTO frameworks (project_id, framework_type, framework_key, label, source, version_note) VALUES
  (NULL, 'grade-band', 'numbered-grades-v1', 'Individually-numbered grade levels (reference)',
   NULL,
   'Plain Grade 1-12, one tag per grade. Crosswalk target for any project that models grades individually rather than as a combined band (e.g. EvoMentor Bayern''s real data) -- not itself any one jurisdiction''s actual curriculum structure.');

INSERT INTO framework_tags (framework_id, tag_key, label, sort_order)
SELECT f.id, 'grade-' || g, 'Grade ' || g, g
FROM frameworks f, generate_series(1, 12) AS g
WHERE f.framework_key = 'numbered-grades-v1';

INSERT INTO framework_crosswalks (from_tag_id, to_tag_id, relation_type, confidence, note)
SELECT t1.id, t2.id, 'broadMatch', 'approximate',
  'Thueringen''s combined 2-year band covers both individual grades; neither individual grade alone is an exact match for the combined target.'
FROM framework_tags t1
JOIN frameworks f1 ON f1.id = t1.framework_id AND f1.framework_key = 'evomentor-thuringia-klassenstufe-5-6-v1'
JOIN framework_tags t2 ON t2.tag_key IN ('grade-5', 'grade-6')
JOIN frameworks f2 ON f2.id = t2.framework_id AND f2.framework_key = 'numbered-grades-v1';

INSERT INTO framework_crosswalks (from_tag_id, to_tag_id, relation_type, confidence, note)
SELECT t1.id, t2.id, 'relatedMatch', 'structural',
  CASE t2.tag_key
    WHEN 'isced-1' THEN 'German Gymnasium Grade 5 starts around age 10, inside ISCED-1''s age range (6-11); Grade 6 (age ~11-12) straddles the ISCED-1/ISCED-2 boundary. Neither ISCED band cleanly contains the whole combined Klassenstufe 5/6 target -- marked structural/relatedMatch rather than exact on purpose.'
    ELSE 'German Gymnasium Grade 6 (age ~11-12) straddles the ISCED-1/ISCED-2 boundary; Grade 5 (age ~10) sits in ISCED-1. Neither ISCED band cleanly contains the whole combined Klassenstufe 5/6 target -- marked structural/relatedMatch rather than exact on purpose.'
  END
FROM framework_tags t1
JOIN frameworks f1 ON f1.id = t1.framework_id AND f1.framework_key = 'evomentor-thuringia-klassenstufe-5-6-v1'
JOIN framework_tags t2 ON t2.tag_key IN ('isced-1', 'isced-2')
JOIN frameworks f2 ON f2.id = t2.framework_id AND f2.framework_key = 'isced-age-bands-v1';

-- ============================================================
-- Part 3: first real slice of a "faithful structure" framework --
-- 2.2.8 Wirbeltiere only, the section with the clearest real mismatch
-- (real document organizes by taxonomic case study; current data by
-- function, across all classes at once). Registers the real document's
-- own 6 subtopics as a concept-taxonomy framework, verbatim-sourced, and
-- links the 24 existing lpm_data_objects items to whichever real subtopic
-- their content actually belongs to -- without renaming, merging, or
-- deleting any existing item. This is a proof of concept for one section,
-- not yet the other 9 Lernbereiche -- deliberately scoped small so it can
-- be checked before the same pattern is repeated more broadly.
--
-- New join table: lpm_data_objects has no existing way to link to a
-- framework_tag (lpm_connections only links data objects to each other;
-- curriculum_repository_record_tags only links repository records, a
-- different and policy/governance-shaped table, to tags). Mirrors
-- curriculum_repository_links' own shape (migration 066) exactly, same
-- open relation_type vocabulary convention as lpm_connections.
-- ============================================================

CREATE TABLE IF NOT EXISTS lpm_data_object_framework_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  framework_tag_id UUID NOT NULL REFERENCES framework_tags(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'implements',
  rationale TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (data_object_id, framework_tag_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_lpm_data_object_framework_tags_object ON lpm_data_object_framework_tags(data_object_id);
CREATE INDEX IF NOT EXISTS idx_lpm_data_object_framework_tags_tag ON lpm_data_object_framework_tags(framework_tag_id);

ALTER TABLE lpm_data_object_framework_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view data object framework tag links" ON lpm_data_object_framework_tags
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM lpm_data_objects o WHERE o.id = data_object_id AND (o.project_id IS NULL OR is_project_member(o.project_id))
    )
  );
CREATE POLICY "Maintainers can manage data object framework tag links" ON lpm_data_object_framework_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lpm_data_objects o WHERE o.id = data_object_id
        AND o.project_id IS NOT NULL AND has_project_role(o.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM lpm_data_objects o WHERE o.id = data_object_id
        AND o.project_id IS NOT NULL AND has_project_role(o.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

INSERT INTO frameworks (project_id, framework_type, framework_key, label, source, version_note) VALUES
  ('1b121ef2-96c2-43f7-aa2b-0e07b8de114a', 'concept-taxonomy', 'evomentor-thuringia-mnt-2026-lehrplan-struktur-v1', 'Thüringen MNT 2026 Lehrplan-Struktur (wortgetreu)',
   'LP Thueringen MNT Gym 2026 Erprobungsfassung',
   'The real document''s own Lernbereich/subtopic structure, transcribed faithfully rather than reorganized. Scope so far: 2.2.8 Wirbeltiere only (proof of concept for the broader "faithful structure crosswalked to OpenLPM''s own item-level data" pattern Susan asked for 2026-10-14) -- the other 9 Lernbereiche are not yet registered here.');

INSERT INTO framework_tags (framework_id, tag_key, label, sort_order)
SELECT f.id, '2-2-8', '2.2.8 Wirbeltiere', 8
FROM frameworks f WHERE f.framework_key = 'evomentor-thuringia-mnt-2026-lehrplan-struktur-v1';

INSERT INTO framework_tags (framework_id, tag_key, label, parent_tag_id, definition, sort_order)
SELECT f.id, v.tag_key, v.label, p.id, v.definition, v.sort_order
FROM frameworks f
JOIN framework_tags p ON p.framework_id = f.id AND p.tag_key = '2-2-8'
, (VALUES
  ('2-2-8-vielfalt-einteilung', 'Vielfalt und Einteilung', 'Wirbeltierarten den fuenf Wirbeltierklassen zuordnen (Fische, Lurche, Kriechtiere, Voegel, Saeugetiere).', 1),
  ('2-2-8-koerpergliederung', 'Körpergliederung und Körperbau', 'Koerpergliederung/Skelett vergleichen (gleiche Gliederung, unterschiedliche Auspraegung); Begriff Wirbeltier definieren (Innenskelett mit Schaedel/Wirbelsaeule), von Wirbellosen abgrenzen.', 2),
  ('2-2-8-angepasstheit-saeugetiere', 'Angepasstheit – Säugetiere', 'Integrierte Fallstudie: Gliedmassenskelett<->Fortbewegung, Ernaehrung und Atmung, Fortpflanzung/Entwicklung -- jeweils am Beispiel der Saeugetiere.', 3),
  ('2-2-8-weitere-wirbeltierklassen', 'Weitere Wirbeltierklassen', 'Fische (Bachforelle), Lurche (Grasfrosch), Kriechtiere (Ringelnatter), Voegel (Graugans) -- je eigene Fallstudie zu Fortbewegung/Atmung/Entwicklung.', 4),
  ('2-2-8-gegenueberstellung-ordnen', 'Gegenüberstellung und Ordnen', 'Fuenf Wirbeltierklassen gegenueberstellen (Skelett, Atmung, Koerperbedeckung, Koerpertemperatur, Fortpflanzung); Einteilung nach Ordnungskriterien (Wild-/Heim-/Nutztiere, Tierklassen, Lebensraum).', 5),
  ('2-2-8-schutz', 'Schutz von Wirbeltieren', 'Auswirkungen von Lebensraumeinfluessen ableiten; Schutzmassnahmen begruenden und bewerten.', 6)
) AS v(tag_key, label, definition, sort_order);

-- Linking existing items to their real subtopic. Content-level mapping
-- only -- no item is renamed, merged, or moved. Items whose unterthema
-- already matches the real document (the 3 migration-101 items using
-- "Weitere Wirbeltierklassen," "Gegenueberstellung und Ordnen,"
-- "Angepasstheit – Saeugetiere" verbatim) are linked too, for a complete,
-- queryable picture of the whole Lernbereich in one place.
INSERT INTO lpm_data_object_framework_tags (data_object_id, framework_tag_id, rationale)
SELECT v.data_object_id, t.id, v.rationale
FROM (VALUES
  ('afa7d719-fb4c-5410-afa6-1ce2e3182128'::uuid, '2-2-8-vielfalt-einteilung', 'Bau verschiedener Wirbeltiere beschreiben/vergleichen -- general cross-class comparison, matches "Vielfalt und Einteilung" more than any one case study.'),
  ('6fde47d3-6de9-531a-8a50-3ad783413c57'::uuid, '2-2-8-vielfalt-einteilung', 'Wirbeltierklassen und Vertreter nennen -- the five-class assignment is literally this subtopic''s own real text.'),
  ('015d0a14-02d0-5ded-8244-bf1876f2a951'::uuid, '2-2-8-koerpergliederung', 'Begriff Wirbeltier definieren und abgrenzen -- matches the real subtopic''s own definition/Abgrenzung wording closely.'),
  ('b62370af-2fe2-5a6c-9b4a-f65a7b008337'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Zerlegung der Nahrung/Aufbau koerpereigener Stoffe -- the real subtopic''s "Ernaehrung und Atmung" content, worded generically but content-matched to the mammal case study.'),
  ('61336f13-3e2a-5d89-b720-bc019a870094'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Blut als Transportmedium -- same mammal-nutrition/circulation content as the real subtopic.'),
  ('b2dc23c5-661a-532c-8247-2829885f1d2f'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Atmungsorgane im Zusammenhang mit dem Lebensraum -- real subtopic''s "Sauerstoffaufnahme ueber Lunge" content.'),
  ('f4d3b010-c86d-5569-9737-6c776e803acc'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Gliedmassenskelett und Fortbewegung -- literally named in the real subtopic''s own text.'),
  ('47322576-0224-581b-a15c-5a2b08ad7247'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Aeussere/innere Befruchtung vergleichen -- real subtopic''s "Fortpflanzung/Entwicklung (geschlechtlich, innere Befruchtung)" content.'),
  ('37cce1bb-7cbf-5c24-bb71-51277b0c612a'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Entwicklung vom befruchteten Ei zum erwachsenen Tier -- real subtopic''s "Embryonalentwicklung, Geburt" content.'),
  ('c1cc6b14-9c5f-5f0d-a0a0-8ebc9d635eb8'::uuid, '2-2-8-angepasstheit-saeugetiere', 'Stromlinienform als Anpassung (currently labelled "Kraft") -- real subtopic mentions Delfin/Schwimmen under this same case study.'),
  ('393ea953-4880-51f3-9503-6f8b534f3126'::uuid, '2-2-8-gegenueberstellung-ordnen', 'Nach Nutzung und Lebensraum ordnen -- matches "Einteilung nach Ordnungskriterien (Wild-/Heim-/Nutztiere... Lebensraum)" directly.'),
  ('f6c0b12c-177d-57f5-9baf-4fbc1f080af9'::uuid, '2-2-8-gegenueberstellung-ordnen', 'Nach Verwandtschaft ordnen -- same real subtopic, classification criterion.'),
  ('5addd20b-ae9a-5ac2-9c45-f7d2ed1a242d'::uuid, '2-2-8-gegenueberstellung-ordnen', 'Merkmale der Wirbeltierklassen nennen/zuordnen -- matches "Fuenf Wirbeltierklassen gegenueberstellen (Skelett, Atmung...)" directly.'),
  ('30abcc70-ab22-52c9-87f0-895e38202d5f'::uuid, '2-2-8-gegenueberstellung-ordnen', 'Koerperbau/Koerpertemperatur/Lebensraum verknuepfen -- real subtopic explicitly includes "Koerpertemperatur -- wechsel-/gleichwarm" as a comparison criterion.'),
  ('8943afd8-3ac7-525f-a4df-bce4f8d264c3'::uuid, '2-2-8-schutz', 'Lebensraumveraenderungen ableiten -- direct match to "Schutz von Wirbeltieren" real content.'),
  ('af819a99-ad45-50bf-a00f-3b989fb5ab6c'::uuid, '2-2-8-schutz', 'Lebensraumveraenderungen auf einzelne Lebewesen -- direct match.'),
  ('ff60d353-d357-5efa-9f78-527d45f1eec9'::uuid, '2-2-8-schutz', 'Lebensraumveraenderungen auf den Lebensraum -- direct match.'),
  ('bac4e87c-18bc-59f2-bd73-cb3bbe2448d4'::uuid, '2-2-8-schutz', 'Schutzmassnahmen begruenden und bewerten -- literally the real subtopic''s own closing sentence.')
) AS v(data_object_id, tag_key, rationale)
JOIN framework_tags t ON t.tag_key = v.tag_key
JOIN frameworks f ON f.id = t.framework_id AND f.framework_key = 'evomentor-thuringia-mnt-2026-lehrplan-struktur-v1';

-- The 3 migration-101 items already using the real subtopic names verbatim
-- as their unterthema -- linked for completeness (exact self-match).
INSERT INTO lpm_data_object_framework_tags (data_object_id, framework_tag_id, rationale)
SELECT o.id, t.id, 'unterthema already matches this real subtopic''s name verbatim.'
FROM lpm_data_objects o
JOIN framework_tags t ON t.tag_key = CASE o.content->>'unterthema'
  WHEN 'Weitere Wirbeltierklassen' THEN '2-2-8-weitere-wirbeltierklassen'
  WHEN 'Gegenüberstellung und Ordnen' THEN '2-2-8-gegenueberstellung-ordnen'
  WHEN 'Angepasstheit – Säugetiere' THEN '2-2-8-angepasstheit-saeugetiere'
END
JOIN frameworks f ON f.id = t.framework_id AND f.framework_key = 'evomentor-thuringia-mnt-2026-lehrplan-struktur-v1'
WHERE o.project_id = '1b121ef2-96c2-43f7-aa2b-0e07b8de114a'
  AND o.content->>'unterthema' IN ('Weitere Wirbeltierklassen', 'Gegenüberstellung und Ordnen', 'Angepasstheit – Säugetiere');
