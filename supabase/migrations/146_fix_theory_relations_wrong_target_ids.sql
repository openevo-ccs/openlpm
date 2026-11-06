-- Fixes a real bug in migration 145: 7 of its interdisciplinary-lpm-synth
-- theory_relations rows used the lpm_data_objects strand id (the one
-- correct for curriculum_repository_links/lpm_comparative_links elsewhere
-- in this same migration, which is exactly why the habit carried over by
-- mistake) instead of the lpm_threads id target_type='thread' actually
-- requires. The bio-core half of the same migration used the correct
-- thread ids throughout -- caught live while building the Open Universe
-- world export (today's new tools/export_bio_core_interdisciplinary_
-- comparison_world.mjs resolved target_id -> thread title -> strand, and
-- 7 of 8 interdisciplinary rows resolved to nothing).

SET search_path = public, extensions;

DELETE FROM theory_relations
WHERE target_type = 'thread'
  AND target_id IN (
    '408a667a-93d5-58a1-bb50-f8e6606b9745', -- wrong: Agency/Niche DATA OBJECT id
    '5e4cdc6e-5c25-5f21-a833-4c0859a609da', -- wrong: Inheritance/Variation/Selection DATA OBJECT id
    '9d59fa89-cdc8-5147-a71e-95175b25fcee'  -- wrong: Culture/Technology DATA OBJECT id
  )
  AND theory_id IN (
    '9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', -- ICR
    '458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', -- Interdisciplinary Evolutionary Literacy
    '754564f3-c0a4-5f23-8eed-f0c4e86fec6a'  -- Restructuration Theory
  );

INSERT INTO theory_relations (theory_id, target_type, target_id, relation_label, annotation)
VALUES
('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'thread', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', 'instantiates',
  'The strand that exists specifically because ICR treats organism agency as legitimate -- Bio-Core has no counterpart strand for exactly this reason.'),
('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'thread', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', 'grounds',
  'The foundational cross-domain strand ICR''s own four-discipline Selection framing organizes.'),
('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'thread', '8a5e0393-d378-584d-add1-a3c9c4022bb6', 'grounds',
  'ICR''s cross-domain causal-transfer claim extends to this strand''s own cultural/technological systems content.'),
('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', 'grounds_scope',
  'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim.'),
('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', 'grounds_scope',
  'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim.'),
('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', 'thread', '8a5e0393-d378-584d-add1-a3c9c4022bb6', 'grounds_scope',
  'Interdisciplinary Evolutionary Literacy''s cross-subject scope claim.'),
('754564f3-c0a4-5f23-8eed-f0c4e86fec6a', 'thread', '8a5e0393-d378-584d-add1-a3c9c4022bb6', 'informs',
  'Restructuration Theory''s representational-infrastructure claim is this strand''s own Collective Intelligence/Distributed Cognition/Coevolving Technology sub-strand territory.')
ON CONFLICT ON CONSTRAINT theory_relations_unique_target_label DO NOTHING;
