-- Real graph enrichment for both synthetic LPMs, responding to live
-- feedback 553dc7cd (Dustin, 2026-10-20, interdisciplinary-lpm-synth's
-- Concepts page): "Why is this concept map without links?" -- and his own
-- follow-on ask to make both LPMs' graph data as richly modeled as the
-- real content actually supports.
--
-- Root cause of the feedback (see also the frontend fix in this same
-- commit, concepts-page.tsx): the Concepts map only ever drew parent_id
-- tree edges. lpm_concept_relations (migration 087) is a real, separate
-- many-to-many concept network that has existed in the schema since
-- 2026-09-13 but was never fetched by the general Concepts page (only the
-- Jena-specific Basiskonzepte Netz tab used it) AND had never been
-- populated anywhere in the live database for ANY project, including the
-- one it was built for -- confirmed live before writing this migration.
--
-- Two real pieces:
--
-- 1. lpm_concept_relations, derived (not hand-typed) from real
--    co-occurrence: migration 092's own substrand content already lists,
--    for every substrand, which concepts it teaches together (`content.
--    concepts`, each tagged primary/reinforcing). Two concepts taught
--    together in the same real substrand are genuinely, pedagogically
--    related in that context -- a real signal already sitting in the data,
--    not an arbitrary match. LEAST/GREATEST canonicalizes each pair so the
--    same relationship isn't inserted twice in both directions.
--
-- 2. theory_relations (migration 020, also never populated anywhere
--    live): links each of the 9 theories seeded earlier today to the
--    specific real Strand(s) (lpm_threads, target_type='thread') it most
--    directly informs, not just the whole project. Scoped deliberately --
--    the two project-wide "Learning Progressions as Scientific Models"
--    theories and the two honestly-unsourced "German Basiskonzept
--    Didactics" placeholders are left unlinked to any one strand, since
--    forcing a specific-strand claim for a meta-level or admittedly-
--    unsourced theory would manufacture a precision the real content
--    doesn't support.

SET search_path = public, extensions;

-- theory_relations (migration 020) never had a uniqueness guard -- harmless
-- until the first real population of this table (this migration), which
-- needs ON CONFLICT DO NOTHING to stay idempotent on re-run. Same shape as
-- lpm_comparative_links' own (from,to,relation_type) constraint.
ALTER TABLE theory_relations DROP CONSTRAINT IF EXISTS theory_relations_unique_target_label;
ALTER TABLE theory_relations ADD CONSTRAINT theory_relations_unique_target_label
  UNIQUE (theory_id, target_type, target_id, relation_label);

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_inter_project UUID;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';

  -- ==========================================================================
  -- 1. Concept relations, derived from real substrand co-occurrence.
  -- ==========================================================================

  INSERT INTO lpm_concept_relations (project_id, from_element_id, to_element_id, relation_type)
  SELECT DISTINCT
    o.project_id,
    LEAST(e1.id, e2.id),
    GREATEST(e1.id, e2.id),
    'co_occurring_concept'
  FROM lpm_data_objects o
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'concepts') = 'array' THEN o.content -> 'concepts' ELSE '[]'::jsonb END) AS c1
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.content -> 'concepts') = 'array' THEN o.content -> 'concepts' ELSE '[]'::jsonb END) AS c2
  JOIN lpm_schema_elements e1 ON e1.project_id = o.project_id AND e1.metadata ->> 'conceptbase_id' = c1 ->> 'id'
  JOIN lpm_schema_elements e2 ON e2.project_id = o.project_id AND e2.metadata ->> 'conceptbase_id' = c2 ->> 'id'
  WHERE o.object_type = 'substrand'
    AND o.project_id IN (v_bio_project, v_inter_project)
    AND e1.id <> e2.id
  ON CONFLICT (from_element_id, to_element_id, relation_type) DO NOTHING;

  -- ==========================================================================
  -- 2. Theory -> Strand relations (theory_relations, target_type='thread').
  -- ==========================================================================

  INSERT INTO theory_relations (theory_id, target_type, target_id, relation_label, annotation)
  VALUES
  -- Bio-Core: DCR governs the whole LPM's decentralized framing, most
  -- directly instantiated in Natural Selection and Adaptation.
  ('5fcfee96-9768-5fa8-a34b-635c354e84ec', 'thread', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'instantiates',
    'The strand structurally incapable of invoking organism agency, per its own description -- the direct instantiation of DCR''s core claim.'),
  ('5fcfee96-9768-5fa8-a34b-635c354e84ec', 'thread', 'ba5f146c-213f-559d-90be-120b177f5dcb', 'grounds',
    'DCR''s exclusive decentralized vocabulary applies LPM-wide, not only to the Natural Selection strand.'),
  ('5fcfee96-9768-5fa8-a34b-635c354e84ec', 'thread', '255b48be-ede2-551e-a9ab-027b11d82c94', 'grounds',
    'DCR''s exclusive decentralized vocabulary applies LPM-wide, not only to the Natural Selection strand.'),
  ('8d7964f4-6e52-5ddc-98de-5e67b2f62f2b', 'thread', 'ba5f146c-213f-559d-90be-120b177f5dcb', 'grounds_progression',
    'The multi-year K-12 trajectory claim this theory makes is what each strand''s own K-2/3-5/6-8/9-12 station sequence (migration 139) actually instantiates.'),
  ('8d7964f4-6e52-5ddc-98de-5e67b2f62f2b', 'thread', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'grounds_progression',
    'Same multi-year trajectory grounding as the other two Bio-Core strands.'),
  ('8d7964f4-6e52-5ddc-98de-5e67b2f62f2b', 'thread', '255b48be-ede2-551e-a9ab-027b11d82c94', 'grounds_progression',
    'Same multi-year trajectory grounding as the other two Bio-Core strands.'),

  -- Interdisciplinary: ICR governs the whole LPM's agency-inclusive framing.
  ('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'thread', '408a667a-93d5-58a1-bb50-f8e6606b9745', 'instantiates',
    'The strand that exists specifically because ICR treats organism agency as legitimate -- Bio-Core has no counterpart strand for exactly this reason.'),
  ('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'thread', '5e4cdc6e-5c25-5f21-a833-4c0859a609da', 'grounds',
    'The foundational cross-domain strand ICR''s own four-discipline Selection framing organizes.'),
  ('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'thread', '9d59fa89-cdc8-5147-a71e-95175b25fcee', 'grounds',
    'ICR''s cross-domain causal-transfer claim extends to this strand''s own cultural/technological systems content.'),
  ('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '408a667a-93d5-58a1-bb50-f8e6606b9745', 'grounds_scope',
    'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim.'),
  ('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '5e4cdc6e-5c25-5f21-a833-4c0859a609da', 'grounds_scope',
    'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim.'),
  ('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '9d59fa89-cdc8-5147-a71e-95175b25fcee', 'grounds_scope',
    'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim.'),
  ('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '7a555416-85d5-5b4d-8f60-57c3474f8ce3', 'grounds_scope',
    'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim -- this strand (Analogy/Search/Metacognition) is itself a direct consequence of that scope, per its own description.'),
  ('754564f3-c0a4-5f23-8eed-f0c4e86fec6a', 'thread', '9d59fa89-cdc8-5147-a71e-95175b25fcee', 'informs',
    'Restructuration Theory''s representational-infrastructure claim is this strand''s own Collective Intelligence/Distributed Cognition/Coevolving Technology sub-strand territory.')
  ON CONFLICT ON CONSTRAINT theory_relations_unique_target_label DO NOTHING;

END $MIGRATION$;
