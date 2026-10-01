SET search_path = public, extensions;

-- Real feedback, Susan Hanisch 2026-10-01: she asked to "add option
-- Gesellschaftliche Bezüge" with a specific list. The option itself already
-- existed (migration 029's own `societal_context` list) -- she'd never seen
-- it because the student Prompt Generator page was missing the whole UI
-- section (fixed separately, same session, in student-prompt-page.tsx).
-- This migration is the one small, real content difference between what
-- was seeded and what she actually asked for: her list merges the three
-- separate pandemic/resistance/virus items into one line, and adds
-- "Bioethik", which the original seed didn't have. Updating the real
-- wording rather than leaving the gap, since it's a one-line content edit
-- with no schema change -- not a decision that needs its own migration
-- review cycle.
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
    'Biotechnologie und Gentechnik',
    'Bioethik'
  )
)
WHERE language = 'de' AND subject_area = 'Biologie';
