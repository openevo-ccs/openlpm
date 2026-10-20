-- Builds real OpenLPM "Strands" (lpm_threads) for the two synthetic LPMs
-- (bio-core-lpm-synth / interdisciplinary-lpm-synth), closing a real gap
-- found live 2026-10-20: migration 092/093 moved the two source repos'
-- strand/substrand content into lpm_data_objects and made it visible under
-- Learning Goals, but nobody ever built the matching lpm_threads rows --
-- the sidebar's own "Strands" tab (migration 010/the 2026-09-13 restructure)
-- renders from lpm_threads, not lpm_data_objects, so it showed "No strands
-- yet" for both projects despite the real content already being loaded and
-- correctly marked 'accepted'.
--
-- This isn't just cosmetic. Both source repos' own content already encodes
-- real vertical coherence (each strand's substrands span K-2/3-5/6-8/9-12,
-- building on each other) and, for interdisciplinary-lpm-synth, real
-- horizontal/cross-subject coherence (each strand's own `associatedDomains`
-- spans two subject areas, and each strand's own `relations.foundationalTo`/
-- `prerequisiteOf` names specific OTHER strands it depends on or feeds).
-- None of that was ever wired into a real, queryable relationship -- it
-- sat as free text inside each row's own `content` JSONB, invisible to any
-- page. This migration is what actually turns it into navigable structure:
-- one lpm_threads row per original strand, its substrands as ordered
-- lpm_thread_stations (the vertical/multi-grade span), and strand_parents
-- rows reconstructing the real prerequisite/foundational edges already
-- named in each strand's own `content.relations` (the horizontal,
-- cross-strand span) -- not new claims, just making existing ones real.
--
-- thread_type is 'vertical' for bio-core-lpm-synth's 3 strands (deliberately
-- single-subject -- BIO-CORE excludes agency/cross-domain concepts by
-- design, so no horizontal spread is a feature, not a gap) and
-- 'vertical_horizontal' for interdisciplinary-lpm-synth's 4 (each one
-- explicitly spans two subject areas per its own associatedDomains field).
--
-- Idempotent: fixed ids (uuid5-derived, stable across re-runs) plus the
-- real unique constraints already on lpm_threads(project_id, slug),
-- lpm_thread_stations(thread_id, sequence), and
-- strand_parents(strand_id, parent_strand_id) -- ON CONFLICT DO NOTHING
-- throughout, safe to re-apply.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_bio_branch UUID;
  v_inter_project UUID;
  v_inter_branch UUID;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';
  IF v_bio_project IS NULL OR v_inter_project IS NULL THEN
    RAISE EXCEPTION 'Expected both bio-core-lpm-synth and interdisciplinary-lpm-synth projects to already exist (migration 074)';
  END IF;
  SELECT id INTO v_bio_branch FROM branches WHERE project_id = v_bio_project AND is_trunk = TRUE;
  SELECT id INTO v_inter_branch FROM branches WHERE project_id = v_inter_project AND is_trunk = TRUE;

  -- ==========================================================================
  -- bio-core-lpm-synth: 3 strands, all thread_type 'vertical'
  -- ==========================================================================

  INSERT INTO lpm_threads (id, project_id, branch_id, slug, title, thread_type, connecting_idea, narrative, status)
  VALUES
  ('ba5f146c-213f-559d-90be-120b177f5dcb', v_bio_project, v_bio_branch, 'variation-and-inheritance', 'Variation and Inheritance', 'vertical',
   'Individuals vary, and traits are transmitted from parent to offspring -- the raw material Natural Selection and Speciation both depend on.',
   'Foundational strand establishing that individuals vary and that traits are transmitted from parent to offspring -- the raw material on which Natural Selection and Adaptation and Speciation and Diversity of Life both depend. Concepts introduced here (Gene, Allele, Population, Inheritance) are deliberately reinforced throughout the other two strands rather than confined to this one, to maximize horizontal coherence.',
   'accepted'),
  ('698860a1-3a2f-5a18-bdc6-959b49c8cb58', v_bio_project, v_bio_branch, 'natural-selection-and-adaptation', 'Natural Selection and Adaptation', 'vertical',
   'The full four-component natural selection model (variation, heritability, differential reproduction, population-level change), using exclusively decentralized causal vocabulary.',
   'The central mechanistic strand. Builds the full four-component natural selection model (variation, heritability, differential reproduction, population-level change) using exclusively decentralized causal vocabulary -- BIO-CORE contains no organism-agency concepts, so this strand is structurally incapable of invoking behavioral niche selection or agential framing. This is a direct consequence of vocabulary scope, not an instructional simplification layered on top of richer content.',
   'accepted'),
  ('255b48be-ede2-551e-a9ab-027b11d82c94', v_bio_project, v_bio_branch, 'speciation-and-diversity-of-life', 'Speciation and Diversity of Life', 'vertical',
   'Macroevolutionary divergence, built directly on the population/allele vocabulary from Variation and Inheritance and the selection/drift vocabulary from Natural Selection.',
   'Macroevolutionary strand. Depends heavily on Variation and Inheritance (population, allele) and Natural Selection and Adaptation (natural selection, selection pressure, drift) as the mechanisms that drive divergence -- this strand is where horizontal coherence is most heavily exercised, since almost every performance indicator here reinforces a concept introduced in one of the other two strands rather than introducing self-contained new mechanisms.',
   'accepted')
  ON CONFLICT (project_id, slug) DO NOTHING;

  INSERT INTO lpm_thread_stations (id, thread_id, data_object_id, sequence, role_note, relation_to_next)
  VALUES
  ('0382e7ed-a707-52bc-811a-aec0b6bccc33', 'ba5f146c-213f-559d-90be-120b177f5dcb', '8e62e70a-437d-540d-83f6-90a0fe54783a', 1, 'K-2, Noticing Variation and Family Resemblance. Key concepts: Population, Inheritance.', 'Leads into Heritable Traits and Simple Population Description (3-5).'),
  ('2aea0330-b8ac-5fbb-8832-34ed020893ba', 'ba5f146c-213f-559d-90be-120b177f5dcb', '70cf40f5-cb5d-508a-95dc-d18eaa465e94', 2, '3-5, Heritable Traits and Simple Population Description. Key concepts: Inheritance, Population.', 'Leads into Genes, Alleles, and the Origin of Variation (6-8).'),
  ('1412dfa9-def1-56a3-91d2-97abf553f2d1', 'ba5f146c-213f-559d-90be-120b177f5dcb', '8a1c0b8f-8e98-526f-bd7a-8cb2795daa85', 3, '6-8, Genes, Alleles, and the Origin of Variation. Key concepts: Gene, Allele, Mutation, Population.', 'Leads into Population-Level Genetics and Allele Frequency (9-12).'),
  ('5e1858a8-bf11-5bf4-916c-0e4b7b01d9f2', 'ba5f146c-213f-559d-90be-120b177f5dcb', '6c0b740a-cb12-5c3d-8a32-75fc01624ddf', 4, '9-12, Population-Level Genetics and Allele Frequency. Key concepts: Gene, Allele, Population, Mutation, Drift, Selection Pressure.', NULL),

  ('77f6017b-9f92-5986-a531-0697ccfc5b4c', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'aac5e307-a98f-50c6-ba5d-5cc6bcd7ebdf', 1, 'K-2, Organisms and Their Habitats. Key concepts: Adaptation.', 'Leads into Trait Advantage and Simple Selection Scenarios (3-5).'),
  ('2fa69481-edbc-539e-9c78-e623bff6b828', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'ae85f5be-aead-5819-99df-8b3d431f79d1', 2, '3-5, Trait Advantage and Simple Selection Scenarios. Key concepts: Natural Selection, Adaptation, Inheritance.', 'Leads into The Four-Component Natural Selection Mechanism (6-8).'),
  ('9126d67d-ba6a-5873-a492-93f81b778368', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', '4f1b4d5d-6232-5ef5-b44c-a850224b58a5', 3, '6-8, The Four-Component Natural Selection Mechanism. Key concepts: Natural Selection, Fitness, Selection Pressure, Drift, Gene, Allele, Mutation.', 'Leads into Evaluating Adaptationist Claims (9-12).'),
  ('917afdc0-ef29-5808-98ac-40af19c2ac98', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'b8bf5ec4-fe31-593a-8177-15b8109517b4', 4, '9-12, Evaluating Adaptationist Claims. Key concepts: Adaptation, Fitness, Drift, Selection Pressure, Mutation, Population.', NULL),

  ('5db0beba-7c49-5b3e-8d52-1450be735796', '255b48be-ede2-551e-a9ab-027b11d82c94', '76c205d2-33d4-5532-ba5a-cab715380b5e', 1, 'K-2, Many Different Kinds of Living Things. Key concepts: Species, Extinction.', 'Leads into Species, Relatedness, and Extinction (3-5).'),
  ('b666ac84-7801-5469-988a-a162c49a5a42', '255b48be-ede2-551e-a9ab-027b11d82c94', 'a4cd9b9e-d3a1-52bd-b76f-eb6173ab7259', 2, '3-5, Species, Relatedness, and Extinction. Key concepts: Species, Common Ancestor, Extinction.', 'Leads into How Populations Become New Species (6-8).'),
  ('7b6748b2-5634-5a21-ada0-21aca78e6606', '255b48be-ede2-551e-a9ab-027b11d82c94', 'ca152c60-d9a5-509f-afdb-e2e7bdf983b4', 3, '6-8, How Populations Become New Species. Key concepts: Speciation, Phylogeny, Species, Population, Natural Selection, Selection Pressure.', 'Leads into Evidence, Deep Time, and Patterns of Extinction (9-12).'),
  ('9cd74d16-18ee-5d6c-8cfe-c66e306fc927', '255b48be-ede2-551e-a9ab-027b11d82c94', '60df174a-b374-5cd1-9d06-9d76ecc4af9f', 4, '9-12, Evidence, Deep Time, and Patterns of Extinction. Key concepts: Phylogeny, Common Ancestor, Extinction, Allele, Mutation, Drift.', NULL)
  ON CONFLICT (thread_id, sequence) DO NOTHING;

  -- Real cross-strand dependencies, reconstructed from each strand's own
  -- content.relations field (092's seed) -- 'foundationalTo'/'prerequisiteOf'
  -- read as "the strand pointed at depends on / nests under this one".
  INSERT INTO strand_parents (id, strand_id, parent_strand_id)
  VALUES
  ('8cca6d24-1d2c-55e4-a793-e028678d1d5d', '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'ba5f146c-213f-559d-90be-120b177f5dcb'),
  ('1d5333e2-9bb4-53cb-90d6-4eec772a90dc', '255b48be-ede2-551e-a9ab-027b11d82c94', 'ba5f146c-213f-559d-90be-120b177f5dcb'),
  ('ae694c52-6e9c-5b67-9547-77c51263b1ba', '255b48be-ede2-551e-a9ab-027b11d82c94', '698860a1-3a2f-5a18-bdc6-959b49c8cb58')
  ON CONFLICT (strand_id, parent_strand_id) DO NOTHING;

  -- ==========================================================================
  -- interdisciplinary-lpm-synth: 4 strands, all thread_type 'vertical_horizontal'
  -- (each strand's own associatedDomains already spans two subject areas)
  -- ==========================================================================

  INSERT INTO lpm_threads (id, project_id, branch_id, slug, title, thread_type, connecting_idea, narrative, status)
  VALUES
  ('932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', v_inter_project, v_inter_branch, 'inheritance-variation-selection-across-systems', 'Inheritance, Variation, and Selection Across Systems', 'vertical_horizontal',
   'Uses Selection''s four discipline-specific definitions (biology, culture, education, AI) as the organizing device -- biological and cultural cases encountered side by side from an early grade band, full multi-disciplinary comparison by 9-12.',
   'Foundational cross-domain strand. Uses the OE-INTERDISCIPLINARY Selection concept''s four discipline-specific definitions (biology, culture, education, AI) as the strand''s organizing device: rather than teaching biological selection first and analogizing outward, students encounter biological and cultural cases side by side from an early grade band, with full multi-disciplinary comparison reserved for 9-12.',
   'accepted'),
  ('43533bcf-fd95-5e80-83b7-5a9be1b466fd', v_inter_project, v_inter_branch, 'agency-development-and-niche-construction', 'Agency, Development, and Niche Construction', 'vertical_horizontal',
   'Exists because OE-INTERDISCIPLINARY treats Agency and Niche Construction as first-class concepts -- no BIO-CORE counterpart strand exists. Reinforces the Selection concept throughout: behavior as a factor shaping what gets selected.',
   'This strand exists only because OE-INTERDISCIPLINARY defines Agency and Niche Construction as first-class concepts -- BIO-CORE has no equivalent, so bio-core-lpm-synth has no counterpart strand. Deliberately reinforces Inheritance, Variation, and Selection''s Selection concept throughout (behavior as a factor shaping what gets selected) rather than treating agency as a separate, unrelated topic.',
   'accepted'),
  ('7a555416-85d5-5b4d-8f60-57c3474f8ce3', v_inter_project, v_inter_branch, 'discovering-and-testing-ideas', 'Discovering and Testing Ideas: Analogy, Search, and the Growth of Understanding', 'vertical_horizontal',
   'Exists because OE-INTERDISCIPLINARY treats Analogical Reasoning and Metacognition as first-class concepts -- no BIO-CORE counterpart strand exists. How minds, cultures, and science itself search for better ideas by starting from the most similar known case and trying a small change.',
   'This strand exists only because OE-INTERDISCIPLINARY defines Analogical Reasoning and Metacognition as first-class concepts -- BIO-CORE has no equivalent, the same reason Agency, Development, and Niche Construction has none either. A strand about how minds, cultures, and science itself come up with better ideas -- not by searching everything at once, but by starting from whatever known case is most similar to the new problem and trying a small change.',
   'accepted'),
  ('8a5e0393-d378-584d-add1-a3c9c4022bb6', v_inter_project, v_inter_branch, 'culture-technology-and-collective-systems', 'Culture, Technology, and Collective Systems', 'vertical_horizontal',
   'The broadest strand -- deliberately reinforces Inheritance/Variation/Selection (Transmission, Selection, Innovation-as-variation-generator) and Agency/Niche Construction throughout, so all three strands converge on a shared explanatory vocabulary by 9-12.',
   'The broadest strand, drawing on OE-INTERDISCIPLINARY''s social/cultural concepts. Deliberately reinforces Inheritance, Variation, and Selection (Transmission, Selection, Innovation-as-variation-generator) and Agency, Development, and Niche Construction throughout, so that by 9-12 all three strands converge on a shared explanatory vocabulary rather than remaining parallel tracks.',
   'accepted')
  ON CONFLICT (project_id, slug) DO NOTHING;

  INSERT INTO lpm_thread_stations (id, thread_id, data_object_id, sequence, role_note, relation_to_next)
  VALUES
  ('338ea0f6-d4b1-5c00-9bf8-3ba378b69a9c', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', '04d57493-ac2f-5ec6-a1ba-0596eae3158a', 1, 'K-2, Things That Get Passed On. Key concepts: Inheritance, Variation.', 'Leads into Comparing Biological and Cultural Transmission (3-5).'),
  ('ffb19b73-b2f1-5712-84dd-796ff3f97dbc', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', 'db1fca08-0dcf-5910-a3df-2de902e8630a', 2, '3-5, Comparing Biological and Cultural Transmission. Key concepts: Inheritance, Transmission, Variation.', 'Leads into The General Pattern: Variation, Selection, Transmission (6-8).'),
  ('43fdeff4-eb64-5002-b88b-1d046f1ba5e2', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', '6315aad7-35b7-52dc-9dd2-1b82d707a768', 3, '6-8, The General Pattern: Variation, Selection, Transmission. Key concepts: Evolutionary Process, Selection, Variation, Transmission, Information.', 'Leads into Selection Across Biology, Culture, Education, and AI (9-12).'),
  ('96490c92-9ba5-53cd-b551-2a377a8802fc', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0', '396e3dd9-4f22-5160-b6c7-3752caefa1b8', 4, '9-12, Selection Across Biology, Culture, Education, and AI. Key concepts: Selection, Evolutionary Process, Inheritance, Variation, Transmission.', NULL),

  ('f4c65230-384a-5970-8a3b-6cd5d178cca1', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', '6f04ee30-2be3-537b-9d0e-b339d9fed79c', 1, 'K-2, Living Things Act to Meet Their Needs. Key concepts: Agency, Development.', 'Leads into Comparing How Different Living Things Act, Learn, and Teach (3-5).'),
  ('88469add-1d77-5781-b2e9-463be268fef0', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', '31b2be29-7a8c-5f98-a447-55ecf57f1ff9', 2, '3-5, Comparing How Different Living Things Act, Learn, and Teach. Key concepts: Agency, Learning, Teaching, Scaffolding.', 'Leads into Agency, Niche Construction, and Selection (6-8).'),
  ('39a2364a-4891-5405-8487-b1acd4512f15', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', '3a112595-4435-5db0-950d-ca7c6da5160d', 3, '6-8, Agency, Niche Construction, and Selection. Key concepts: Agency, Niche Construction, Development, Selection.', 'Leads into Agency and Niche Construction Across Biological and Technological Systems (9-12).'),
  ('dcc0de89-e718-5e45-bb5b-922b7800b03a', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', '5d938d91-e81b-516c-ba58-a234b6d5559f', 4, '9-12, Agency and Niche Construction Across Biological and Technological Systems. Key concepts: Agency, Niche Construction, Learning, Teaching, Selection, Information, Communication.', NULL),

  ('9ee390db-b9b8-5bb4-a225-0dbc62790e02', '7a555416-85d5-5b4d-8f60-57c3474f8ce3', '8363df74-ecd8-54e9-82f1-e93623f9995c', 1, 'K-2, Ideas That Are Like Other Ideas. Key concepts: Analogical Reasoning, Variation, Theory of Mind.', 'Leads into Good Guesses, Better Guesses: Testing Ideas (3-5).'),
  ('08a5530e-321a-547d-b8b3-9e9d48b2858d', '7a555416-85d5-5b4d-8f60-57c3474f8ce3', 'a64224d1-ac36-5b1c-b475-3c5af3aa4656', 2, '3-5, Good Guesses, Better Guesses: Testing Ideas. Key concepts: Analogical Reasoning, Selection, Metacognition.', 'Leads into How Minds and Cultures Search for Better Ideas (6-8).'),
  ('16aa6928-9a5c-5980-a1de-996b900dd7a1', '7a555416-85d5-5b4d-8f60-57c3474f8ce3', 'd2dc3119-7af8-55d8-8bfe-b63a4ec56acb', 3, '6-8, How Minds and Cultures Search for Better Ideas. Key concepts: Analogical Reasoning, Metacognition, Innovation, Evolutionary Process.', 'Leads into The Shared Structure of Discovery: Darwin''s Notebooks and the History of Science (9-12).'),
  ('f2b9c5f7-fbd1-5fcd-adb3-dff3571d983d', '7a555416-85d5-5b4d-8f60-57c3474f8ce3', 'ba60a3be-0135-5b53-b88f-a7aecfe0ed96', 4, '9-12, The Shared Structure of Discovery: Darwin''s Notebooks and the History of Science. Key concepts: Analogical Reasoning, Metacognition, Intuitive Theories, Selection.', NULL),

  ('ce464bb0-ed7a-5f06-a119-72b8b507bc7d', '8a5e0393-d378-584d-add1-a3c9c4022bb6', '9fc65a59-5de1-51ad-ad30-a9c0faca177a', 1, 'K-2, Groups, Rules, and Tools. Key concepts: Culture, Technology, Communication.', 'Leads into Comparing Communities and Changing Tools Over Time (3-5).'),
  ('bff1a776-d784-5fc8-8955-7f570e6c0c90', '8a5e0393-d378-584d-add1-a3c9c4022bb6', 'a1bc92d8-3730-53b8-a059-f3999e4387cf', 2, '3-5, Comparing Communities and Changing Tools Over Time. Key concepts: Culture, Cooperation, Conflict, Innovation.', 'Leads into Culture as Transmitted, Institutions as Stabilizing Structures (6-8).'),
  ('b130ca48-45bf-58e7-8700-0ad076622fbf', '8a5e0393-d378-584d-add1-a3c9c4022bb6', 'ad0173a4-5c64-5d05-96ac-2b61810c4153', 3, '6-8, Culture as Transmitted, Institutions as Stabilizing Structures. Key concepts: Culture, Institutions, Norms, Information, Representation, Transmission, Innovation.', 'Leads into Collective Intelligence, Distributed Cognition, and Coevolving Technology (9-12).'),
  ('4d0cb531-0daf-5579-8357-a04f175ee39a', '8a5e0393-d378-584d-add1-a3c9c4022bb6', 'e820dc2d-9317-57d1-8475-22a701fc486a', 4, '9-12, Collective Intelligence, Distributed Cognition, and Coevolving Technology. Key concepts: Collective Intelligence, Distributed Cognition, Technology, Knowledge, Agency, Niche Construction, Selection.', NULL)
  ON CONFLICT (thread_id, sequence) DO NOTHING;

  INSERT INTO strand_parents (id, strand_id, parent_strand_id)
  VALUES
  ('fa502431-6026-54af-a92e-61ed67f05bb5', '43533bcf-fd95-5e80-83b7-5a9be1b466fd', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0'),
  ('a110e5de-a7d4-5a3e-8113-63dcb0e73619', '7a555416-85d5-5b4d-8f60-57c3474f8ce3', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0'),
  ('0ab15bcd-adec-56e4-9d92-07c5b5aba6f5', '8a5e0393-d378-584d-add1-a3c9c4022bb6', '932bdcf8-39b4-54ec-b0ff-3039fbacfaa0'),
  ('69f30d55-e3be-5f9e-8e34-3631ee7c799b', '8a5e0393-d378-584d-add1-a3c9c4022bb6', '43533bcf-fd95-5e80-83b7-5a9be1b466fd')
  ON CONFLICT (strand_id, parent_strand_id) DO NOTHING;

END $MIGRATION$;
