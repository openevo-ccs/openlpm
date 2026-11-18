SET search_path = public, extensions;

-- Retire numbered ids in the text of live data (Dustin Eirdosh, 2026-11-18: no id is numbered any more; plan in
-- lab_manager/docs/design-notes/ecosystem-numbered-ids-to-slugs-migration-plan-2026-11-18.md).
--
-- The ids named in these rows were written when the seed migrations ran (053, 069, 092, 128, 160, 185, 202). ConceptBase,
-- CompetencyBase and the repos that use their ids now use slug ids, so the text here is rewritten to match. Only the 82
-- ids listed below are touched, one exact replacement each, and only in these places:
--   lpm_data_objects.content          (250 rows at the time of writing)
--   lpm_schema_elements.metadata      (50 rows)
--   projects.description and projects.epistemic_status_note (5 rows)
-- The old migration files keep their numbers. They are history, and the migration list is append-only.
-- The snapshot caches (*_snapshot) are refreshed by the sync scripts. feedback.context is user text and is left alone.
-- Running it twice changes nothing.

CREATE TEMP TABLE retired_id_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO retired_id_map (old_id, new_id) VALUES
  ('OE-ASSESS-BUGEVOLUTION-001', 'OE-ASSESS-bug-evolution'),
  ('OE-ASSESS-ETHNOCENTRISM-001', 'OE-ASSESS-ethnocentrism'),
  ('OE-ASSESS-ISLANDWORLD-001', 'OE-ASSESS-island-world'),
  ('OE-COMPETENCY-000102', 'OE-COMPETENCY-ngss-life-science-ms-ls1-2'),
  ('OE-COMPETENCY-000108', 'OE-COMPETENCY-ngss-life-science-ms-ls1-8'),
  ('OE-COMPETENCY-000110', 'OE-COMPETENCY-ngss-life-science-ms-ls2-1'),
  ('OE-COMPETENCY-000128', 'OE-COMPETENCY-ngss-life-science-hs-ls1-3'),
  ('OE-COMPETENCY-000141', 'OE-COMPETENCY-ngss-life-science-hs-ls2-8'),
  ('OE-COMPETENCY-000148', 'OE-COMPETENCY-ngss-life-science-hs-ls4-2'),
  ('OE-COMPETENCY-000263', 'OE-COMPETENCY-ai4k12-1-c-i-k-2-lo'),
  ('OE-COMPETENCY-000281', 'OE-COMPETENCY-ai4k12-2-a-i'),
  ('OE-COMPETENCY-000283', 'OE-COMPETENCY-ai4k12-2-a-i-k-2-eu'),
  ('OE-COMPETENCY-000284', 'OE-COMPETENCY-ai4k12-2-a-i-3-5-lo'),
  ('OE-COMPETENCY-000286', 'OE-COMPETENCY-ai4k12-2-a-i-6-8-lo'),
  ('OE-COMPETENCY-000321', 'OE-COMPETENCY-ai4k12-2-b-i-3-5-eu'),
  ('OE-COMPETENCY-000325', 'OE-COMPETENCY-ai4k12-2-b-i-9-12-eu'),
  ('OE-COMPETENCY-000341', 'OE-COMPETENCY-ai4k12-2-c-i-6-8-eu'),
  ('OE-COMPETENCY-000358', 'OE-COMPETENCY-ai4k12-3-a-i-3-5-eu'),
  ('OE-COMPETENCY-000360', 'OE-COMPETENCY-ai4k12-3-a-i-6-8-eu'),
  ('OE-COMPETENCY-000394', 'OE-COMPETENCY-ai4k12-3-a-v-9-12-eu'),
  ('OE-COMPETENCY-000397', 'OE-COMPETENCY-ai4k12-3-a-vi-3-5-eu'),
  ('OE-COMPETENCY-000399', 'OE-COMPETENCY-ai4k12-3-a-vi-6-8-eu'),
  ('OE-COMPETENCY-000528', 'OE-COMPETENCY-ai4k12-5-a-iii-6-8-eu'),
  ('OE-CONCEPT-000101', 'OE-CONCEPT-bio-core-evolution'),
  ('OE-CONCEPT-000102', 'OE-CONCEPT-bio-core-natural-selection'),
  ('OE-CONCEPT-000103', 'OE-CONCEPT-bio-core-mutation'),
  ('OE-CONCEPT-000104', 'OE-CONCEPT-bio-core-adaptation'),
  ('OE-CONCEPT-000105', 'OE-CONCEPT-bio-core-fitness'),
  ('OE-CONCEPT-000106', 'OE-CONCEPT-bio-core-gene'),
  ('OE-CONCEPT-000107', 'OE-CONCEPT-bio-core-allele'),
  ('OE-CONCEPT-000109', 'OE-CONCEPT-bio-core-species'),
  ('OE-CONCEPT-000110', 'OE-CONCEPT-bio-core-speciation'),
  ('OE-CONCEPT-000111', 'OE-CONCEPT-bio-core-drift'),
  ('OE-CONCEPT-000112', 'OE-CONCEPT-bio-core-inheritance'),
  ('OE-CONCEPT-000113', 'OE-CONCEPT-bio-core-phylogeny'),
  ('OE-CONCEPT-000114', 'OE-CONCEPT-bio-core-common-ancestor'),
  ('OE-CONCEPT-000115', 'OE-CONCEPT-bio-core-selection-pressure'),
  ('OE-CONCEPT-000116', 'OE-CONCEPT-bio-core-extinction'),
  ('OE-CONCEPT-000117', 'OE-CONCEPT-bio-core-stabilizing-selection'),
  ('OE-CONCEPT-000118', 'OE-CONCEPT-bio-core-directional-selection'),
  ('OE-CONCEPT-000121', 'OE-CONCEPT-bio-core-frequency-dependent-selection'),
  ('OE-CONCEPT-000124', 'OE-CONCEPT-bio-core-founder-effect'),
  ('OE-CONCEPT-000125', 'OE-CONCEPT-bio-core-multilevel-selection'),
  ('OE-CONCEPT-000126', 'OE-CONCEPT-bio-core-kin-selection'),
  ('OE-CONCEPT-000128', 'OE-CONCEPT-bio-core-trade-offs'),
  ('OE-CONCEPT-000132', 'OE-CONCEPT-bio-core-domestication'),
  ('OE-CONCEPT-000133', 'OE-CONCEPT-bio-core-homology'),
  ('OE-CONCEPT-000134', 'OE-CONCEPT-bio-core-analogy'),
  ('OE-CONCEPT-000136', 'OE-CONCEPT-bio-core-endosymbiosis'),
  ('OE-CONCEPT-000137', 'OE-CONCEPT-bio-core-origin-of-multicellularity'),
  ('OE-CONCEPT-000138', 'OE-CONCEPT-bio-core-epigenetics'),
  ('OE-CONCEPT-000139', 'OE-CONCEPT-bio-core-recombination'),
  ('OE-CONCEPT-000140', 'OE-CONCEPT-bio-core-phenotypic-plasticity'),
  ('OE-CONCEPT-000142', 'OE-CONCEPT-bio-core-fossil-record'),
  ('OE-CONCEPT-000143', 'OE-CONCEPT-bio-core-transitional-forms'),
  ('OE-SANDBOX-CONCEPT-000001', 'OE-SANDBOX-CONCEPT-bio-core-hominin'),
  ('OE-SANDBOX-CONCEPT-000002', 'OE-SANDBOX-CONCEPT-bio-core-ancient-dna'),
  ('OE-SANDBOX-CONCEPT-000003', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-language-evolution'),
  ('OE-SANDBOX-CONCEPT-000004', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-comparative-cognition'),
  ('OE-SANDBOX-CONCEPT-000005', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-machine-culture'),
  ('OE-SANDBOX-CONCEPT-000006', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-hybrid-social-learning'),
  ('OE-SANDBOX-CONCEPT-000007', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-restructuration'),
  ('OE-SANDBOX-CONCEPT-000008', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-decentralized-causal-reasoning'),
  ('OE-SANDBOX-CONCEPT-000009', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-agent-based-modeling'),
  ('OE-SANDBOX-CONCEPT-000010', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-theory-of-mind'),
  ('OE-SANDBOX-CONCEPT-000011', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-metacognition'),
  ('OE-SANDBOX-CONCEPT-000012', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-intuitive-theories'),
  ('OE-SANDBOX-CONCEPT-000013', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-analogical-reasoning'),
  ('OE-SANDBOX-CONCEPT-000014', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-resilience'),
  ('OE-SANDBOX-CONCEPT-000015', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-well-being'),
  ('OE-SANDBOX-CONCEPT-000016', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-social-dilemma'),
  ('OE-SANDBOX-CONCEPT-000017', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-tragedy-of-the-commons'),
  ('OE-SANDBOX-CONCEPT-000019', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-cumulative-culture'),
  ('OE-SANDBOX-CONCEPT-000021', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-ultrasociality'),
  ('OE-SANDBOX-CONCEPT-000022', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-egalitarianism'),
  ('OE-SANDBOX-CONCEPT-000023', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-homo-economicus'),
  ('OE-SANDBOX-CONCEPT-000024', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-social-ecological-system-ses-framework'),
  ('OE-SANDBOX-CONCEPT-000026', 'OE-SANDBOX-CONCEPT-oe-interdisciplinary-moral-foundations-theory'),
  ('OE-SANDBOX-STRAND-000001', 'OE-SANDBOX-STRAND-bio-core-k12-human-evolution-capstone'),
  ('OE-SANDBOX-STRAND-000004', 'OE-SANDBOX-STRAND-bio-core-k12-human-evolution-k12-strand'),
  ('OE-SANDBOX-STRAND-000010', 'OE-SANDBOX-STRAND-interdisciplinary-k12-eva-capstone'),
  ('OE-SANDBOX-STRAND-000013', 'OE-SANDBOX-STRAND-interdisciplinary-k12-machine-culture-coevolution');

CREATE FUNCTION pg_temp.retire_ids(input TEXT) RETURNS TEXT LANGUAGE plpgsql AS $fn$
DECLARE
  r RECORD;
  out_text TEXT := input;
BEGIN
  FOR r IN SELECT old_id, new_id FROM retired_id_map ORDER BY length(old_id) DESC, old_id LOOP
    out_text := replace(out_text, r.old_id, r.new_id);
  END LOOP;
  RETURN out_text;
END
$fn$;

DO $do$
DECLARE
  n INTEGER;
BEGIN
  UPDATE lpm_data_objects SET content = pg_temp.retire_ids(content::text)::jsonb
   WHERE content::text ~ 'OE-([A-Z]+-)*[A-Z]+-[0-9]{3,}';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'lpm_data_objects.content rewritten in % rows', n;

  UPDATE lpm_schema_elements SET metadata = pg_temp.retire_ids(metadata::text)::jsonb
   WHERE metadata::text ~ 'OE-([A-Z]+-)*[A-Z]+-[0-9]{3,}';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'lpm_schema_elements.metadata rewritten in % rows', n;

  UPDATE projects SET description = pg_temp.retire_ids(description),
                      epistemic_status_note = pg_temp.retire_ids(epistemic_status_note)
   WHERE coalesce(description, '') ~ 'OE-([A-Z]+-)*[A-Z]+-[0-9]{3,}'
      OR coalesce(epistemic_status_note, '') ~ 'OE-([A-Z]+-)*[A-Z]+-[0-9]{3,}';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'projects rewritten in % rows', n;
END
$do$;
