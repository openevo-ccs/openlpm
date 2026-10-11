SET search_path = public, extensions;

-- Real feedback e893bc17 (Susan Hanisch, 2026-10-11), filed from the KI-
-- Prompt-Generator's "Gesellschaftliche Bezüge" section (migration 088's own
-- list, the current full list as of this migration): add three cross-
-- cutting education mandates (Querschnittsaufgaben) alongside the existing
-- societal-connection options. Same full-array-replace convention as
-- migrations 068/088 -- append-only in effect, since every prior entry is
-- carried forward unchanged.
UPDATE prompt_template_libraries
SET option_lists = option_lists || jsonb_build_object(
  'societal_context', jsonb_build_array(
    'Biodiversität',
    'Naturschutz und Arterhaltung',
    'Klimawandel und Artenanpassung',
    'Pandemien, Antibiotikaresistenz und Virusevolution',
    'Gesundheit und evolutionäre Medizin',
    'Psychische Gesundheit',
    'Landwirtschaft und Lebensmittelherstellung',
    'Nachhaltige Nutzung natürlicher Ressourcen',
    'Biotechnologie und Gentechnik',
    'Bioethik',
    'Demokratiebildung',
    'Digitalisierung',
    'Soziale Gerechtigkeit'
  )
)
WHERE language = 'de' AND subject_area = 'Biologie';
