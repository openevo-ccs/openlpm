-- Hanisch & Eirdosh (2023), "Developing Teacher Competencies for Teaching
-- Evolution across the Primary School Curriculum" (Education Sciences,
-- 13(8):797, OE-LITERATURE-hanisch-eirdosh-2023-primary-teacher-competencies,
-- literaturebase PR #11, merged) -- formalized against both synthetic LPMs,
-- plus a new, genuinely missing concept: a real, storable, evolving guided
-- tour for Open Universe's LPM Universe.
--
-- Two separate things, following this repo's own established conventions
-- rather than inventing parallel ones:
--
-- 1. The paper itself. lab_manager's own close-read design note
--    (docs/design-notes/hanisch-eirdosh-2023-bio-core-interdisciplinary-lpm-
--    comparative-analysis-2026-10-23.md) maps specific paper methods onto
--    specific substrands in both projects. That's exactly what
--    evidence_links (migration 066) already exists for -- reused here, not
--    duplicated, the same way migration 166 added a comparative-literature
--    link rather than inventing a new link table. Confirmed live
--    2026-10-23: this record was not yet linked to a single concept, topic,
--    or theory anywhere in the live database before this migration.
--
-- 2. The tour. Nothing in this schema stores an ordered, authored sequence
--    of camera moves + narration today -- Open Universe's existing "tours"
--    are a canned question into the live chat pipeline, regenerated fresh
--    every time, with no stored, steppable structure. A real guided tour
--    needs its own home. Deliberately NOT routed through
--    literature_dispute_flags/discussion_topics: those exist for
--    disagreement *about a paper's claims* (migration 166's own comment:
--    "not something this app should auto-generate entries into"), not for
--    an authored walkthrough of a comparison. Live visitor questions/ideas/
--    commentary *about the tour itself* get their own lightweight table
--    (universe_tour_notes) with the same "capture here, a human promotes it
--    into the real mechanism if it rises to that" shape literature_dispute_
--    flags already established -- hence the optional
--    promoted_to_literature_dispute_flag_id link rather than a second,
--    competing way to raise a real scholarly dispute.

SET search_path = public, extensions;

-- ============================================================
-- Part 1: the paper, linked for real
-- ============================================================

INSERT INTO literature_references (id, project_id, literaturebase_id, title, authors, year, doi, venue, status, notes)
SELECT '2814204e-6038-4d2f-92d9-181dae7516df', '28997544-0d87-4b05-9ee2-7c474513c108',
  'OE-LITERATURE-hanisch-eirdosh-2023-primary-teacher-competencies',
  'Developing Teacher Competencies for Teaching Evolution across the Primary School Curriculum',
  '["Hanisch, Susan","Eirdosh, Dustin"]'::jsonb,
  2023, '10.3390/educsci13080797', 'Education Sciences', 'accepted',
  'A semester-long pre-service-teacher course, tested across two runs with 36 participants. Read against Bio-Core specifically: the paper''s own "what is it for vs. how did it come about" method for natural selection is an independent, agency-free instance of exactly the move Bio-Core''s Strand 2 is structurally built around (see that strand''s own disputeInstantiation field) -- it validates Bio-Core''s strictest constraint on the constraint''s own terms. The same paper also surfaces three things Bio-Core''s vocabulary has no way to state at all: a primary-grade bridge to geographic isolation (no K-2/3-5 substrand builds toward Speciation and Diversity''s 6-8 jump), sexual selection, and evolutionary mismatch. Full mapping: lab_manager/docs/design-notes/hanisch-eirdosh-2023-bio-core-interdisciplinary-lpm-comparative-analysis-2026-10-23.md. Record''s own provenance.review_status is author-draft. It has not yet been expert-reviewed -- treat accordingly.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-hanisch-eirdosh-2023-primary-teacher-competencies');

INSERT INTO literature_references (id, project_id, literaturebase_id, title, authors, year, doi, venue, status, notes)
SELECT '8bad22cb-0f0d-4702-9870-b6a76b314336', '371fce26-d1f3-439b-95df-0a0e38b8a824',
  'OE-LITERATURE-hanisch-eirdosh-2023-primary-teacher-competencies',
  'Developing Teacher Competencies for Teaching Evolution across the Primary School Curriculum',
  '["Hanisch, Susan","Eirdosh, Dustin"]'::jsonb,
  2023, '10.3390/educsci13080797', 'Education Sciences', 'accepted',
  'A semester-long pre-service-teacher course, tested across two runs with 36 participants. Read against Interdisciplinary specifically: several of the paper''s own cross-curricular methods (iterative paper-airplane "generations," a wordless artifact-recreation game, a stone-age cooperative-hunt game) map directly onto substrands that already name a performance indicator and a concept list but no concrete activity. The paper''s single most-argued-for idea, evolutionary mismatch, has no home in this vocabulary either -- closest existing neighbors are Agency and Development, an approximate match rather than an exact one. Full mapping: lab_manager/docs/design-notes/hanisch-eirdosh-2023-bio-core-interdisciplinary-lpm-comparative-analysis-2026-10-23.md. Record''s own provenance.review_status is author-draft. It has not yet been expert-reviewed -- treat accordingly.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-hanisch-eirdosh-2023-primary-teacher-competencies');

-- Bio-Core: direct, no-modification-needed method-to-substrand fits (design
-- note sections 1-2). relevance_score follows the note's own "Direct" /
-- "but see gap" / "flagged with the paper's own asterisk" language.
INSERT INTO evidence_links (target_type, target_id, reference_id, evidence_type, relevance_score, notes)
SELECT 'data_object', dobj.id, '2814204e-6038-4d2f-92d9-181dae7516df', vals.evidence_type, vals.relevance_score, vals.notes
FROM (VALUES
  ('4f1b4d5d-6232-5ef5-b44c-a850224b58a5'::uuid, 'supports', 5,
   'Paper''s Table 1 ("simulation games" for drift/founder effect; picture books, role-play, domesticated-animal examples, computer models for the four components; "what is it for vs. how did it come about" framing) gives this substrand concrete activities for performance indicators that currently name none.'),
  ('ca152c60-d9a5-509f-afdb-e2e7bdf983b4'::uuid, 'supports', 4,
   'Paper''s island-separation story method is a primary-appropriate way to build the isolation intuition this substrand''s mechanism needs -- but see the K-2/3-5 gap this same mapping exposes (no bridging substrand exists yet).'),
  ('8e62e70a-437d-540d-83f6-90a0fe54783a'::uuid, 'supports', 4,
   'Paper''s within-species-variation/essentialism activities (documenting trait variation in class and other species) match this substrand''s own concept and grade band directly.'),
  ('70cf40f5-cb5d-508a-95dc-d18eaa465e94'::uuid, 'supports', 4,
   'Paper''s inheritance activities (family resemblance, seed-saving) fit this substrand directly.'),
  ('a4cd9b9e-d3a1-52bd-b76f-eb6173ab7259'::uuid, 'supports', 4,
   'Paper''s "family tree first, then generalize to evolutionary trees" sequencing is a concrete instructional strategy for a performance indicator this substrand currently states but names no activity for.'),
  ('76c205d2-33d4-5532-ba5a-cab715380b5e'::uuid, 'contextualizes', 3,
   'Paper''s deep-time/fossil/dinosaur activities fit this substrand''s concepts, but the paper''s own Table 1 flags most of this theme with an asterisk: no classroom-effectiveness evidence available yet. Carry that caveat forward with the activity.')
) AS vals(data_object_id, evidence_type, relevance_score, notes)
JOIN lpm_data_objects dobj ON dobj.id = vals.data_object_id
WHERE NOT EXISTS (
  SELECT 1 FROM evidence_links el WHERE el.target_type = 'data_object' AND el.target_id = dobj.id AND el.reference_id = '2814204e-6038-4d2f-92d9-181dae7516df'
);

-- Interdisciplinary: Table 2 methods filling substrands that name a
-- performance indicator and concepts but no activity (design note section 4).
INSERT INTO evidence_links (target_type, target_id, reference_id, evidence_type, relevance_score, notes)
SELECT 'data_object', dobj.id, '8bad22cb-0f0d-4702-9870-b6a76b314336', vals.evidence_type, vals.relevance_score, vals.notes
FROM (VALUES
  ('6315aad7-35b7-52dc-9dd2-1b82d707a768'::uuid, 'supports', 5,
   'Substrand already asks for "one cultural case" of variation/selection/transmission; the paper''s iterative paper-airplane-design activity is a more concrete, more physically manipulable, younger-band-workable version of exactly that case.'),
  ('31b2be29-7a8c-5f98-a447-55ecf57f1ff9'::uuid, 'supports', 5,
   'Close match: substrand''s performance indicators ask students to describe an animal or person learning by watching, and a simple example of scaffolding. The paper''s wordless artifact-recreation game (origami/knot/recipe, no teacher, no language) makes the absence of teaching/scaffolding viscerally obvious.'),
  ('a1bc92d8-3730-53b8-a059-f3999e4387cf'::uuid, 'supports', 5,
   'Substrand names Cooperation as a reinforcing concept with no activity attached. The paper''s stone-age collective-hunt game is complete and built on real game-theoretic models (stag hunt, public-goods game).')
) AS vals(data_object_id, evidence_type, relevance_score, notes)
JOIN lpm_data_objects dobj ON dobj.id = vals.data_object_id
WHERE NOT EXISTS (
  SELECT 1 FROM evidence_links el WHERE el.target_type = 'data_object' AND el.target_id = dobj.id AND el.reference_id = '8bad22cb-0f0d-4702-9870-b6a76b314336'
);

-- ============================================================
-- Part 2: storable, evolving Open Universe tours
-- ============================================================

CREATE TABLE IF NOT EXISTS universe_tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT,
  -- Open vocabulary, same convention as project_dashboard_views.kind --
  -- a new lifecycle state never needs its own migration.
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A tour can be about more than one project at once (this one is about
-- both synthetic LPMs) -- many-to-many rather than a single project_id,
-- same shape lpm_comparative_links already assumes is normal.
CREATE TABLE IF NOT EXISTS universe_tour_projects (
  tour_id UUID NOT NULL REFERENCES universe_tours(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (tour_id, project_id)
);

CREATE TABLE IF NOT EXISTS universe_tour_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES universe_tours(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  -- Pre-authored narration, reviewed once and replayed identically for
  -- every visitor -- not regenerated per-turn, so it isn't bound by the
  -- live chat agent's ~90-word answer cap.
  narration TEXT NOT NULL,
  -- Open vocabulary (narrative/paper/gap/equity/...), same reasoning as
  -- universe_tours.status being a closed CHECK but this being open TEXT:
  -- the tour's lifecycle is a small fixed set, but the kinds of stops a
  -- future tour might need are not.
  stop_kind TEXT NOT NULL DEFAULT 'narrative',
  -- Camera moves, in the engine's own existing validated shape
  -- (open-universe/agents/shots.py: type focus|dive|surface|lens, ids,
  -- reason) so stored tours play back through the exact same Sequencer
  -- live-generated ones already use. ids here are real OpenLPM
  -- lpm_data_objects ids (or the new literature node's own "lit:<id>"
  -- form) -- the exporter maps these to world.json node ids at export
  -- time, not stored pre-mapped, so this table stays correct even if the
  -- world.json id scheme ever changes.
  shots JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- What real data backs this stop's claims -- never a stop asserting
  -- something with nothing underneath it. Open-shaped objects
  -- ({"kind":"data_object"|"literature_reference"|"divergence"|
  -- "dispute_tradeoff"|"conceptbase_concept", "id":...}), deliberately not
  -- foreign keys, same reasoning as literature_dispute_flags.target_description.
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- TRUE marks a stop showing a "proposed, not real yet" sketch (a gap the
  -- source material surfaces, with a hypothetical fix) rather than
  -- existing content. The frontend must render this visibly differently
  -- every time -- never let a sketch look like it's already live.
  is_proposed_sketch BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tour_id, position)
);

-- "Evolve live through questions, ideas, and commentaries" -- a visitor's
-- (or Dustin's, or Me-Mo's) running annotation on a tour or one specific
-- stop. Deliberately lightweight: a real scholarly disagreement about a
-- paper's claims still routes through literature_dispute_flags (decision 3,
-- lab_manager/docs/design-notes/openlpm-literature-collections-and-
-- analytics-strategy-2026-10-23.md) -- this table is for the tour
-- experience itself, with an explicit promotion path into that real
-- mechanism rather than becoming a second, competing way to raise one.
CREATE TABLE IF NOT EXISTS universe_tour_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID NOT NULL REFERENCES universe_tours(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES universe_tour_stops(id) ON DELETE CASCADE,
  -- Open vocabulary -- question/idea/commentary/correction today, more
  -- kinds later need no migration.
  kind TEXT NOT NULL DEFAULT 'idea',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'addressed', 'promoted', 'dismissed')),
  promoted_to_literature_dispute_flag_id UUID REFERENCES literature_dispute_flags(id) ON DELETE SET NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universe_tour_stops_tour ON universe_tour_stops(tour_id, position);
CREATE INDEX IF NOT EXISTS idx_universe_tour_notes_tour ON universe_tour_notes(tour_id);
CREATE INDEX IF NOT EXISTS idx_universe_tour_notes_stop ON universe_tour_notes(stop_id);

ALTER TABLE universe_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_tour_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_tour_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_tour_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_universe_tour_member(p_tour_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM universe_tour_projects utp
    WHERE utp.tour_id = p_tour_id AND is_project_member(utp.project_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE POLICY "Project members can view tours" ON universe_tours
  FOR SELECT USING (is_universe_tour_member(id));
CREATE POLICY "Project members can view tour project links" ON universe_tour_projects
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can view tour stops" ON universe_tour_stops
  FOR SELECT USING (is_universe_tour_member(tour_id));
CREATE POLICY "Project members can view tour notes" ON universe_tour_notes
  FOR SELECT USING (is_universe_tour_member(tour_id));
CREATE POLICY "Project members can raise a tour note" ON universe_tour_notes
  FOR INSERT WITH CHECK (is_universe_tour_member(tour_id));
CREATE POLICY "Project members can update their project's tour notes" ON universe_tour_notes
  FOR UPDATE USING (is_universe_tour_member(tour_id)) WITH CHECK (is_universe_tour_member(tour_id));

CREATE TRIGGER update_universe_tours_updated_at BEFORE UPDATE ON universe_tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_universe_tour_stops_updated_at BEFORE UPDATE ON universe_tour_stops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_universe_tour_notes_updated_at BEFORE UPDATE ON universe_tour_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.

-- ============================================================
-- Part 3: the actual tour, seeded
-- ============================================================

INSERT INTO universe_tours (id, slug, title, subtitle, summary, status)
SELECT '5a1e1f0a-6e8c-4b9a-9c1d-0f2b7a9e3c41', 'bio-core-blind-spots-hanisch-eirdosh-2023',
  'Two Rulebooks, One Idea',
  'What a 2023 teacher-training study reveals about Bio-Core''s limits, next to Interdisciplinary''s own openings',
  'A twelve-stop guided tour through the shared Bio-Core / Interdisciplinary comparison space, following Hanisch & Eirdosh (2023) stop by stop: where its methods confirm Bio-Core''s strictest rule, how each curriculum''s own structure behaves under computed analysis, how the Kampourakis dispute''s five contested cases split (some fully shared, some fully contested), where that same rule runs out of room, where the wider Interdisciplinary vocabulary opens back up, and one honest, unresolved finding neither curriculum has faced yet.',
  'published'
WHERE NOT EXISTS (SELECT 1 FROM universe_tours WHERE slug = 'bio-core-blind-spots-hanisch-eirdosh-2023');

INSERT INTO universe_tour_projects (tour_id, project_id)
SELECT '5a1e1f0a-6e8c-4b9a-9c1d-0f2b7a9e3c41', p.id
FROM (VALUES ('28997544-0d87-4b05-9ee2-7c474513c108'::uuid), ('371fce26-d1f3-439b-95df-0a0e38b8a824'::uuid)) AS p(id)
WHERE NOT EXISTS (
  SELECT 1 FROM universe_tour_projects WHERE tour_id = '5a1e1f0a-6e8c-4b9a-9c1d-0f2b7a9e3c41' AND project_id = p.id
);

INSERT INTO universe_tour_stops (tour_id, position, title, narration, stop_kind, shots, citations, is_proposed_sketch)
SELECT '5a1e1f0a-6e8c-4b9a-9c1d-0f2b7a9e3c41', vals.position, vals.title, vals.narration, vals.stop_kind, vals.shots::jsonb, vals.citations::jsonb, vals.is_proposed_sketch
FROM (VALUES
  (1, 'Two Rulebooks, One Idea',
   'Two complete K-12 learning paths sit in this shared space. One, Bio-Core, only ever talks about evolution using genes, populations, and selection pressure, on purpose, as a clean test of how far that strict vocabulary can go. The other, Interdisciplinary, deliberately allows a wider vocabulary: agency, culture, learning, cooperation. Neither is a finished, ready-to-teach curriculum. Both are a controlled comparison, built to find out what each set of rules costs and buys. This tour follows one peer-reviewed 2023 study, a teacher-training course tested with 36 trainee teachers, through both rulebooks, to see exactly where each one''s own constraints show.',
   'narrative',
   '[{"type":"surface","reason":"Open on both curricula at once"},{"type":"focus","ids":["d1b088f7-a940-5d5e-a5bc-45c0a049d351","408a667a-93d5-58a1-bb50-f8e6606b9745"],"reason":"The two strands that formally instantiate this dispute"}]',
   '[{"kind":"data_object","id":"d1b088f7-a940-5d5e-a5bc-45c0a049d351"},{"kind":"data_object","id":"408a667a-93d5-58a1-bb50-f8e6606b9745"},{"kind":"divergence","id":"OE-DIVERGENCE-role-of-organism-agency"}]',
   false),

  (2, 'The Paper Itself',
   'This is Hanisch and Eirdosh''s 2023 study in Education Sciences: a semester-long course that teaches future primary-school teachers how to bring evolution into subjects far beyond biology class, story time, art, PE, social studies. It isn''t a finished textbook and it hasn''t been checked yet by anyone outside its own authors. Across two course runs, 36 pre-service teachers became more willing and able to teach evolutionary ideas across these different subjects. Every stop on this tour traces one of this paper''s own classroom methods against what these two curricula already allow themselves to say.',
   'paper',
   '[{"type":"focus","ids":["lit:OE-LITERATURE-hanisch-eirdosh-2023-primary-teacher-competencies"],"reason":"The paper''s own place in the shared space"}]',
   '[{"kind":"literature_reference","id":"2814204e-6038-4d2f-92d9-181dae7516df"},{"kind":"literature_reference","id":"8bad22cb-0f0d-4702-9870-b6a76b314336"}]',
   false),

  (3, 'Where the Rule and the Study Agree',
   'Bio-Core''s rule here is strict: no talk of what an organism wants or needs, ever, only what varied, what got inherited, and what survived. The paper''s own method for teaching the exact same topic splits one question into two without ever mentioning this rule: what is a trait for, versus how did it come about. That is the same move, arrived at independently. A peer-reviewed study backs up Bio-Core''s strictest constraint on its own terms, before this tour starts looking at where that same strictness runs out of room.',
   'narrative',
   '[{"type":"focus","ids":["4f1b4d5d-6232-5ef5-b44c-a850224b58a5"],"reason":"The Four-Component Natural Selection substrand"},{"type":"dive","reason":"Move in close on the substrand and its evidence"}]',
   '[{"kind":"data_object","id":"4f1b4d5d-6232-5ef5-b44c-a850224b58a5"},{"kind":"literature_reference","id":"2814204e-6038-4d2f-92d9-181dae7516df"},{"kind":"divergence","id":"OE-DIVERGENCE-role-of-organism-agency"}]',
   false),

  (4, 'The Same Word, Two Different Jobs',
   'Before touring the specific disagreements, it helps to see how each curriculum is built, structurally, beyond just what it says about itself. Running network analysis across the full combined map: in Bio-Core, one concept towers over every other by co-occurrence. Natural Selection links to twelve other ideas there, holding more than two-thirds of the connection share among its own top ten concepts, a hub-and-spoke shape with one dominant idea and everything else orbiting it. In Interdisciplinary, the concept called simply Selection is just as densely linked, eighteen connections, the single busiest concept anywhere in the combined map. But it does not dominate the same way: Interdisciplinary''s overall most-central idea, by a different measure called PageRank, turns out to be Analogical Reasoning. The same root idea plays a concentrated, singular role in one curriculum''s own structure, and a well-connected but non-dominant role in the other''s. Neither curriculum claims this about itself. It is what their own structure shows.',
   'analysis',
   '[{"type":"focus","ids":["4f1b4d5d-6232-5ef5-b44c-a850224b58a5","408a667a-93d5-58a1-bb50-f8e6606b9745"],"reason":"The two strands these structural roles orbit"},{"type":"lens","lens":"strand","reason":"Show each curriculum''s own structural shape"}]',
   '[{"kind":"computed_analysis","label":"Co-occurrence degree + PageRank, run 2026-10-23 against the live comparison world","note":"Natural Selection: 12 co-occurrence links, 67.5% of its top-10 share, in Bio-Core alone (86 nodes, 140 edges). Selection: 18 co-occurrence links, the busiest concept in the whole 214-node map, in Interdisciplinary alone (127 nodes, 200 edges). Whole-map PageRank leader: Analogical Reasoning (0.0444). Bio-Core-alone PageRank leader: Species (0.103). Interdisciplinary-alone PageRank leader: Analogical Reasoning (0.074)."}]',
   false),

  (5, 'Not Every Case Splits the Same Way',
   'This disagreement does not split cleanly or uniformly. The dispute graph behind these two curricula checks both frameworks against five concrete cases, and they land differently on each one. Polar bear fur thickness comes back fully shared: both sides agree on how to explain it, with no tension at all. Bird wings compared to airplane wings, Bio-Core''s own favorite illustration of where organisms end and designed artifacts begin, comes back only partially shared. Bio-Core treats that comparison as a clean, pedagogically productive dichotomy. Interdisciplinary treats it as a useful first approximation that stops being true once an organism''s own agential contributions to its own evolutionary trajectory enter the picture. Where disagreement exists here, it comes in degrees.',
   'narrative',
   '[{"type":"focus","ids":["4f1b4d5d-6232-5ef5-b44c-a850224b58a5","a1bc92d8-3730-53b8-a059-f3999e4387cf"],"reason":"The substrands where this organism-vs-artifact comparison actually lives"},{"type":"lens","lens":"checked","reason":"Show where the two frameworks already agree"}]',
   '[{"kind":"divergence","id":"OE-DIVERGENCE-organism-artifact-dichotomy-vs-gradient"},{"kind":"dispute_contested_case","id":"bird-wings-vs-airplane-wings"},{"kind":"dispute_contested_case","id":"polar-bear-fur-thickness"}]',
   false),

  (6, 'Where the Disagreement Is Sharpest',
   'Three of the five cases come back fully contested: the cheetah''s running speed, already seen; a giraffe''s long neck; and how humans came to walk upright on two legs. Each is a case where Bio-Core''s own assessment instrument and Interdisciplinary''s own assessment instrument would score the identical student explanation differently. Neither grading key is careless. Each is enforcing a deliberate theoretical commitment about whether organism behavior belongs in the explanation at all. Reading either instrument''s manual alone, a researcher would never see this. It only becomes visible by holding both up against the same cases at once, which is the entire reason this comparison space exists.',
   'narrative',
   '[{"type":"focus","ids":["d1b088f7-a940-5d5e-a5bc-45c0a049d351","408a667a-93d5-58a1-bb50-f8e6606b9745"],"reason":"Back to the two strands that formally instantiate the dispute, now with its full weight visible"}]',
   '[{"kind":"dispute_contested_case","id":"giraffe-neck-length"},{"kind":"dispute_contested_case","id":"human-upright-walking"},{"kind":"divergence","id":"OE-DIVERGENCE-agency-negation"},{"kind":"dispute_node","id":"og:dispute:openevo-vs-kampourakis"}]',
   false),

  (7, 'Where the Strictness Runs Out: No Bridge to Separation',
   'Bio-Core''s own strand admits this is where its K-to-12 story has to work hardest to hang together. Kindergarten sorts living things into kinds. Third grade adds family trees. Then sixth grade jumps straight to populations splitting apart because they got physically separated, with nothing in between that ever let a young student feel what separation itself does. The paper''s own method here is a story about one species stranded on different islands, usable well before sixth grade. What you''re seeing now isn''t live in Bio-Core yet. It''s a sketch of the piece the paper suggests adding.',
   'gap',
   '[{"type":"focus","ids":["76c205d2-33d4-5532-ba5a-cab715380b5e","a4cd9b9e-d3a1-52bd-b76f-eb6173ab7259","ca152c60-d9a5-509f-afdb-e2e7bdf983b4"],"reason":"The three-grade-band jump with no isolation bridge"}]',
   '[{"kind":"data_object","id":"76c205d2-33d4-5532-ba5a-cab715380b5e"},{"kind":"data_object","id":"a4cd9b9e-d3a1-52bd-b76f-eb6173ab7259"},{"kind":"data_object","id":"ca152c60-d9a5-509f-afdb-e2e7bdf983b4"},{"kind":"literature_reference","id":"2814204e-6038-4d2f-92d9-181dae7516df"}]',
   true),

  (8, 'A Word Bio-Core''s Own Rules Cannot Allow',
   'A trait can evolve for one world and then get stuck operating in a different one: a taste for sugar and fat that made sense when food was scarce, now sitting inside a world of constant abundance. Researchers call this evolutionary mismatch, and it is the paper''s single most argued-for idea. Neither curriculum has a word for it yet. For Interdisciplinary, that gap sits right next to concepts like Agency and Niche Construction that already lean the same direction. For Bio-Core, the problem runs deeper than a missing word. The idea itself needs a trait to have operated somewhere, under some behavior. That is exactly the kind of agential framing Bio-Core''s rules exclude by design. What you''re seeing sketched here is one possible way to name it.',
   'gap',
   '[{"type":"focus","ids":["408a667a-93d5-58a1-bb50-f8e6606b9745"],"reason":"Where a Mismatch concept would sit, next to Agency and Niche Construction"},{"type":"lens","lens":"checked","reason":"Highlight how little either vocabulary covers this"}]',
   '[{"kind":"literature_reference","id":"8bad22cb-0f0d-4702-9870-b6a76b314336"},{"kind":"conceptbase_concept","id":"OE-CONCEPT-oe-interdisciplinary-agency"},{"kind":"conceptbase_concept","id":"OE-CONCEPT-oe-interdisciplinary-development"}]',
   true),

  (9, 'Sexual Selection Has Nowhere to Live Either',
   'A peacock''s tail is a strange case for Bio-Core''s own four-part rule: it doesn''t make the bird better at surviving, only better at getting chosen as a mate. The paper assumes a teacher could reach for an idea like this. Right now, neither curriculum has a concept called Sexual Selection at all. It is a second gap the same study surfaces, smaller than mismatch but no less worth naming.',
   'gap',
   '[{"type":"focus","ids":["4f1b4d5d-6232-5ef5-b44c-a850224b58a5"],"reason":"Next to the Four-Component substrand it would extend"}]',
   '[{"kind":"data_object","id":"4f1b4d5d-6232-5ef5-b44c-a850224b58a5"},{"kind":"literature_reference","id":"2814204e-6038-4d2f-92d9-181dae7516df"}]',
   true),

  (10, 'Where the Wider Rulebook Opens Up',
   'Flip the direction, and the same paper fills holes on the other side instead. Interdisciplinary''s own substrands already ask for a cultural transmission example, a scaffolding example, a cooperation example, and name no actual activity for any of them. The paper hands over three, ready-made: a paper-airplane design contest played across generations, a wordless game of passing on a skill, a stone-age hunting game built on game theory. None of these would fit inside Bio-Core''s own stricter rule. That isn''t a flaw in either curriculum. It is exactly what a controlled comparison is supposed to show.',
   'narrative',
   '[{"type":"focus","ids":["6315aad7-35b7-52dc-9dd2-1b82d707a768","31b2be29-7a8c-5f98-a447-55ecf57f1ff9","a1bc92d8-3730-53b8-a059-f3999e4387cf"],"reason":"Three substrands the paper fills directly"}]',
   '[{"kind":"data_object","id":"6315aad7-35b7-52dc-9dd2-1b82d707a768"},{"kind":"data_object","id":"31b2be29-7a8c-5f98-a447-55ecf57f1ff9"},{"kind":"data_object","id":"a1bc92d8-3730-53b8-a059-f3999e4387cf"},{"kind":"literature_reference","id":"8bad22cb-0f0d-4702-9870-b6a76b314336"}]',
   false),

  (11, 'A Gap Neither Side Owns',
   'One more gap belongs to neither curriculum alone. The paper''s own methods for how humans came to walk upright, or why skin color varies by latitude, are squarely biological, stated with the same precision Bio-Core uses everywhere else, but they are about humans specifically, and neither curriculum has ever used a human example. Bio-Core''s three strands stay with generic animals and plants throughout. Interdisciplinary''s vocabulary has no concept naming human anatomy or physiology at all. This one is an open question for whoever owns this content next. This tour does not make that decision for them.',
   'gap',
   '[{"type":"surface","reason":"Step back to both curricula together"}]',
   '[{"kind":"literature_reference","id":"2814204e-6038-4d2f-92d9-181dae7516df"},{"kind":"literature_reference","id":"8bad22cb-0f0d-4702-9870-b6a76b314336"},{"kind":"divergence","id":"OE-DIVERGENCE-human-evolution-treatment"}]',
   false),

  (12, 'An Unfinished Note to End On',
   'One more fact belongs in this room, and it isn''t about which curriculum wins. A formal equity review already on file for this exact dispute found that neither curriculum has been checked against non-Western or Indigenous ways of understanding nature and behavior. That review calls this an open question for both curricula. It is not a score settled for either one. This tour ends here on purpose: two carefully built, different tools, a peer-reviewed study that lands differently on each one, and one shared piece of homework neither has done yet.',
   'equity',
   '[{"type":"surface","reason":"Final wide shot of the whole shared space"}]',
   '[{"kind":"dispute_tradeoff","id":"DT_08"},{"kind":"literature_reference","id":"2814204e-6038-4d2f-92d9-181dae7516df"},{"kind":"literature_reference","id":"8bad22cb-0f0d-4702-9870-b6a76b314336"}]',
   false)
) AS vals(position, title, narration, stop_kind, shots, citations, is_proposed_sketch)
WHERE NOT EXISTS (
  SELECT 1 FROM universe_tour_stops WHERE tour_id = '5a1e1f0a-6e8c-4b9a-9c1d-0f2b7a9e3c41' AND position = vals.position
);
