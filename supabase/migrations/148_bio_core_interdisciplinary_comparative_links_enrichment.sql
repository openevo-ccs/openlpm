-- Real feedback (2026-10-20): "create enriched data within and between
-- strands within and between the two focal LPM spaces" for the new
-- Comparison page's Sankey diagram and graph views. Before this, only 2 of
-- Bio-Core's 3 strands and 3 of Interdisciplinary's 4 strands had any
-- lpm_comparative_links row at all -- these 3 new rows cover Bio-Core's
-- third strand and connect it against Interdisciplinary's remaining
-- unconnected strands, grounded in the same real DCR-vs-ICR framework the
-- existing 5 rows use.
--
-- Interdisciplinary's "Discovering and Testing Ideas: Analogy, Search, and
-- the Growth of Understanding" strand is deliberately left with zero
-- comparative links here -- it has no real Bio-Core counterpart (it exists
-- only because OE-INTERDISCIPLINARY defines Analogical Reasoning and
-- Metacognition as first-class concepts BIO-CORE never defines at all), and
-- that absence is itself an honest finding worth showing as a gap rather
-- than papering over with an invented, weak comparison.

INSERT INTO lpm_comparative_links (from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary, created_by)
VALUES
  (
    'd8df353a-aa76-5d37-b5b4-a0cd3f1d4860', -- Variation and Inheritance (bio-core)
    '5e4cdc6e-5c25-5f21-a833-4c0859a609da', -- Inheritance, Variation, and Selection Across Systems (interdisciplinary)
    'complementary_emphasis',
    NULL,
    'Both strands build the same core mechanics -- heritable variation, differential transmission, population-level change over generations. Bio-Core''s Variation and Inheritance strand works that mechanism entirely within biology, building toward allele frequencies and population genetics. Interdisciplinary''s Inheritance, Variation, and Selection Across Systems strand generalizes the same mechanics to culture, education, and AI systems through its Selection Across Biology, Culture, Education, and AI substrand. Where the other comparative links between these two LPMs mark genuine theoretical disagreements, this one marks a shared starting mechanism that the two LPMs then take in different directions.',
    NULL
  ),
  (
    'd1b088f7-a940-5d5e-a5bc-45c0a049d351', -- Natural Selection and Adaptation (bio-core)
    '5e4cdc6e-5c25-5f21-a833-4c0859a609da', -- Inheritance, Variation, and Selection Across Systems (interdisciplinary)
    'scope_divergence',
    NULL,
    'Natural Selection and Adaptation applies a single decentralized selection mechanism uniformly, regardless of domain -- the same four-component model whether the trait is a cheetah''s running speed or a population''s allele frequencies. Inheritance, Variation, and Selection Across Systems treats domain as a genuine variable: its Selection Across Biology, Culture, Education, and AI substrand gives selection a separate working definition per domain, on the view that what counts as a unit of selection and what counts as fitness differ enough between biology, culture, education, and AI that a single shared definition would blur meaningful distinctions. The disagreement is about whether domain-general or domain-specific selection definitions better serve K-12 learners.',
    NULL
  ),
  (
    'd561e9fc-f767-5d25-94dc-6a4715f8ecd4', -- Speciation and Diversity of Life (bio-core)
    '9d59fa89-cdc8-5147-a71e-95175b25fcee', -- Culture, Technology, and Collective Systems (interdisciplinary)
    'contrasting_treatment',
    NULL,
    'Speciation and Diversity of Life treats lineage-splitting and diversification as a strictly genetic, biological process: populations diverge when gene flow between them stops. Culture, Technology, and Collective Systems extends a structurally similar diversification pattern to technological and institutional lineages -- tool traditions and institutional forms that branch, diverge, and sometimes merge again without any genetic mechanism at all. The comparison tests how far a decentralized-selection account of diversification can travel outside biology before the analogy needs qualification.',
    NULL
  );
