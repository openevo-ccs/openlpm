SET search_path = public, extensions;

-- Real feedback 97dd9f64 (Susan Hanisch, 2026-10-02), filed from the KI-
-- Prompt-Generator's "Gesellschaftliche Bezüge" section (migration 068's own
-- list): "add: nachhaltige Nutzung natürlicher Ressourcen". One-line content
-- addition to the same option list, same convention as 068.
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
    'Bioethik'
  )
)
WHERE language = 'de' AND subject_area = 'Biologie';
