SET search_path = public, extensions;

-- Two English guided tours for the pair of synthetic progression spaces, written
-- for evolution education researchers who have not used OpenLPM before
-- (2026-11-13). One tour per space, because each names the strands and stages of
-- its own space.
--   * "Two ways to build a K-12 evolution progression (1 of 2): Bio-Core"
--     in bio-core-lpm-synth
--   * "(2 of 2): Interdisciplinary" in interdisciplinary-lpm-synth
-- Every step ends with a question the reader can answer from their own studies.
-- The strand and stage names come from the spaces as they stood on 2026-11-13.
-- The text is a Claude draft. No evolution education researcher has read it yet.
-- Tours show only to members of the space, and the tour editor (Help, "Edit
-- tours") lets an owner change any step.
-- Rollback: DELETE FROM guided_tours WHERE title LIKE 'Two ways to build a K-12 evolution progression%';

DO $seed$
DECLARE
  v_bio UUID;
  v_inter UUID;
BEGIN
  SELECT id INTO v_bio FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter FROM projects WHERE slug = 'interdisciplinary-lpm-synth';

  IF v_bio IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM guided_tours WHERE project_id = v_bio AND title = 'Two ways to build a K-12 evolution progression (1 of 2): Bio-Core'
  ) THEN
    INSERT INTO guided_tours (project_id, title, description, language, is_published, offer_on_first_visit, sort_order, steps)
    VALUES (
      v_bio,
      'Two ways to build a K-12 evolution progression (1 of 2): Bio-Core',
      'The first half of a pair. Bio-Core explains evolution with population-level causes only. About five minutes.',
      'en',
      true,
      false,
      0,
      $steps$[
        {"title": "Welcome",
         "page": "",
         "body": "Bio-Core and the Interdisciplinary space are a pair. They were built to test one design question: what changes in a K-12 evolution progression when explanations may use only population-level causes, and what changes when they may also use organism behavior, culture and technology?\n\nBoth are synthetic. Nobody has taught from them, and every item shows its own review status. Their use is that you can compare them stage by stage with what you know from your own studies.\n\nThis tour covers Bio-Core in about five minutes. A second tour in the Interdisciplinary space covers the other half. You can leave a tour at any time and restart it from Help."},
        {"title": "The side menu",
         "anchor": "sidebar",
         "body": "The menu is the same in both spaces. This tour visits three places: Strands (the lines of ideas through the grades), Concepts (the vocabulary each space defines) and Literature (the papers behind them)."},
        {"title": "Strands",
         "anchor": "strands.liste",
         "page": "strands",
         "body": "A strand follows one line of ideas from kindergarten to grade 12. Bio-Core has three main strands: Variation and Inheritance, Natural Selection and Adaptation, and Speciation and Diversity of Life.\n\nBelow them you will find strands of human examples and four thinking tools (Tinbergen's questions, causal maps, payoff tables and analogy maps).",
         "tryIt": "Click Natural Selection and Adaptation."},
        {"title": "Stages by grade band",
         "anchor": "strands.detail",
         "hint": "Pick a strand in the list first, for example Natural Selection and Adaptation.",
         "body": "The stations are the stages, one for each grade band.\n\nGrades K-2: Organisms and Their Habitats.\nGrades 3-5: Trait Advantage and Simple Selection Scenarios.\nGrades 6-8: The Four-Component Natural Selection Mechanism (variation, heritability, differential reproduction, change in populations).\nGrades 9-12: Evaluating Adaptationist Claims.\n\nA question for you: at which grade band do your own data show that students can use the full four-component model?"},
        {"title": "The rule that shapes the space",
         "body": "Bio-Core uses only causes that work at the level of populations: variation, heredity, differential reproduction and drift. It has no concept of organism agency. The strands therefore cannot say that an animal chose where to live or changed its surroundings.\n\nThat limit is built in on purpose. It is what the comparison tests.\n\nA question for you: in your studies, where do students start to bring in what an organism wants or does, and at what age?"},
        {"title": "Human examples",
         "anchor": "strands.liste",
         "body": "Bio-Core also carries human cases, each in its own strand: family resemblance (K-2), people choosing which animals and plants breed (3-5), lactase persistence as a gene variant (6-8) and across populations (9-12), controlled selection in foxes (6-8), and other human species and extinction (9-12).\n\nA question for you: which human case would you place earliest, and why?"},
        {"title": "Concepts",
         "page": "concepts",
         "body": "Bio-Core defines 25 concepts, among them Natural Selection, Drift, Common Descent and Deep Time, Domestication and Sexual Selection. Open one to read how Bio-Core defines it.\n\nA question for you: does the definition say what you mean by the term?"},
        {"title": "Literature, and where to tell us what you think",
         "page": "literature",
         "body": "Papers linked to a strand appear at the bottom of that strand's page. The Literature page lists the papers for the whole space.\n\nA question for you: which papers from your subfield are missing?\n\nWhere a stage here does not match what you have seen, use the Send feedback button at the bottom of the screen and name the stage. Then open the Interdisciplinary space and start its tour from Help."}
      ]$steps$::jsonb
    );
  END IF;

  IF v_inter IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM guided_tours WHERE project_id = v_inter AND title = 'Two ways to build a K-12 evolution progression (2 of 2): Interdisciplinary'
  ) THEN
    INSERT INTO guided_tours (project_id, title, description, language, is_published, offer_on_first_visit, sort_order, steps)
    VALUES (
      v_inter,
      'Two ways to build a K-12 evolution progression (2 of 2): Interdisciplinary',
      'The second half of a pair. This space also allows organism behavior, culture and technology in its explanations. About five minutes.',
      'en',
      true,
      false,
      0,
      $steps$[
        {"title": "Welcome",
         "page": "",
         "body": "This is the second space of the pair (the first is Bio-Core). It allows the same explanations as Bio-Core and also organism behavior, culture and technology. It defines each shared concept once in general and once for each domain: biology, culture, education, and AI and computation. Each definition says what does not carry over from one domain to another.\n\nIt is synthetic. Nobody has taught from it, and every item shows its own review status. Its use is that you can compare it with Bio-Core, stage by stage, and with what you know from your own studies.\n\nYou can leave a tour at any time and restart it from Help."},
        {"title": "Strands",
         "anchor": "strands.liste",
         "page": "strands",
         "body": "This space has six main strands: Inheritance, Variation and Selection Across Systems; Agency, Development and Niche Construction; Culture, Technology and Collective Systems; Discovering and Testing Ideas; The Nature of Schooling; and The Languages of Being Human.\n\nAround them are six bridge cases (small human cases that join several strands) and the four thinking tools.",
         "tryIt": "Click Inheritance, Variation, and Selection Across Systems."},
        {"title": "Selection across systems",
         "anchor": "strands.detail",
         "hint": "Pick a strand in the list first, for example Inheritance, Variation, and Selection Across Systems.",
         "body": "Grades K-2: Things That Get Passed On.\nGrades 3-5: Comparing Biological and Cultural Transmission.\nGrades 6-8: The General Pattern: Variation, Selection, Transmission.\nGrades 9-12: Selection Across Biology, Culture, Education, and AI.\n\nBiological and cultural cases appear side by side from an early grade band.\n\nA question for you: at what age can students hold both cases in mind, and what do they mix up?"},
        {"title": "Agency",
         "anchor": "strands.liste",
         "body": "The strand Agency, Development, and Niche Construction exists only in this space. Bio-Core has no counterpart on purpose.\n\nIt runs from Living Things Act to Meet Their Needs (K-2) through Comparing How Different Living Things Act, Learn, and Teach (3-5) and Agency, Niche Construction, and Selection (6-8) to Agency and Niche Construction Across Biological and Technological Systems (9-12).\n\nA question for you: where do your data show reasoning about what organisms do and reasoning about selection first meeting?",
         "tryIt": "Click Agency, Development, and Niche Construction."},
        {"title": "Bridge cases",
         "anchor": "strands.liste",
         "body": "Two bridge cases are worth comparing with Bio-Core: Domestication, People and Other Species Changing Together (6-8) and Lactase Persistence, Genes and Culture Changing Together (9-12). Bio-Core handles lactase persistence too, as a gene variant and then across populations, using population-level vocabulary only.\n\nA question for you: what does a student gain, or lose, from meeting the same case in each way?"},
        {"title": "Concepts",
         "page": "concepts",
         "body": "The concept list here is much longer than in Bio-Core (about 380 entries), because a shared concept such as Fitness, Variation or Selection appears once in general and once for each domain, for example Fitness (biology), Fitness (culture) and Fitness (AI and computation).\n\nA question for you: do the domain meanings of a term you know well say what you would say?"},
        {"title": "Literature, and where to tell us what you think",
         "page": "literature",
         "body": "Papers linked to a strand appear at the bottom of that strand's page. The Literature page lists the papers for the whole space.\n\nA question for you: which papers from your subfield are missing?\n\nWhere a stage here does not match what you have seen, use the Send feedback button at the bottom of the screen and name the stage."}
      ]$steps$::jsonb
    );
  END IF;
END
$seed$;
