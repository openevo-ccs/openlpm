-- Real comparative links and divergence-review tracking between the two
-- synthetic LPMs, grounded in TheoryBase's own 8 real, named Kampourakis-
-- dispute Divergence records (RFC-0009, synced into theorybase_snapshot by
-- migration 143 + a sync script run). Picked by hand against the real
-- strand content, same discipline as migration 141's curriculum-repository
-- links -- not auto-matched, and not forcing a weak pairing where none
-- exists (see the note on the one real strand left unlinked, at the end).
--
-- 5 of the 8 divergences map cleanly to one specific strand pair; the
-- other 3 (model-of-cognition-underlying-strategy, invariant-vs-
-- contextually-flexible-expert-reasoning, scope-of-evolution-lp) are about
-- overall instructional philosophy or whole-LPM scope, not one strand --
-- recorded as 'reviewed_project_wide' in lpm_divergence_reviews rather
-- than forced onto a specific node pair.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_inter_project UUID;
  v_link_agency UUID;
  v_link_cheetah UUID;
  v_link_negation UUID;
  v_link_artifact UUID;
  v_link_human UUID;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';

  -- ==========================================================================
  -- Comparative links (data_object <-> data_object, spans both projects)
  -- ==========================================================================

  INSERT INTO lpm_comparative_links (id, from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary)
  VALUES
  ('a1f3a0a0-0000-5000-9000-000000000001', 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', '408a667a-93d5-58a1-bb50-f8e6606b9745', 'contrasting_treatment', 'OE-DIVERGENCE-role-of-organism-agency',
   'Bio-Core''s Natural Selection and Adaptation strand treats organism behavior as structurally out of scope -- by design, not omission: the strand''s own description states it is "structurally incapable of invoking behavioral niche selection or agential framing." Interdisciplinary''s Agency, Development, and Niche Construction strand exists specifically because its own theory (ICR) treats organism agency -- niche selection, niche construction, behavioral plasticity -- as a legitimate, often necessary, causal factor. This is the headline divergence the other named disagreements largely follow from: not a dispute about whether agential mechanisms exist, but about whether K-12 curriculum design should treat them as in-scope.')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_link_agency;
  IF v_link_agency IS NULL THEN SELECT id INTO v_link_agency FROM lpm_comparative_links WHERE id = 'a1f3a0a0-0000-5000-9000-000000000001'; END IF;

  INSERT INTO lpm_comparative_links (id, from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary)
  VALUES
  ('a1f3a0a0-0000-5000-9000-000000000002', 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', '408a667a-93d5-58a1-bb50-f8e6606b9745', 'assessment_item_divergence', 'OE-DIVERGENCE-cheetah-assessment-item',
   'The real, operational form of the agency divergence: KAEVO 2.0''s correct item for cheetah running speed ("Some cheetahs randomly were faster and were able to catch more prey...") abstracts organism behavior out entirely -- the Natural Selection and Adaptation strand''s own assessment lineage. EvoFlex''s correct item for the same case ("The ancestors of cheetahs engaged in running as fast as possible in order to catch their fast-running prey...") keeps the behavioral/niche-selection context as part of a complete explanation -- the Agency, Development, and Niche Construction strand''s own assessment lineage. Both instruments agree the same four responses are wrong; they disagree about whether behavioral context is a necessary part of a correct one.')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_link_cheetah;
  IF v_link_cheetah IS NULL THEN SELECT id INTO v_link_cheetah FROM lpm_comparative_links WHERE id = 'a1f3a0a0-0000-5000-9000-000000000002'; END IF;

  INSERT INTO lpm_comparative_links (id, from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary)
  VALUES
  ('a1f3a0a0-0000-5000-9000-000000000003', 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', '408a667a-93d5-58a1-bb50-f8e6606b9745', 'assessment_scoring_divergence', 'OE-DIVERGENCE-agency-negation',
   'The single most concrete illustration of this strand pair''s disagreement: the real student response "organism behavior played no role in the evolution of this trait" is scored CORRECT by KAEVO 2.0 (the assessment lineage behind Natural Selection and Adaptation) and INCORRECT by EvoFlex (the assessment lineage behind Agency, Development, and Niche Construction) for the same cheetah case. Not an assessment-design inconsistency -- the direct operational consequence of the two strands'' own differing theoretical commitments.')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_link_negation;
  IF v_link_negation IS NULL THEN SELECT id INTO v_link_negation FROM lpm_comparative_links WHERE id = 'a1f3a0a0-0000-5000-9000-000000000003'; END IF;

  INSERT INTO lpm_comparative_links (id, from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary)
  VALUES
  ('a1f3a0a0-0000-5000-9000-000000000004', 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', '9d59fa89-cdc8-5147-a71e-95175b25fcee', 'contrasting_treatment', 'OE-DIVERGENCE-organism-artifact-dichotomy-vs-gradient',
   'Natural Selection and Adaptation implicitly relies on a sharp organism/artifact dichotomy (evolved vs. designed) as part of DCR''s own pedagogical strategy for addressing the design stance. Interdisciplinary''s Culture, Technology, and Collective Systems strand -- its "Collective Intelligence, Distributed Cognition, and Coevolving Technology" sub-strand especially -- treats that same boundary as a gradient: even artifacts (e.g. aircraft design) are shaped by decentralized cultural-evolutionary dynamics, not purely intentional design. Neither position is globally superior; the dichotomy sacrifices accuracy for clarity, the gradient sacrifices initial clarity for broader transferability.')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_link_artifact;
  IF v_link_artifact IS NULL THEN SELECT id INTO v_link_artifact FROM lpm_comparative_links WHERE id = 'a1f3a0a0-0000-5000-9000-000000000004'; END IF;

  INSERT INTO lpm_comparative_links (id, from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary)
  VALUES
  ('a1f3a0a0-0000-5000-9000-000000000005', 'd561e9fc-f767-5d25-94dc-6a4715f8ecd4', '5e4cdc6e-5c25-5f21-a833-4c0859a609da', 'contrasting_treatment', 'OE-DIVERGENCE-human-evolution-treatment',
   'Bio-Core''s Speciation and Diversity of Life strand applies the same decentralized selection framework to human evolution as to any other organism, by design -- no separate biocultural treatment. Interdisciplinary''s foundational Inheritance, Variation, and Selection Across Systems strand explicitly organizes itself around Selection''s four discipline-specific definitions (biology, culture, education, AI), treating human evolution as requiring gene-culture coevolution to understand adequately. Real empirical grounding for why this matters: interviews found some students attribute behavior-mediated evolutionary change to humans but not other animals -- an inconsistency this divergence predicts follows directly from treating the biological/cultural boundary as sharp rather than continuous.')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_link_human;
  IF v_link_human IS NULL THEN SELECT id INTO v_link_human FROM lpm_comparative_links WHERE id = 'a1f3a0a0-0000-5000-9000-000000000005'; END IF;

  -- ==========================================================================
  -- Divergence review tracking -- all 8 real Kampourakis divergences, for
  -- BOTH projects. reviewed_version matches divergences.yaml's own real
  -- provenance.version (checked directly: every entry in that file is
  -- "1.0.0" as of 2026-10-20) -- a later real revision there will make
  -- lpm_divergence_coverage's is_stale flag true, which is the whole point.
  -- ==========================================================================

  INSERT INTO lpm_divergence_reviews (project_id, divergence_ref, outcome, reviewed_version, comparative_link_id, note)
  VALUES
  (v_bio_project, 'OE-DIVERGENCE-role-of-organism-agency', 'linked', '1.0.0', v_link_agency, NULL),
  (v_inter_project, 'OE-DIVERGENCE-role-of-organism-agency', 'linked', '1.0.0', v_link_agency, NULL),
  (v_bio_project, 'OE-DIVERGENCE-cheetah-assessment-item', 'linked', '1.0.0', v_link_cheetah, NULL),
  (v_inter_project, 'OE-DIVERGENCE-cheetah-assessment-item', 'linked', '1.0.0', v_link_cheetah, NULL),
  (v_bio_project, 'OE-DIVERGENCE-agency-negation', 'linked', '1.0.0', v_link_negation, NULL),
  (v_inter_project, 'OE-DIVERGENCE-agency-negation', 'linked', '1.0.0', v_link_negation, NULL),
  (v_bio_project, 'OE-DIVERGENCE-organism-artifact-dichotomy-vs-gradient', 'linked', '1.0.0', v_link_artifact, NULL),
  (v_inter_project, 'OE-DIVERGENCE-organism-artifact-dichotomy-vs-gradient', 'linked', '1.0.0', v_link_artifact, NULL),
  (v_bio_project, 'OE-DIVERGENCE-human-evolution-treatment', 'linked', '1.0.0', v_link_human, NULL),
  (v_inter_project, 'OE-DIVERGENCE-human-evolution-treatment', 'linked', '1.0.0', v_link_human, NULL),
  (v_bio_project, 'OE-DIVERGENCE-model-of-cognition-underlying-strategy', 'reviewed_project_wide', '1.0.0', NULL,
    'About instructional strategy overall (corrective/inhibitory metacognition vs. developmental/regulatory metacognition) -- not mappable to one strand, applies to how the whole LPM is meant to be taught.'),
  (v_inter_project, 'OE-DIVERGENCE-model-of-cognition-underlying-strategy', 'reviewed_project_wide', '1.0.0', NULL,
    'Same reasoning as the Bio-Core side -- an instructional-strategy divergence, not a content one.'),
  (v_bio_project, 'OE-DIVERGENCE-invariant-vs-contextually-flexible-expert-reasoning', 'reviewed_project_wide', '1.0.0', NULL,
    'About what counts as expert reasoning across every case in the LPM, not one strand -- the assessment-design philosophy (KAEVO 2.0/ACORNS vs. EvoFlex) this whole project''s content lineage follows from.'),
  (v_inter_project, 'OE-DIVERGENCE-invariant-vs-contextually-flexible-expert-reasoning', 'reviewed_project_wide', '1.0.0', NULL,
    'Same reasoning as the Bio-Core side.'),
  (v_bio_project, 'OE-DIVERGENCE-scope-of-evolution-lp', 'reviewed_project_wide', '1.0.0', NULL,
    'This is the whole-LPM scope decision itself (biology-only vs. interdisciplinary) that distinguishes these two projects at the project level, not a specific strand-to-strand pairing -- see lpm_project_comparison_profile''s subject_domain_count for the measured version of this same fact.'),
  (v_inter_project, 'OE-DIVERGENCE-scope-of-evolution-lp', 'reviewed_project_wide', '1.0.0', NULL,
    'Same reasoning as the Bio-Core side.')
  ON CONFLICT (project_id, divergence_ref) DO NOTHING;

  -- Note on real coverage left honestly incomplete: Interdisciplinary's
  -- "Discovering and Testing Ideas: Analogy, Search, and Metacognition"
  -- strand (06af1b7b-19bb-5d77-87ac-52f34650f556) has no Bio-Core
  -- counterpart strand at all and doesn't map to any of the 8 real
  -- Kampourakis divergences specifically (analogical reasoning/
  -- metacognition as such isn't one of the named disagreements) --
  -- deliberately left with zero comparative_links rather than forced onto
  -- a weak pairing. This is itself a real, reportable finding (a
  -- structurally absent counterpart, by design) computed by the report
  -- script from the data rather than asserted here.

END $MIGRATION$;
