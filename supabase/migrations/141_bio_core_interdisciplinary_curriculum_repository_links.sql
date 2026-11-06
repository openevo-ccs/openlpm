-- Connects the two synthetic LPMs to real-world Curriculum Repository
-- content for the German (Saxony/Thuringia) and US (New York/California)
-- custom views -- the "browse + connect" mechanism migration 066 already
-- built (project_repository_links for the whole-project grounding,
-- curriculum_repository_links for a specific strand/substrand <-> a
-- specific real policy/institutional record), applied here for the first
-- time to bio-core-lpm-synth/interdisciplinary-lpm-synth. Every record
-- linked below already exists live except California's, created in this
-- migration (checked 2026-10-20 before writing this).
--
-- California has no real content yet, unlike Saxony/Thuringia/New York --
-- there's no sibling "california-lpm"-style repo the way Germany has
-- deutsche-lpm and New York has nys-lpm (see curriculum_repository_records'
-- own source_repo field for those). Real public sourcing was done this
-- session (WebSearch/WebFetch against cde.ca.gov, EdWeek, EdSource, NCSE,
-- the CA Legislature) rather than invented, but cde.ca.gov itself blocked
-- every direct fetch attempt (bot protection), so every record below is
-- honestly marked access_tier='summary-only' and
-- content.verificationStatus='secondary-source-only' or
-- 'unverified-exercise-caution' (never 'primary-source-confirmed') --
-- this is a real starter layer, not research of the same depth as
-- Saxony/Thuringia/New York's own sibling-repo content, and should be
-- treated that way until someone opens the actual CDE PDFs in a browser
-- and a proper california-lpm-style repo gets built the same way the
-- other three regions have one.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_inter_project UUID;
  v_us_project UUID;
  v_ca_project UUID;
  v_germany_project UUID;
  v_saxony_project UUID;
  v_thuringia_project UUID;
  v_ny_project UUID;
  v_owner_id UUID;
  v_owner_invited_by UUID;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';
  SELECT id INTO v_us_project FROM projects WHERE slug = 'united-states-curriculum-repository';
  SELECT id INTO v_germany_project FROM projects WHERE slug = 'germany-curriculum-repository';
  SELECT id INTO v_saxony_project FROM projects WHERE slug = 'saxony-curriculum-repository';
  SELECT id INTO v_thuringia_project FROM projects WHERE slug = 'thuringia-curriculum-repository';
  SELECT id INTO v_ny_project FROM projects WHERE slug = 'new-york-curriculum-repository';

  -- ==========================================================================
  -- 1. California Curriculum Repository -- new project, nested under US,
  --    same real shape as 081's own United States/New York rows.
  -- ==========================================================================

  SELECT user_id, invited_by INTO v_owner_id, v_owner_invited_by
    FROM project_members WHERE project_id = v_us_project AND role = 'owner' LIMIT 1;

  INSERT INTO projects (slug, name, description, project_kind, parent_project_id, is_private, epistemic_status, epistemic_status_note, focus_type, region_tags, created_by)
  SELECT
    'california-curriculum-repository',
    'California Curriculum Repository',
    'Starter layer of real, publicly-sourced California science-education policy history (NGSS adoption, the State Board''s anti-dogmatism policy, the 2016 Science Framework). Built from secondary sources (EdWeek/EdSource/NCSE reporting, WebSearch-indexed CDE pages) after cde.ca.gov blocked direct automated access to its own primary documents -- genuinely starter-depth, not yet researched to the same primary-source standard as the Germany/Saxony/Thuringia/New York repositories.',
    'curriculum-repository',
    v_us_project,
    TRUE,
    'designed-thought-experiment',
    'Real public facts, but mostly secondary-source-confirmed rather than primary-source-confirmed (see each record''s own verificationStatus) -- treat as a starter layer needing the same primary-document research pass the other regions already received, not as parity with them.',
    'regional',
    ARRAY['US-CA'],
    v_owner_id
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = 'california-curriculum-repository');

  SELECT id INTO v_ca_project FROM projects WHERE slug = 'california-curriculum-repository';

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, role, invited_by)
    VALUES (v_ca_project, v_owner_id, 'owner', v_owner_invited_by)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  -- ==========================================================================
  -- 2. California records -- real, publicly-sourced, honestly scoped
  --    (see header). source_repo marks these as a direct OpenLPM starter
  --    draft, not an import from a sibling repo like the other regions.
  -- ==========================================================================

  INSERT INTO curriculum_repository_records (project_id, record_type, jurisdiction, source_repo, source_record_id, title, content, access_tier)
  VALUES
  (v_ca_project, 'institutional-mandate-record', 'US-CA', 'openlpm-starter-draft', 'CA-MANDATE-ngss-adoption-2013',
   'CA State Board of Education adopts the Next Generation Science Standards',
   jsonb_build_object(
     'id', 'CA-MANDATE-ngss-adoption-2013', 'label', 'CA State Board of Education adopts the Next Generation Science Standards',
     'issuingBody', 'California State Board of Education', 'mandateType', 'standards-adoption', 'adoptionDate', '2013-09-04',
     'statementText', 'Board voted unanimously to adopt the Next Generation Science Standards (plus Appendices A-M) as California''s K-12 science content standards, making California the 6th state to adopt NGSS.',
     'sourceUrl', 'https://ncse.ngo/california-adopts-ngss',
     'verificationStatus', 'secondary-source-only',
     'provenance', jsonb_build_object('date', '2026-10-20', 'added_by', 'claude-session', 'extracted_by', 'llm', 'review_status', 'author-draft',
       'contributor_notes', 'WebSearch/WebFetch research session; cde.ca.gov itself blocked direct fetch (bot protection). Corroborated by EdWeek and EdSource contemporaneous reporting, not yet by reading the CDE primary record directly.')
   ), 'summary-only'),
  (v_ca_project, 'institutional-mandate-record', 'US-CA', 'openlpm-starter-draft', 'CA-MANDATE-anti-dogmatism-policy-1989',
   'SBE Policy on the Teaching of Natural Sciences (strengthened anti-dogmatism policy)',
   jsonb_build_object(
     'id', 'CA-MANDATE-anti-dogmatism-policy-1989', 'label', 'SBE Policy on the Teaching of Natural Sciences (strengthened anti-dogmatism policy)',
     'issuingBody', 'California State Board of Education', 'mandateType', 'policy-statement', 'adoptionDate', '1989-01-25',
     'statementText', 'Board unanimously approved a statement limiting science curriculum to "observable facts and testable hypotheses," stating science teachers "are professionally bound to limit their teaching to science" -- without naming evolution or creationism directly, the policy is the explicit governing principle shielding evolution instruction from creationist-equal-time pressure in California. Superseded a 1972 original.',
     'sourceUrl', 'https://www.cde.ca.gov/ci/sc/cf/documents/sbepolicyteachsci.pdf',
     'verificationStatus', 'secondary-source-only',
     'provenance', jsonb_build_object('date', '2026-10-20', 'added_by', 'claude-session', 'extracted_by', 'llm', 'review_status', 'author-draft',
       'contributor_notes', 'Direct fetch of the CDE PDF blocked; wording reconstructed from WebSearch-indexed snippets of that document, corroborated by a contemporaneous EdWeek article and NCSE. Treat as a close paraphrase, not a verbatim-verified quote, until someone opens the CDE PDF directly.')
   ), 'summary-only'),
  (v_ca_project, 'policy-timeline-event', 'US-CA', 'openlpm-starter-draft', 'CA-EVENT-science-framework-2016',
   'CA State Board of Education adopts the 2016 Science Framework for California Public Schools',
   jsonb_build_object(
     'id', 'CA-EVENT-science-framework-2016', 'label', 'CA State Board of Education adopts the 2016 Science Framework for California Public Schools',
     'dateStart', '2016-11-03', 'eventType', 'framework-adopted', 'temporalStatus', 'past-completed',
     'description', 'Adopted pursuant to SB 300 (2013)''s mandate, aligning curriculum guidance to CA NGSS.',
     'sourceUrl', 'https://www.cde.ca.gov/ci/sc/cf/cascienceframework2016.asp',
     'verificationStatus', 'secondary-source-only',
     'provenance', jsonb_build_object('date', '2026-10-20', 'added_by', 'claude-session', 'extracted_by', 'llm', 'review_status', 'author-draft')
   ), 'summary-only'),
  (v_ca_project, 'policy-timeline-event', 'US-CA', 'openlpm-starter-draft', 'CA-EVENT-segraves-v-california-1981',
   'Segraves v. California decided',
   jsonb_build_object(
     'id', 'CA-EVENT-segraves-v-california-1981', 'label', 'Segraves v. California decided', 'dateStart', '1981-03', 'dateGranularity', 'month',
     'eventType', 'court-ruling', 'temporalStatus', 'past-completed',
     'description', 'Judge Irving Perluss rejects a parent''s First Amendment challenge to evolution instruction and upholds the 1972 anti-dogmatism policy as a constitutionally sufficient accommodation.',
     'sourceUrl', 'https://en.wikipedia.org/wiki/Segraves_v._California',
     'verificationStatus', 'secondary-source-only',
     'provenance', jsonb_build_object('date', '2026-10-20', 'added_by', 'claude-session', 'extracted_by', 'llm', 'review_status', 'author-draft',
       'contributor_notes', 'Sourced from Wikipedia''s summary of the ruling, not the court opinion itself.')
   ), 'summary-only'),
  (v_ca_project, 'policy-timeline-event', 'US-CA', 'openlpm-starter-draft', 'CA-EVENT-curriculum-commission-evolution-theme-1989',
   'CA Curriculum Commission endorses evolution as a major Science Framework theme',
   jsonb_build_object(
     'id', 'CA-EVENT-curriculum-commission-evolution-theme-1989', 'label', 'CA Curriculum Commission endorses evolution as a major Science Framework theme',
     'dateStart', '1989-09', 'dateGranularity', 'month', 'eventType', 'commission-recommendation', 'temporalStatus', 'past-completed',
     'description', 'CA Curriculum Commission endorses a new Science Framework making evolution one of four central organizing themes (energy, continuity, patterns of change, evolution); a State Board vote was expected the following month. One expert called it "the strongest statement on teaching evolution I have ever seen."',
     'sourceUrl', 'https://www.edweek.org/education/california-panel-backs-science-curriculum-that-includes-evolution-as-a-major-theme/1989/10',
     'verificationStatus', 'unverified-exercise-caution',
     'provenance', jsonb_build_object('date', '2026-10-20', 'added_by', 'claude-session', 'extracted_by', 'llm', 'review_status', 'author-draft',
       'contributor_notes', 'EdWeek covers the commission''s endorsement and a forthcoming board vote, not a confirmed final SBE adoption date -- flagged for follow-up, not treated as closed.')
   ), 'summary-only'),
  (v_ca_project, 'policy-principle-record', 'US-CA', 'openlpm-starter-draft', 'CA-PRINCIPLE-nothing-taught-dogmatically',
   '"Nothing shall be taught dogmatically" -- California''s science-vs-origins teaching principle',
   jsonb_build_object(
     'id', 'CA-PRINCIPLE-nothing-taught-dogmatically', 'label', '"Nothing shall be taught dogmatically" -- California''s science-vs-origins teaching principle',
     'description', 'Scientific facts/hypotheses/theories about the origins of the universe, Earth, and life (the "how") belong in the science curriculum; discussions of divine creation or ultimate purpose (the "why") belong in history-social-science/ELA. Neither the California nor U.S. Constitution requires equal time for religious views in science class. The explicit governing principle for how evolution/natural selection must be taught in CA public schools.',
     'sourceUrl', 'https://www.cde.ca.gov/ci/sc/cf/documents/sbepolicyteachsci.pdf',
     'verificationStatus', 'secondary-source-only',
     'provenance', jsonb_build_object('date', '2026-10-20', 'added_by', 'claude-session', 'extracted_by', 'llm', 'review_status', 'author-draft',
       'contributor_notes', 'Reconstructed from WebSearch-indexed snippets of the CDE document, corroborated by a 1989 EdWeek article and NCSE; not yet verified against the primary PDF directly.')
   ), 'summary-only')
  ON CONFLICT (source_repo, source_record_id) DO NOTHING;

  -- ==========================================================================
  -- 3. Level 1 -- declare both LPMs as grounded in each real-world repository
  --    this session is connecting them to.
  -- ==========================================================================

  INSERT INTO project_repository_links (project_id, repository_project_id, jurisdiction, note)
  VALUES
  (v_bio_project, v_germany_project, 'DE', 'German-context custom view: connects Bio-Core''s strands to real Sachsen/Thüringen curriculum-policy content.'),
  (v_bio_project, v_saxony_project, 'DE-SN', 'German-context custom view.'),
  (v_bio_project, v_thuringia_project, 'DE-TH', 'German-context custom view.'),
  (v_bio_project, v_us_project, 'US', 'US-context custom view: connects Bio-Core''s strands to real New York/California curriculum-policy content.'),
  (v_bio_project, v_ny_project, 'US-NY', 'US-context custom view.'),
  (v_bio_project, v_ca_project, 'US-CA', 'US-context custom view -- starter-depth content, see california-curriculum-repository''s own description.'),
  (v_inter_project, v_germany_project, 'DE', 'German-context custom view: connects Interdisciplinary LPM''s strands to real Sachsen/Thüringen curriculum-policy content.'),
  (v_inter_project, v_saxony_project, 'DE-SN', 'German-context custom view.'),
  (v_inter_project, v_thuringia_project, 'DE-TH', 'German-context custom view.'),
  (v_inter_project, v_us_project, 'US', 'US-context custom view: connects Interdisciplinary LPM''s strands to real New York/California curriculum-policy content.'),
  (v_inter_project, v_ny_project, 'US-NY', 'US-context custom view.'),
  (v_inter_project, v_ca_project, 'US-CA', 'US-context custom view -- starter-depth content, see california-curriculum-repository''s own description.')
  ON CONFLICT (project_id, repository_project_id, jurisdiction) DO NOTHING;

  -- ==========================================================================
  -- 4. Level 2 -- specific strand/substrand <-> specific real record, with
  --    an honest rationale. Picked by hand from each region's real content,
  --    not auto-matched.
  -- ==========================================================================

  -- Saxony -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  VALUES
  (v_bio_project, 'd8df353a-aa76-5d37-b5b4-a0cd3f1d4860', '2211387e-e1cc-4147-bace-870ec1cec0ce', 'contrasts_with',
    'Sachsen''s real Biologie Lehrplan assigns content per individual Klassenstufe (5-10), not combined bands -- a direct structural contrast with this strand''s own combined K-2/3-5/6-8/9-12 bands, worth surfacing rather than glossing over.'),
  (v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', '661e3269-c5e4-4419-87a0-a4519bce60f0', 'relates_to',
    'Real-world sequencing varies by school track in Sachsen (Oberschule teaches human evolution a full grade earlier than Gymnasium) -- a concrete illustration of how the single synthetic K-12 progression here compresses a real, track-dependent variation.')
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Saxony -> Interdisciplinary
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  VALUES
  (v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee', '13cf764f-e571-451a-8f79-721c54fb5302', 'built_from',
    'Sachsen''s own 2026-2030 Lehrplan revision makes faecherverbindendes Lernen (cross-subject teaching) equally binding to single-subject Fachunterricht by 2030 -- real-world institutional backing for exactly the cross-subject design this strand represents.'),
  (v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee', '5074bf81-5e69-43b6-ba0e-618a5a00b45c', 'relates_to',
    'G/R/W''s own foundational categories (Macht, Institutionen, Recht) are a real curriculum anchor for this strand''s own claim that institutions stabilize large-scale non-kin cooperation.'),
  (v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee', '1cb2950b-0d4b-415c-a2a2-ad3a9bfca2e7', 'relates_to',
    'Internationale Politik''s (Jgst. 11) real curriculum content on intergroup dynamics is a concrete real-world anchor for this strand''s own collective/institutional-systems content.'),
  (v_inter_project, '408a667a-93d5-58a1-bb50-f8e6606b9745', 'c524b7e5-4bbd-4510-abbc-ac42c661cb34', 'relates_to',
    'Wirtschaft und Wirtschaftsordnung''s real homo-oeconomicus model is a direct, named contrast case for this strand''s own agency/behavior framing.')
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Thuringia -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  VALUES
  (v_bio_project, 'd8df353a-aa76-5d37-b5b4-a0cd3f1d4860', 'f4071389-bd83-4d8d-a7e8-03def51f8d60', 'contrasts_with',
    'Thüringen leaves sequencing within a combined Klassen-/Doppelklassenstufe entirely to the teacher -- a real, flexible counterpart to this strand''s own fixed synthetic grade-band sequence.'),
  (v_bio_project, 'd8df353a-aa76-5d37-b5b4-a0cd3f1d4860', '3c5562de-ab2c-4085-a283-5b247848eeb9', 'relates_to',
    'Thüringen''s real curriculum teaches population-thinking earlier than any other state checked -- a concrete real-world data point for how early this strand''s own K-2/3-5 population concepts can genuinely be introduced.'),
  (v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', '7bbc2bd8-8465-414f-aed1-8266510c7b86', 'relates_to',
    'This is itself a real, named "DCR-Consonant" curriculum redesign proposal for Thüringen -- the same Dichotomized Causal Reasoning framing this strand structurally instantiates, applied to a real curriculum document rather than a synthetic one.')
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Thuringia -> Interdisciplinary
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  VALUES
  (v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee', '8aef6424-d486-45f5-a437-b688ebeb81b7', 'relates_to',
    'A real, named Biologie/Informatik bridge proposal for Thüringen (modeling the hormone system as an information-processing system) -- a concrete real-world instance of the cross-subject bridging this strand represents.'),
  (v_inter_project, '408a667a-93d5-58a1-bb50-f8e6606b9745', 'e85b56a9-74ee-4333-83a4-5c2152458eb3', 'relates_to',
    'Thüringen''s real Sozialkunde and Ethik curricula both ask overlapping nature-vs-nurture questions at the same grade, currently unlinked -- a direct real-world case this strand''s own agency/development framing speaks to.'),
  (v_inter_project, '5e4cdc6e-5c25-5f21-a833-4c0859a609da', '158a515a-b020-4dc6-a3b8-51e68ffc96ef', 'relates_to',
    'Thüringen''s own fachuebergreifend/faecherverbindend/faecherintegrierend typology is a real institutional vocabulary for exactly the kind of cross-domain organizing device this foundational strand uses.')
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- New York -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  VALUES
  (v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351', 'c484aecf-4836-42e3-b5b8-1da564fc33b4', 'relates_to',
    'NYSSLS HS-LS4 is New York''s real biological-evolution standard; the real repository record itself honestly marks its crosswalk to this kind of LPM content as "not yet attempted" -- linked here as an honest, open gap, not a completed comparison.'),
  (v_bio_project, 'd561e9fc-f767-5d25-94dc-6a4715f8ecd4', 'c484aecf-4836-42e3-b5b8-1da564fc33b4', 'relates_to',
    'NYSSLS HS-LS4 also covers speciation/common ancestry; same honest "crosswalk not yet attempted" caveat applies.')
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- New York -> Interdisciplinary
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  VALUES
  (v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee', '92fc5a61-e765-4928-8cdf-1894662fbb8f', 'relates_to',
    'The NYS Portrait of a Graduate''s "Global Citizen" attribute is a real state-adopted framework naming evolved cooperation and institutional trust as a graduation-relevant competency -- a direct real-world anchor for this strand.'),
  (v_inter_project, '5e4cdc6e-5c25-5f21-a833-4c0859a609da', '07b35e58-113d-4266-9503-99324e9bd878', 'relates_to',
    '"What does it mean to be human?" is explicitly named in New York''s own policy material as a jurisdiction-independent integrating question -- the same cross-domain organizing move this foundational strand makes.')
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- California (starter-depth) -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'relates_to',
    'California''s 2013 NGSS adoption is the real standards mandate under which evolution/natural selection is taught statewide; starter-depth record, see california-curriculum-repository''s own description.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'CA-MANDATE-ngss-adoption-2013'
  UNION ALL
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'relates_to',
    'California''s own anti-dogmatism policy is the explicit real governing principle protecting evolution instruction in this exact strand''s subject matter; starter-depth record.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'CA-PRINCIPLE-nothing-taught-dogmatically'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- California (starter-depth) -> Interdisciplinary
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '5e4cdc6e-5c25-5f21-a833-4c0859a609da'::uuid, r.id, 'relates_to',
    'NGSS''s own cross-cutting-concepts design (patterns, systems, structure/function) is a real standards-level precedent for this strand''s cross-domain organizing device; starter-depth record.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'CA-MANDATE-ngss-adoption-2013'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

END $MIGRATION$;
