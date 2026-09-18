SET search_path = public, extensions;

-- Generalizes the KI-Prompt-Generator (migration 027) from a single
-- hardcoded German/Biologie tool into a real library system -- Dustin's
-- explicit ask, 2026-09-18: "think about how other users in other regions
-- or other working languages can flexibly draw from a library of options
-- for generating productive prompt generators." EvoMentor DE v1.2 stays
-- the model for what a GOOD one looks like (the actual role/instruction
-- framing, the option vocabularies, the section structure -- all real,
-- field-tested content, not invented for this migration), but none of it
-- is code anymore -- it's the first real row in a table any project can
-- point at, and any future project can add its own row to instead of a
-- developer editing a component.

CREATE TABLE IF NOT EXISTS prompt_template_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-facing name shown when a project picks a library, e.g.
  -- "Deutsch -- Biologie (KMK Basiskonzepte)".
  label TEXT NOT NULL,
  -- BCP-47-style code (de, en, fr, ...) -- not enforced against a fixed
  -- list, since new languages should never need a schema change here.
  language TEXT NOT NULL,
  -- Nullable: a library can be subject-specific (this one is Biologie) or
  -- left general for a project to reuse across subjects.
  subject_area TEXT,
  -- The two sentences that frame the AI's role and task -- the single most
  -- important piece to get right per language/subject, since everything
  -- else in the generated prompt hangs off this framing.
  role_preamble TEXT NOT NULL,
  instruction_preamble TEXT NOT NULL,
  -- Every other piece of template chrome (section headers, inline field
  -- labels) as one flat, documented JSONB object -- see
  -- src/lib/supabase/prompt-libraries.ts's SectionLabels type for the
  -- exact keys a template needs. Kept as JSONB rather than one column per
  -- label so adding a new template field never needs a migration.
  section_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The real, curated option vocabularies (methods, differentiation types,
  -- assessment types, societal-context topics, output types) plus the two
  -- small paired-value/label lists (tone, length) and prior-knowledge
  -- levels -- see PromptOptionLists in the same file for the exact shape.
  option_lists JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Exactly one library per language+subject should be the fallback a
  -- project gets if it hasn't picked one explicitly.
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_template_libraries_language ON prompt_template_libraries(language);

ALTER TABLE prompt_template_libraries ENABLE ROW LEVEL SECURITY;

-- Shared reference data, like frameworks/framework_tags -- any signed-in
-- user can read every library to pick from, regardless of which project
-- they're in. No INSERT/UPDATE policy yet: curating a new library is a
-- migration/curator job for now (matching how "ecosystem reference"
-- frameworks already work), not something the app exposes a form for --
-- real future scope, not an oversight, once a second real library exists
-- and this needs testing against.
CREATE POLICY "Authenticated users can view prompt template libraries" ON prompt_template_libraries
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Which library a project defaults to. Nullable -- a project with none set
-- falls back to whichever library has is_default = true for its own
-- working_languages[1], resolved app-side (prompt-libraries.ts), not by a
-- second foreign key here.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS prompt_template_library_id UUID REFERENCES prompt_template_libraries(id) ON DELETE SET NULL;

-- The real German/Biologie library -- ported verbatim from EvoMentor DE
-- v1.2's own KI-Prompt-Generator (apps/evomentor_de_v1_2.html), not
-- rewritten. This is field-tested content Dustin's own team wrote and
-- refined across two feedback rounds, not a first draft.
--
-- Guarded by WHERE NOT EXISTS rather than ON CONFLICT: there's no unique
-- constraint on (language, subject_area) to key an ON CONFLICT target off
-- (deliberately -- a project might genuinely want two German/Biologie
-- variants someday), so this checks for this exact seed row directly,
-- matching migration 028_thuringia_2026_taxonomy_and_updates.sql's own
-- idempotency convention.
INSERT INTO prompt_template_libraries (
  label, language, subject_area, role_preamble, instruction_preamble, is_default,
  section_labels, option_lists
)
SELECT
  'Deutsch -- Biologie (KMK Basiskonzepte)', 'de', 'Biologie', TRUE,
  'Du bist eine erfahrene Biologie-Lehrkraft und Fachdidaktikerin.',
  'Erstelle auf Basis der folgenden Lernziele eine konkrete Unterrichtsplanung, die die unten genannten Basiskonzepte gezielt einbindet, ohne den Kernlehrplan zu verlassen.',
  jsonb_build_object(
    'title', 'UNTERRICHTSVORBEREITUNG MIT BASISKONZEPT-INTEGRATION',
    'grade_label', 'Klassenstufe(n):',
    'hours_label', 'Unterrichtsstunden:',
    'concepts_section', 'BASISKONZEPTBEZUG & VORWISSEN:',
    'extra_focus_label', 'Zusätzliche fachliche Schwerpunkte:',
    'items_section', 'LERNZIELE',
    'statement_label', 'Wortlaut:',
    'relevance_label', 'Relevanz',
    'subconcepts_label', 'Unterkonzepte:',
    'evoconcepts_label', 'Evolutionskonzepte:',
    'methods_section', 'WEITERE METHODEN:',
    'differentiation_section', 'DIFFERENZIERUNG:',
    'didactic_notes_label', 'Didaktische Hinweise:',
    'assessment_section', 'EVALUATION:',
    'eval_notes_label', 'Hinweise zur Evaluation:',
    'context_section', 'GESELLSCHAFTLICHE BEZÜGE:',
    'context_notes_label', 'Weitere Hinweise:',
    'output_section', 'GEWÜNSCHTE AUSGABE:',
    'tone_label', 'Ton:',
    'length_label', 'Länge:',
    'other_notes_label', 'Sonstige Hinweise:'
  ),
  jsonb_build_object(
    'methods', jsonb_build_array('Forschendes Lernen', 'Analogien und Vergleiche', 'Konzeptuelles Lernen', 'Diskussion', 'Narrativer Zugang', 'Modelle und Simulationen', 'Erfahrungsbasiertes Lernen', 'Digitale Medien', 'Einblick in Wissenschaftsgeschichte', 'Recherche', 'Kooperative Lernformen', 'Projektbasiertes Lernen'),
    'differentiation', jsonb_build_array('Basis- und Erweiterungsaufgaben', 'Sprachliche Differenzierung', 'Unterschiedliche Lerntempi'),
    'assessment', jsonb_build_array('Formative Beurteilung (laufend)', 'Quiz', 'Präsentationen, Poster, Flyer', 'Schriftliche Reflexion', 'Portfolio / Lerntagebuch', 'Klassenarbeit / LEK', 'Praktische Leistungen'),
    'societal_context', jsonb_build_array('Biodiversitätskrise', 'Naturschutz und Arterhaltung', 'Klimawandel und Artenanpassung', 'Pandemien und Virusevolution', 'Gesundheit und evolutionäre Medizin', 'Antibiotikaresistenz', 'Psychische Gesundheit', 'Landwirtschaft und Lebensmittelherstellung', 'Biotechnologie und Gentechnik'),
    'output_types', jsonb_build_array('Vollständige Unterrichtssequenz mit Verlaufsplänen', 'Operationalisierte Lernziele pro Stunde', 'Methodische Vorschläge pro Stunde', 'Hinweise auf Materialien / Medien', 'Schülerfehlvorstellungen', 'Differenzierungsvorschläge', 'Transfer- und Diskussionsfragen', 'Querverbindungen zwischen Lernzielen'),
    'default_output_types', jsonb_build_array('Vollständige Unterrichtssequenz mit Verlaufsplänen', 'Methodische Vorschläge pro Stunde', 'Transfer- und Diskussionsfragen'),
    'default_assessment', jsonb_build_array('Formative Beurteilung (laufend)'),
    'tones', jsonb_build_array(jsonb_build_array('professionell', 'Professionell'), jsonb_build_array('locker', 'Locker'), jsonb_build_array('wissenschaftlich', 'Wissenschaftlich')),
    'lengths', jsonb_build_array(jsonb_build_array('kurz', 'Kurz'), jsonb_build_array('ausführlich', 'Ausführlich')),
    'prior_knowledge_levels', jsonb_build_array(jsonb_build_array('keins', 'Kein Vorwissen'), jsonb_build_array('grundlagen', 'Grundbegriffe bekannt'), jsonb_build_array('solide', 'Solides Grundwissen'))
  )
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_template_libraries WHERE language = 'de' AND subject_area = 'Biologie'
);

-- Point the real pilot project at it explicitly, rather than relying on
-- is_default fallback resolution alone.
UPDATE projects SET prompt_template_library_id = (
  SELECT id FROM prompt_template_libraries WHERE language = 'de' AND subject_area = 'Biologie' LIMIT 1
)
WHERE slug = 'evomentor-thuringia' AND prompt_template_library_id IS NULL;
