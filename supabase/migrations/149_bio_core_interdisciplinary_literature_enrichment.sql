-- Real feedback (2026-10-20): "look over the core LPM data for the two
-- focal synthetic LPM spaces and enrich the core OpenLPM researcher view
-- data... maybe do a deeper dive into relevant literature from our
-- LiteratureBase." Before this, bio-core-lpm-synth and interdisciplinary-
-- lpm-synth had 2 and 5 literature_references rows respectively, and
-- their 9 theories (4 + 5) had zero literature grounding of any kind.
-- LiteratureBase's own clone already had the right records -- Corcoran,
-- Petrosino, Nehm, Gregory, Castro-Faix for Bio-Core's Dichotomized
-- Causal Reasoning / multi-year-trajectory / learning-progression
-- theories; Odling-Smee, Ariew & Panchanathan, Sultan, Mesoudi, Aslan &
-- Wilensky for Interdisciplinary's ICR / restructuration / interdisciplinary-
-- literacy theories -- several already cross-referenced to these exact
-- theories in LiteratureBase's own prior curation notes.
--
-- theory_relations.target_type is CHECK-constrained to
-- (theory, schema_element, thread) -- it does not accept a literature
-- reference as a target without a constraint change, which this migration
-- does not attempt. The grounding rationale for each row below instead
-- lives in literature_references.notes (free text, no schema change),
-- naming which theory it grounds and why.
--
-- literature_references.type is CHECK-constrained to
-- (article, chapter, book, report) -- narrower than LiteratureBase's own
-- vocabulary (journal-article, conference-paper, book-chapter, book,
-- report), mapped accordingly below; a conference paper has no close
-- match and is left null rather than guessed.

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-duncan-rivet-2013',
  'Science Learning Progressions', '["Duncan, Ravit Golan","Rivet, Ann E."]'::jsonb, 2013, '10.1126/science.1228692', 'Science', 'article', 'accepted',
  'Grounds this project''s "Learning Progressions as Scientific Models" theory: Duncan & Rivet''s Science policy-forum piece is the general, cross-topic source for what a learning progression is and why it should guide curriculum sequencing -- the literature basis for treating this LPM''s K-12, grade-banded strand structure as an instance of a learning progression rather than an arbitrary grade-by-grade list.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-duncan-rivet-2013');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-corcoran-2009',
  'Learning Progressions in Science: An Evidence-based Approach to Reform', '["Corcoran, Tom","Mosher, Frederic","Rogat, Aaron"]'::jsonb, 2009, '10.12698/cpre.2009.rr63', NULL, 'report', 'accepted',
  'Grounds this project''s "Learning Progressions as Scientific Models" theory: Corcoran, Mosher & Rogat''s CPRE report is the field''s foundational statement of what distinguishes an evidence-based learning progression from a theoretically-plausible one -- the epistemic standard behind this project''s own theory that learning progressions are scientific models in their own right, going beyond a convenient organizing device.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-corcoran-2009');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-petrosino-lucero-mann-2015',
  'Decentralized thinking and understanding of evolution in K-12 evolution education', '["Petrosino, Anthony J.","Lucero, Margaret M.","Mann, Michele J."]'::jsonb, 2015, '10.1186/s12052-014-0028-x', 'Evolution: Education and Outreach', 'article', 'accepted',
  'Grounds this project''s "Dichotomized Causal Reasoning (DCR)" theory: Petrosino, Lucero & Mann identify decentralized thinking as one of five elements critical to understanding evolution, alongside variation, selection, inheritance and deep time -- published evolution-education-specific grounding for the same decentralized framing this strand structurally commits to.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-petrosino-lucero-mann-2015');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-nehm-2012',
  'Reasoning About Natural Selection: Diagnosing Contextual Competency Using the ACORNS Instrument', '["Nehm, Ross H.","Beggrow, Elizabeth P.","Opfer, John E.","Ha, Minsu"]'::jsonb, 2012, '10.1525/abt.2012.74.2.6', 'The American Biology Teacher', 'article', 'accepted',
  'Grounds this project''s "Dichotomized Causal Reasoning (DCR)" theory: Nehm, Beggrow, Opfer & Ha''s ACORNS instrument diagnoses natural-selection reasoning using the same decentralized, mechanism-based framing KAEVO 2.0 (this strand''s own assessment lineage) builds on.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-nehm-2012');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-gregory-2009',
  'Understanding Natural Selection: Essential Concepts and Common Misconceptions', '["Gregory, T. Ryan"]'::jsonb, 2009, '10.1007/s12052-009-0128-1', 'Evolution: Education and Outreach', 'article', 'accepted',
  'Grounds this project''s "Dichotomized Causal Reasoning (DCR)" theory: Gregory catalogs the specific misconceptions (organisms changing because they ''need'' to, evolution having a goal, individual adaptation within a lifetime) that a decentralized, mechanism-only framing is explicitly designed to avoid reinforcing.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-gregory-2009');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-castro-faix-2021',
  'Data-driven refinements of a genetics learning progression', '["Castro-Faix, Moraima","Duncan, Ravit Golan","Choi, Jinnie"]'::jsonb, 2021, '10.1002/tea.21631', 'Journal of Research in Science Teaching', 'article', 'accepted',
  'Grounds this project''s "Evolution as a Multi-Year Learning Trajectory" theory: Castro-Faix, Duncan & Choi refine a genetics learning progression using student-response data rather than theory alone -- the kind of empirical validation this project''s own theory (evolution as a multi-year trajectory rather than a bounded unit) would need to move from design principle to tested progression.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-castro-faix-2021');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-duncan-rivet-2013',
  'Science Learning Progressions', '["Duncan, Ravit Golan","Rivet, Ann E."]'::jsonb, 2013, '10.1126/science.1228692', 'Science', 'article', 'accepted',
  'Grounds this project''s "Learning Progressions as Scientific Models" theory: Duncan & Rivet''s Science policy-forum piece is the general, cross-topic source for what a learning progression is -- the same literature basis this LPM''s own cross-subject strand structure draws on for treating itself as a learning progression rather than an arbitrary topic list.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-duncan-rivet-2013');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-aslan-wilensky-2016',
  'Restructuration in Practice: Challenging a Pop-Culture Evolutionary Theory through Agent Based Modeling', '["Aslan, Ümit","Wilensky, Uri"]'::jsonb, 2016, NULL, 'Proceedings of the Constructionism 2016 Conference', NULL, 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory: Aslan & Wilensky use an agent-based NetLogo model of anisogamy evolution to restructure a specific pop-culture misconception about sexual selection -- a direct, applied evolution-education instance of the general claim that representational infrastructure changes what''s learnable, the closest published precedent for what this project''s own theory asks for.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-aslan-wilensky-2016');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-odling-smee-2003',
  'Niche Construction: The Neglected Process in Evolution', '["Odling-Smee, F. John","Laland, Kevin N.","Feldman, Marcus W."]'::jsonb, 2003, NULL, NULL, 'book', 'accepted',
  'Grounds this project''s "Integrated / Contextually Flexible Causal Reasoning (ICR/CFCR)" theory: Odling-Smee, Laland & Feldman''s book is the field''s foundational treatment of niche construction as an evolutionary process in its own right -- the literature this project''s own theory''s niche-selection/niche-construction language is grounded in.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-odling-smee-2003');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-ariew-panchanathan-2023',
  'Adding Agency to Tinbergen''s Four Questions', '["Ariew, André","Panchanathan, Karthik"]'::jsonb, 2023, '10.1007/978-3-031-33358-3_21', 'Evolutionary Thinking Across Disciplines: Problems and Perspectives in Generalized Darwinism', 'chapter', 'accepted',
  'Grounds this project''s "Integrated / Contextually Flexible Causal Reasoning (ICR/CFCR)" theory: Ariew & Panchanathan argue for extending Tinbergen''s four questions to include organism goals and agency as a further consideration -- philosophical grounding for this project''s own theory that organism agency is a legitimate causal factor rather than an instructional add-on.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-ariew-panchanathan-2023');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-sultan-2022',
  'Bridging the explanatory gaps: What can we learn from a biological agency perspective?', '["Sultan, Sonia E.","Moczek, Armin P.","Walsh, Denis"]'::jsonb, 2022, '10.1002/bies.202100185', 'BioEssays', 'article', 'accepted',
  'Grounds this project''s "Integrated / Contextually Flexible Causal Reasoning (ICR/CFCR)" theory: Sultan, Moczek & Walsh ask whether a concept of biological agency can bridge the gap between organism-level developmental responsiveness and population-level selection explanations -- the same bridging move this project''s own theory''s contextual-flexibility claim makes.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-sultan-2022');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-mesoudi-2011',
  'Cultural evolution', '["Mesoudi, Alex"]'::jsonb, 2011, NULL, NULL, 'book', 'accepted',
  'Grounds this project''s "Interdisciplinary Evolutionary Literacy" theory: Mesoudi''s book treats cultural change itself as an evolutionary process, read through variation, selection and transmission -- a direct example of the cross-subject evolutionary thinking this project''s own theory claims genuine evolutionary literacy requires.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-mesoudi-2011');
