-- Links the two synthetic LPMs to real TheoryBase/LiteratureBase content --
-- the base-repo integration pattern already proven for evomentor-thuringia
-- (migrations 096/109, scripts/sync_theorybase_snapshot.mjs and
-- sync_literaturebase_snapshot.mjs), applied to bio-core-lpm-synth and
-- interdisciplinary-lpm-synth for the first time. Both snapshot caches
-- already contain every real record referenced below (confirmed live
-- 2026-10-20 before writing this), so no new sync run is needed.
--
-- These links aren't a stretch: bio-core-k12/oe-interdisciplinary-k12's own
-- source material already named the real dispute they instantiate --
-- strand-102's own content.disputeInstantiation field (092's seed) states
-- directly that bio-core-lpm-synth structurally instantiates the
-- Dichotomized Causal Reasoning (DCR) side of the real, published
-- Kampourakis/Nehm dispute, and interdisciplinary-lpm-synth is OpenEvo's
-- own native Integrated/Contextually-Flexible Causal Reasoning (ICR/CFCR)
-- counter-position. TheoryBase's own OE-THEORY-learning-progressions-as-
-- scientific-models record goes further: its own `scope` field names these
-- two LPMs by name as "this theory's real, reconciled instantiation."
-- These are the first local `theories` rows linking either project back to
-- its own real theoretical grounding.
--
-- evidentiary_maturity values are deliberately conservative, following
-- TheoryBase's own characterization text rather than upgrading anything:
-- DCR is grounded in two already-validated assessment instruments per its
-- own provenance note, so 'tested-against-alternatives'; ICR's own
-- assessment-tool paper (Hanisch et al. 2025) is itself the empirical
-- recovery step, with ICR's further domain-transfer claim explicitly named
-- in TheoryBase as "a research frontier... high-priority knowledge gap" --
-- not yet tested against alternatives, so 'empirically-recovered'. The
-- German Basiskonzept Didactics record is TheoryBase's own admitted
-- unsourced placeholder (provisional.blocked_on) -- carried over with no
-- evidentiary_maturity at all, honestly, rather than assigning one to a
-- record that doesn't have a confirmed primary source yet.
--
-- Idempotent: fixed ids throughout, ON CONFLICT DO NOTHING against each
-- table's primary key (literature_references' real (project_id, doi)
-- unique constraint from migration 138 doesn't catch the one NULL-doi row
-- below, since Postgres never treats two NULLs as conflicting -- the id
-- PK guard covers that case too) and, for theory_literature_links, its own
-- (theory_id, reference_id, relation_type) constraint.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_inter_project UUID;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';

  -- ==========================================================================
  -- Theories
  -- ==========================================================================

  INSERT INTO theories (id, project_id, label, description, evidentiary_maturity, evidentiary_maturity_note, base_repo, base_repo_ref)
  VALUES
  ('5fcfee96-9768-5fa8-a34b-635c354e84ec', v_bio_project,
   'Dichotomized Causal Reasoning (DCR)',
   'The Modern Synthesis explanatory structure (random heritable variation + differential reproduction through natural selection) is treated as complete and sufficient; organism agency is excluded from the explanatory structure to avoid reinforcing agential misconceptions. This is the real theoretical position bio-core-lpm-synth structurally instantiates -- its strands contain no organism-agency concepts by design, not as an instructional simplification. Reconstructed by OpenEvo from Kampourakis (2020) and Nehm & Kampourakis (2022); never confirmed by either author as their own authored characterization.',
   'tested-against-alternatives',
   'TheoryBase''s own audit notes DCR is grounded in two already-validated assessment instruments (KAEVO 2.0, ACORNS), stronger on this dimension than ICR''s own record at the time of that audit (2026-08-26).',
   'theorybase', 'OE-THEORY-dichotomized-causal-reasoning'),
  ('8d7964f4-6e52-5ddc-98de-5e67b2f62f2b', v_bio_project,
   'Evolution as a Multi-Year Learning Trajectory',
   'Evolution should be introduced early and revisited iteratively across the K-12 learning trajectory; the appropriate unit of curriculum design and analysis is the multi-year trajectory, not a bounded two-topic sequence within a single school year. bio-core-lpm-synth''s own K-12, grade-banded strand structure is a direct instantiation of this claim.',
   'theoretically-developed', NULL,
   'theorybase', 'OE-THEORY-evolution-trajectory-perspective'),
  ('e0ede4b4-4186-5da6-beeb-9e2854a965a2', v_bio_project,
   'Learning Progressions as Scientific Models',
   'Learning Progression Models are the right scientific-model format for curriculum, not merely a convenient organizing device -- functioning simultaneously as an explanatory model, a predictive model, a design tool, and a coordination mechanism. TheoryBase''s own record for this theory names bio-core-k12 and interdisciplinary-k12 directly as its real, reconciled instantiation.',
   'theoretically-developed', NULL,
   'theorybase', 'OE-THEORY-learning-progressions-as-scientific-models'),
  ('459b2041-e2b1-5fe3-b34a-3bfd379f68ca', v_bio_project,
   'German "Basiskonzept" Biology-Didactics Tradition (Kattmann/Gropengießer)',
   'The German biology-education tradition behind the KMK Bildungsstandards Biologie''s "Basiskonzept" framework. TheoryBase carries this record as a deliberate, honestly-unsourced placeholder (its own provisional.blocked_on: no Crossref-verified primary source for Kattmann/Gropengießer''s own published work has been located yet) -- linked here so the Sachsen/Thüringen custom view can show this real gap rather than citing only English-language OpenEvo research for German-curriculum content.',
   NULL, NULL,
   'theorybase', 'OE-THEORY-german-basiskonzept-didactics')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO theories (id, project_id, label, description, evidentiary_maturity, evidentiary_maturity_note, base_repo, base_repo_ref)
  VALUES
  ('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', v_inter_project,
   'Integrated / Contextually Flexible Causal Reasoning (ICR/CFCR)',
   'Agential intuitions are assets, not obstacles to be suppressed -- contextual flexibility (knowing when agency framing is and isn''t appropriate) is itself the competency worth building, across biological evolution, human evolution, cultural evolution, and machine-culture coevolution. This is OpenEvo''s own native position (Hanisch, Eirdosh, González Galli, Hartelt, Pérez & Cupo, 2025), and the real theoretical position interdisciplinary-lpm-synth instantiates.',
   'empirically-recovered',
   'Hanisch et al. (2025) is itself the empirical assessment-tool paper for this theory''s core agency-in-evolution claim. ICR''s further claim of transfer into non-evolution domains (collective action, AI capabilities) is explicitly named in TheoryBase as "a major open research question," not yet tested against alternatives.',
   'theorybase', 'OE-THEORY-integrated-causal-reasoning'),
  ('458390b8-4dff-5d20-aaa5-24e6fd2ab8b8', v_inter_project,
   'Interdisciplinary Evolutionary Literacy',
   'Genuine evolutionary literacy requires encountering evolutionary thinking across biology, social science, computer science, and the humanities -- a biological-only framing produces biological-only understanding, not evolutionary literacy as such. interdisciplinary-lpm-synth''s own cross-subject strand design (each strand tagged across two subject areas) is a direct instantiation of this claim.',
   'theoretically-developed', NULL,
   'theorybase', 'OE-THEORY-interdisciplinary-evolutionary-literacy'),
  ('8a8737c9-76a6-5e89-b553-6a8f708e4223', v_inter_project,
   'Learning Progressions as Scientific Models',
   'Learning Progression Models are the right scientific-model format for curriculum, not merely a convenient organizing device. TheoryBase''s own record for this theory names bio-core-k12 and interdisciplinary-k12 directly as its real, reconciled instantiation.',
   'theoretically-developed', NULL,
   'theorybase', 'OE-THEORY-learning-progressions-as-scientific-models'),
  ('754564f3-c0a4-5f23-8eed-f0c4e86fec6a', v_inter_project,
   'Restructuration Theory (Wilensky & Papert)',
   'Representational infrastructure changes what''s learnable: adopting a new representational form (e.g. agent-based/multi-agent computational modeling) can restructure decentralized and evolutionary causal reasoning specifically. Relevant to interdisciplinary-lpm-synth''s Culture, Technology, and Collective Systems strand and its own ICR transfer claim, which this theory is cited as partly grounding.',
   'empirically-recovered',
   'Real far-transfer empirical findings exist (Goldstone & Wilensky 2008; Tullis & Goldstone 2017) for restructuration generally, not yet tested specifically within this curriculum''s own content.',
   'theorybase', 'OE-THEORY-restructuration-theory'),
  ('2d97f80a-fc5f-5e54-8467-0e6780932a84', v_inter_project,
   'German "Basiskonzept" Biology-Didactics Tradition (Kattmann/Gropengießer)',
   'The German biology-education tradition behind the KMK Bildungsstandards Biologie''s "Basiskonzept" framework. Carried here as the same honestly-unsourced TheoryBase placeholder as bio-core-lpm-synth''s copy, for the same reason: so the Sachsen/Thüringen custom view can show this real gap rather than silently citing only English-language research.',
   NULL, NULL,
   'theorybase', 'OE-THEORY-german-basiskonzept-didactics')
  ON CONFLICT (id) DO NOTHING;

  -- ==========================================================================
  -- Literature references (checked live: already present in literaturebase_snapshot)
  -- ==========================================================================

  INSERT INTO literature_references (id, project_id, doi, title, authors, year, venue, type, literaturebase_id, status, submitted_by)
  VALUES
  ('d6743856-7cb4-5741-916b-db6f07453a17', v_bio_project, '10.1186/s12052-019-0116-z',
   'Students'' "teleological misconceptions" in evolution education: why the underlying design stance, not teleology per se, is the problem',
   '["Kampourakis, Kostas"]'::jsonb, 2020, 'Evolution: Education and Outreach', 'article',
   'OE-LITERATURE-kampourakis-2020', 'accepted', NULL),
  ('0c61ee5c-11e3-5926-a4d2-4b6fa495ab95', v_bio_project, NULL,
   'Evolution Education and Outreach — Important Things to Know About How to Teach About Evolution',
   '["Nehm, Ross", "Kampourakis, Kostas"]'::jsonb, 2022, NULL, 'chapter',
   'OE-LITERATURE-nehm-2022', 'accepted', NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO literature_references (id, project_id, doi, title, authors, year, venue, type, literaturebase_id, status, submitted_by)
  VALUES
  ('7c9bbe55-f90f-5243-8459-a9d3afa58ac0', v_inter_project, '10.1080/00219266.2025.2486963',
   'Understanding agency in evolutionary explanations: an assessment tool for biology education',
   '["Hanisch, Susan", "Eirdosh, Dustin", "González Galli, Leonardo", "Hartelt, Tim", "Pérez, Gastón", "Cupo, Betina"]'::jsonb,
   2025, 'Journal of Biological Education', 'article',
   'OE-LITERATURE-hanisch-2025', 'accepted', NULL),
  ('b74c51b3-bea6-5b31-aa2b-9e22e4007f43', v_inter_project, '10.1007/978-3-031-33358-3_8',
   'Teaching for the Interdisciplinary Understanding of Evolutionary Concepts',
   '["Hanisch, Susan", "Eirdosh, Dustin"]'::jsonb, 2023, 'Synthese Library', 'chapter',
   'OE-LITERATURE-hanisch-2023', 'accepted', NULL),
  ('32080cfc-1ece-54be-8656-76af3cfad96d', v_inter_project, '10.1007/978-1-4614-2248-8',
   'Children''s Discovery of the Active Mind: Phenomenological Awareness, Social Experience, and Knowledge about Cognition',
   '["Pillow, Bradford H."]'::jsonb, 2012, 'SpringerBriefs in Psychology', 'book',
   'OE-LITERATURE-pillow-2012', 'accepted', NULL),
  ('66c2ec19-f1f5-528b-9a7f-ffc50cc05981', v_inter_project, '10.1111/tops.12703',
   'Local Search and the Evolution of World Models',
   '["Bramley, Neil R.", "Zhao, Bonan", "Quillien, Tadeg", "Lucas, Christopher G."]'::jsonb,
   2023, 'Topics in Cognitive Science', 'article',
   'OE-LITERATURE-bramley-2023', 'accepted', NULL),
  ('be60f35a-f442-5ae2-bf6a-27d07651b32d', v_inter_project, '10.1038/s41562-023-01742-2',
   'Machine culture',
   '["Brinkmann, Levin", "Baumann, Fabian", "Bonnefon, Jean-François", "Derex, Maxime", "Müller, Thomas F.", "Nussberger, Anne-Marie"]'::jsonb,
   2023, 'Nature Human Behaviour', 'article',
   'OE-LITERATURE-brinkmann-2023', 'accepted', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- ==========================================================================
  -- Theory <-> literature links (theory's own real primary sources, per
  -- TheoryBase's primarySources field -- 'theoretical-clarification' since
  -- these define/characterize the position, not just support it empirically)
  -- ==========================================================================

  INSERT INTO theory_literature_links (theory_id, reference_id, relation_type, note)
  VALUES
  ('5fcfee96-9768-5fa8-a34b-635c354e84ec', 'd6743856-7cb4-5741-916b-db6f07453a17', 'theoretical-clarification', 'Primary source for DCR per TheoryBase.'),
  ('5fcfee96-9768-5fa8-a34b-635c354e84ec', '0c61ee5c-11e3-5926-a4d2-4b6fa495ab95', 'theoretical-clarification', 'Primary source for DCR per TheoryBase.'),
  ('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', '7c9bbe55-f90f-5243-8459-a9d3afa58ac0', 'theoretical-clarification', 'Primary source for ICR per TheoryBase; also its own empirical-recovery instrument.'),
  ('9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b', 'b74c51b3-bea6-5b31-aa2b-9e22e4007f43', 'theoretical-clarification', 'Primary source for ICR per TheoryBase.')
  ON CONFLICT (theory_id, reference_id, relation_type) DO NOTHING;

END $MIGRATION$;
