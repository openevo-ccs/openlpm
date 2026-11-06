-- Links 14 papers across four clusters to the comparative study, at Dustin's direct
-- request (2026-10-23): restructuration theory (Wilensky & Papert; Wilensky), broader
-- core OpenEvo (Hanisch/Eirdosh), conceptual-learning/analogical-reasoning foundations,
-- and nature-of-science/NOS-in-education. Follows the same literature_references.notes
-- pattern as migrations 149 and 163. Confirmed live 2026-10-23: no duplicate rows existed
-- for any of these 14 (project_id, literaturebase_id) pairs before this migration.
--
-- Explicitly excluded, per Dustin's own direct, emphasized instruction: Eirdosh & Hanisch
-- (2020), "Can the science of Prosocial be a part of evolution education?" (DOI
-- 10.1186/s12052-020-00119-7). Not in LiteratureBase and not referenced anywhere in this
-- migration -- do not add it here or in any future migration.
--
-- Cluster 1 (restructuration, interdisciplinary-lpm-synth only): wilensky-papert-2010 is
-- the paper this project's own "Restructuration Theory" record is named for and already
-- cites as its base_repo_ref, but had never itself been added as a literature_references
-- row -- a real gap, closed here, with a matching theory_literature_links row since it's a
-- genuine primary source (migration 140's own precedent for primary sources). wilensky-2020
-- extends it specifically to agent-based modeling. gentner-1983/gick-holyoak-1983 are the
-- cognitive-science mechanism (structural alignment, scaffolded transfer) restructuration's
-- own claim depends on. goldstone-wilensky-2008 was already cited by TheoryBase's own
-- evidentiary-maturity note for this theory but, like wilensky-papert-2010, had never
-- actually been linked here.
--
-- Cluster 2 (core OpenEvo / Hanisch & Eirdosh, interdisciplinary-lpm-synth only, matching
-- how hanisch-2023/hanisch-2025 were already scoped in migration 140): hanisch-2021 (Causal
-- Mapping), hanisch-2023-metacognitive-competency, hanisch-eirdosh-morgan-2023 (cooperation/
-- commons), eirdosh-hanisch-2023-community-science-model, hanisch-2021-fair-not-same-
-- everywhere, pillow-pearson-2015 (direct companion to the already-linked Pillow 2012).
--
-- Cluster 3 (nature-of-science, both projects -- both already carry a "Learning
-- Progressions as Scientific Models" theory record, and the DCR/ICR divergence itself is a
-- live instance of the NOS question these papers address): lederman-2002 (VNOS, the field's
-- standard instrument), erduran-dagher-2014 (Family Resemblance Approach), kaya-erduran-2016
-- (FRA applied directly to curriculum analysis -- the closest published precedent for what
-- this comparative study itself does).
--
-- type left NULL where the real type (conference proceedings, for wilensky-papert-2010) has
-- no close match in literature_references.type's CHECK (article, chapter, book, report,
-- thesis) -- migration 149's own documented convention rather than a guess.

-- ============================================================================
-- Cluster 1: Restructuration theory (interdisciplinary-lpm-synth)
-- ============================================================================

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-wilensky-papert-2010',
  'Restructurations: Reformulations of knowledge disciplines through new representational forms',
  '["Wilensky, Uri","Papert, Seymour"]'::jsonb, 2010, NULL, 'Proceedings of the Constructionism 2010 Conference', 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory: the paper the theory is named for and already cites as its own base_repo_ref, coining "restructuration" itself -- a change in a field''s representational infrastructure (their example: Roman to Hindu-Arabic numerals) that makes a previously hard idea newly learnable, beyond simply easier to teach. This project''s own bet, that agent-based/multi-agent representations can do the same for evolutionary reasoning, is a direct application of this paper''s original claim.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-wilensky-papert-2010');

INSERT INTO theory_literature_links (theory_id, reference_id, relation_type, note)
SELECT '754564f3-c0a4-5f23-8eed-f0c4e86fec6a', lr.id, 'theoretical-clarification',
  'Primary source: the paper this theory is directly named for and takes its base_repo_ref from.'
FROM literature_references lr
WHERE lr.project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND lr.literaturebase_id = 'OE-LITERATURE-wilensky-papert-2010'
  AND NOT EXISTS (SELECT 1 FROM theory_literature_links WHERE theory_id = '754564f3-c0a4-5f23-8eed-f0c4e86fec6a' AND reference_id = lr.id AND relation_type = 'theoretical-clarification');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-wilensky-2020',
  'Restructuration Theory and Agent-Based Modeling: Reformulating Knowledge Domains through Computational Representations',
  '["Wilensky, Uri"]'::jsonb, 2020, '10.7551/mitpress/12091.003.0037', 'Designing Constructionist Futures: The Art, Theory, and Practice of Learning Designs', 'chapter', 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory: Wilensky''s own later elaboration, naming agent-based modeling specifically as the representational infrastructure that reformulates a knowledge domain -- the direct precedent for why this project treats agent-based/multi-agent framings as a genuine alternative to decentralized-only reasoning rather than an instructional add-on.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-wilensky-2020');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-gentner-1983-structure-mapping',
  'Structure-Mapping: A Theoretical Framework for Analogy',
  '["Gentner, Dedre"]'::jsonb, 1983, '10.1207/s15516709cog0702_3', 'Cognitive Science', 'article', 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory: Gentner''s structure-mapping theory is the cognitive-science account of what a new representational form actually has to do to make a domain learnable -- aligning the structure of a familiar system with an unfamiliar one -- the mechanism restructuration claims is at work when agent-based modeling restructures population-level evolutionary reasoning.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-gentner-1983-structure-mapping');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-gick-holyoak-1983',
  'Schema induction and analogical transfer',
  '["Gick, Mary L.","Holyoak, Keith J."]'::jsonb, 1983, '10.1016/0010-0285(83)90002-6', 'Cognitive Psychology', 'article', 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory, alongside Gentner (1983): Gick & Holyoak''s finding that analogical transfer across structurally similar problems has to be scaffolded, rather than happening automatically from exposure to a new representation alone, is a real constraint on restructuration''s own claim -- a new representational form changes what is learnable, but not independent of how the transfer itself is taught.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-gick-holyoak-1983');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-goldstone-wilensky-2008',
  'Promoting Transfer by Grounding Complex Systems Principles',
  '["Goldstone, Robert L.","Wilensky, Uri"]'::jsonb, 2008, '10.1080/10508400802394898', 'Journal of the Learning Sciences', 'article', 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory: the real far-transfer empirical study TheoryBase''s own characterization of this theory already cites as evidence, now linked here as an actual literature reference for the first time. Students who explored a concrete, agent-based simulation before the abstract rule transferred it to new situations better than students taught the abstraction alone -- the empirical case for actually grounding the claim that representational form changes learning outcomes, instead of merely asserting it.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-goldstone-wilensky-2008');

-- ============================================================================
-- Cluster 2: Core OpenEvo / Hanisch & Eirdosh (interdisciplinary-lpm-synth)
-- ============================================================================

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-hanisch-2021',
  'Causal Mapping as a Teaching Tool for Reflecting on Causation in Human Evolution',
  '["Hanisch, Susan","Eirdosh, Dustin"]'::jsonb, 2021, '10.1007/s11191-020-00157-z', 'Science & Education', 'article', 'accepted',
  'Core OpenEvo research behind this project''s own content: the primary source for Causal Mapping, the thinking tool this project''s strands use for reflecting on causation in human evolution, including the organism-level causal factors the decentralized-only framing excludes by design.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-hanisch-2021');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-hanisch-2023-metacognitive-competency',
  'Behavioral Science and Education for Sustainable Development: Towards Metacognitive Competency',
  '["Hanisch, Susan","Eirdosh, Dustin"]'::jsonb, 2023, '10.3390/su15097413', 'Sustainability', 'article', 'accepted',
  'Grounds this project''s "Integrated / Contextually Flexible Causal Reasoning (ICR/CFCR)" theory: Hanisch & Eirdosh''s metacognitive-competency framework gives contextual flexibility -- knowing when an agency framing is and isn''t the right lens -- its own research basis in behavioral science and sustainability education, the same competency this project''s theory claims is what''s actually worth building.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-hanisch-2023-metacognitive-competency');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-hanisch-eirdosh-morgan-2023',
  'Evolving cooperation and sustainability for common pool resources',
  '["Hanisch, Susan","Eirdosh, Dustin","Morgan, Thomas"]'::jsonb, 2023, '10.17617/2.3486776', 'Learning evolution through socioscientific issues', 'chapter', 'accepted',
  'Grounds this project''s "Interdisciplinary Evolutionary Literacy" theory: Hanisch, Eirdosh & Morgan''s own empirical application of evolutionary cooperation theory to real common-pool-resource governance is a direct instance of the cross-subject evolutionary thinking (biology to social and economic systems) this project''s theory claims genuine evolutionary literacy requires.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-hanisch-eirdosh-morgan-2023');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-eirdosh-hanisch-2023-community-science-model',
  'A Community Science Model for Inter-disciplinary Evolution Education and School Improvement',
  '["Eirdosh, Dustin","Hanisch, Susan"]'::jsonb, 2023, '10.1007/978-3-031-33358-3_7', 'Evolutionary Thinking Across Disciplines: Problems and Perspectives in Generalized Darwinism', 'chapter', 'accepted',
  'Core OpenEvo research behind this project''s own content: Eirdosh & Hanisch''s Community Science Model treats evolution-education curriculum design itself as a form of community science and school improvement, rather than content delivery alone -- the same stance this project''s own networked, researcher-collaborative platform instantiates.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-eirdosh-hanisch-2023-community-science-model');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-hanisch-2021-fair-not-same-everywhere',
  'What Is "Fair" Is Not the Same Everywhere',
  '["Hanisch, Susan","Eirdosh, Dustin","Schäfer, Marie","Haun, Daniel"]'::jsonb, 2021, '10.3389/frym.2021.580435', 'Frontiers for Young Minds', 'article', 'accepted',
  'Core OpenEvo research behind this project''s own content: Hanisch, Eirdosh, Schäfer & Haun''s finding that fairness judgments vary systematically across cultural contexts grounds this project''s cooperation/commons-governance content as genuinely cross-cultural, rather than assuming one culture''s intuitions generalize -- a concrete instance of the "three scales of diversity" caution against treating a community-shared regularity as a species-level universal.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-hanisch-2021-fair-not-same-everywhere');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-pillow-pearson-2015',
  'Children''s and adults'' judgments of the controllability of cognitive activities',
  '["Pillow, Bradford H.","Pearson, RaeAnne M."]'::jsonb, 2015, '10.1007/s11409-014-9122-2', 'Metacognition and Learning', 'article', 'accepted',
  'Direct companion to this project''s already-linked Pillow (2012) record, grounding the same metacognitive-development content: Pillow & Pearson''s finding that children''s and adults'' judgments of which cognitive activities are controllable develop over time and differ by activity is part of the same evidence base this project''s metacognition strand draws on.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-pillow-pearson-2015');

-- ============================================================================
-- Cluster 3: Nature of science (both projects)
-- ============================================================================

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT p.id, 'OE-LITERATURE-lederman-2002',
  'Views of nature of science questionnaire: Toward valid and meaningful assessment of learners'' conceptions of nature of science',
  '["Lederman, Norm G.","Abd-El-Khalick, Fouad","Bell, Randy L.","Schwartz, Renée S."]'::jsonb, 2002, '10.1002/tea.10034', 'Journal of Research in Science Teaching', 'article', 'accepted',
  'Grounds this project''s "Learning Progressions as Scientific Models" theory: Lederman et al.''s VNOS instrument is the field''s standard tool for assessing whether a learner''s own conception of science is adequate -- the same kind of validity question this project''s theory raises for a learning progression taken as a scientific model in its own right, beyond a convenient organizing device.'
FROM projects p WHERE p.slug IN ('bio-core-lpm-synth', 'interdisciplinary-lpm-synth')
  AND NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = p.id AND literaturebase_id = 'OE-LITERATURE-lederman-2002');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT p.id, 'OE-LITERATURE-erduran-dagher-2014',
  'Reconceptualizing the Nature of Science for Science Education: Scientific Knowledge, Practices and Other Family Categories',
  '["Erduran, Sibel","Dagher, Zoubeida R."]'::jsonb, 2014, '10.1007/978-94-017-9057-4', 'Contemporary Trends and Issues in Science Education', 'chapter', 'accepted',
  'Grounds this project''s "Learning Progressions as Scientific Models" theory, and directly bears on this project''s standing in the comparative study: Erduran & Dagher''s Family Resemblance Approach treats nature-of-science as a plural category defined across epistemic, cognitive and social-institutional dimensions, rather than a fixed checklist -- the same kind of account needed to ask, rather than assume, whether excluding or including organism agency is a defensible feature of a scientifically adequate causal explanation.'
FROM projects p WHERE p.slug IN ('bio-core-lpm-synth', 'interdisciplinary-lpm-synth')
  AND NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = p.id AND literaturebase_id = 'OE-LITERATURE-erduran-dagher-2014');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT p.id, 'OE-LITERATURE-kaya-erduran-2016',
  'From FRA to RFN, or How the Family Resemblance Approach Can Be Transformed for Science Curriculum Analysis on Nature of Science',
  '["Kaya, Ebru","Erduran, Sibel"]'::jsonb, 2016, '10.1007/s11191-016-9861-3', 'Science & Education', 'article', 'accepted',
  'Grounds this project''s "Learning Progressions as Scientific Models" theory: Kaya & Erduran''s RFN method for analyzing a curriculum''s implicit nature-of-science commitments is a direct, published precedent for what this comparative study itself does -- comparing Bio-Core''s and Interdisciplinary''s different framings of what counts as a scientifically adequate explanation of evolution.'
FROM projects p WHERE p.slug IN ('bio-core-lpm-synth', 'interdisciplinary-lpm-synth')
  AND NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = p.id AND literaturebase_id = 'OE-LITERATURE-kaya-erduran-2016');
