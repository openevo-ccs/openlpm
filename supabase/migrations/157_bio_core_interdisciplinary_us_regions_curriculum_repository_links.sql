-- Extends migration 141's bio-core-lpm-synth/interdisciplinary-lpm-synth <->
-- real-world Curriculum Repository linking pattern to the four US repos
-- that were still at zero links as of 2026-10-21 (see design note
-- lab_manager/docs/design-notes/curriculum-repository-nation-region-
-- thematic-subspace-pattern-2026-10-21.md, "What this does NOT yet solve"):
-- Florida, Pennsylvania, Tennessee, and the national thematic repo
-- (us-evolution-education-curriculum-repository). Unlike 141, no new
-- curriculum_repository_records are created here -- all 49/42/44/13 records
-- in these four repos already exist live; this migration only adds the two
-- levels of linking (project_repository_links, curriculum_repository_links)
-- on top of real content read directly via scripts/read-curriculum-
-- repository.mjs before writing a single row below.
--
-- Every specific strand<->record pairing was picked by hand after reading
-- each repo's real records, the same way 141's Saxony/Thuringia/NY/CA
-- pairings were -- never auto-matched, and every rationale below cites a
-- fact that is actually in the linked record, not a generic gloss.

SET search_path = public, extensions;

DO $MIGRATION$
DECLARE
  v_bio_project UUID;
  v_inter_project UUID;
  v_fl_project UUID;
  v_pa_project UUID;
  v_tn_project UUID;
  v_us_thematic_project UUID;
  v_view_id UUID;
  v_role TEXT;
BEGIN
  SELECT id INTO v_bio_project FROM projects WHERE slug = 'bio-core-lpm-synth';
  SELECT id INTO v_inter_project FROM projects WHERE slug = 'interdisciplinary-lpm-synth';
  SELECT id INTO v_fl_project FROM projects WHERE slug = 'florida-curriculum-repository';
  SELECT id INTO v_pa_project FROM projects WHERE slug = 'pennsylvania-curriculum-repository';
  SELECT id INTO v_tn_project FROM projects WHERE slug = 'tennessee-curriculum-repository';
  SELECT id INTO v_us_thematic_project FROM projects WHERE slug = 'us-evolution-education-curriculum-repository';

  -- ==========================================================================
  -- Level 1 -- declare both LPMs as grounded in each of the four repositories.
  -- ==========================================================================

  INSERT INTO project_repository_links (project_id, repository_project_id, jurisdiction, note)
  VALUES
  (v_bio_project, v_fl_project, 'US-FL', 'US-context custom view: connects Bio-Core''s strands to real Florida evolution-education policy history.'),
  (v_bio_project, v_pa_project, 'US-PA', 'US-context custom view: connects Bio-Core''s strands to real Pennsylvania evolution-education policy history (Kitzmiller v. Dover).'),
  (v_bio_project, v_tn_project, 'US-TN', 'US-context custom view: connects Bio-Core''s strands to real Tennessee evolution-education policy history (Scopes Trial to present).'),
  (v_bio_project, v_us_thematic_project, 'US', 'US-context custom view: connects Bio-Core''s strands to the national thematic repository (US Supreme Court rulings and cross-state patterns underneath Florida/Pennsylvania/Tennessee''s own histories).'),
  (v_inter_project, v_fl_project, 'US-FL', 'US-context custom view: connects Interdisciplinary LPM''s strands to real Florida evolution-education policy history.'),
  (v_inter_project, v_pa_project, 'US-PA', 'US-context custom view: connects Interdisciplinary LPM''s strands to real Pennsylvania evolution-education policy history (Kitzmiller v. Dover).'),
  (v_inter_project, v_tn_project, 'US-TN', 'US-context custom view: connects Interdisciplinary LPM''s strands to real Tennessee evolution-education policy history (Scopes Trial to present).'),
  (v_inter_project, v_us_thematic_project, 'US', 'US-context custom view: connects Interdisciplinary LPM''s strands to the national thematic repository (US Supreme Court rulings and cross-state patterns underneath Florida/Pennsylvania/Tennessee''s own histories).')
  ON CONFLICT (project_id, repository_project_id, jurisdiction) DO NOTHING;

  -- ==========================================================================
  -- Level 2 -- specific strand <-> specific real record, with an honest
  -- rationale grounded in that record's own real content.
  -- ==========================================================================

  -- Florida -> Bio-Core (d1b088f7 = Natural Selection and Adaptation,
  -- d561e9fc = Speciation and Diversity of Life)
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'relates_to',
    'Florida''s real 2008 NGSSS standard SC.912.L.15 is the actual state mandate requiring this strand''s four-component mechanism be taught statewide -- concrete real-world uptake, not a hypothetical.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'FLLP-MANDATE-ngsss-2008-sc912l15-standard'
  UNION ALL
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'contrasts_with',
    'Florida''s 2026 draft standards reportedly omit the word "evolution" from high-school life-science content for the first time since 2008 -- real, live evidence that a mechanism once named explicitly in standards can be renamed or hedged, a direct counterpoint to this strand''s own assumption that teaching this mechanism, once established, stays stable.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'FLLP-CONTROVERSY-2026-proposed-standards-evolution-climate-omission'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd561e9fc-f767-5d25-94dc-6a4715f8ecd4'::uuid, r.id, 'relates_to',
    'Florida''s real standards shifted from avoiding the word "evolution" entirely (pre-2008) to explicitly naming it (2008) -- a concrete, dated real-world data point for how recently and unevenly this strand''s own macroevolutionary vocabulary has actually been adopted into state-mandated curriculum.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'FLLP-FINDING-evolution-naming-1996-to-2008-explicitness-shift'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Florida -> Interdisciplinary (06af1b7b = Discovering and Testing Ideas,
  -- 9d59fa89 = Culture, Technology, and Collective Systems)
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '06af1b7b-19bb-5d77-87ac-52f34650f556'::uuid, r.id, 'relates_to',
    'Florida''s own real policy principle -- that a well-documented curriculum controversy is itself legitimate classroom content, not background politics to route around -- is a concrete, named real-world instance of this strand''s own nature-of-science/epistemics framing.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'FLLP-PRINCIPLE-documented-controversy-is-teachable-nature-of-science-content'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee'::uuid, r.id, 'relates_to',
    'The real, named 2008 fight between Florida Citizens for Science, the Discovery Institute, and the State Board over the Next Generation Sunshine State Standards'' wording is a concrete real-world case of the institutional/collective dynamics this strand frames abstractly.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'FLLP-CONTROVERSY-2008-ngsss-evolution-wording-fight'
  UNION ALL
  SELECT v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee'::uuid, r.id, 'relates_to',
    'Florida''s own real policy principle -- that a standards-writing committee needs disciplinary experts proportionate to what it is writing standards for -- grounds this strand''s institutional-systems content in a live governance question rather than an abstract one.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'FLLP-PRINCIPLE-standards-committees-need-proportionate-disciplinary-expertise'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Pennsylvania -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'relates_to',
    'Pennsylvania''s real current STEELS Discipline 3.1 Life Science benchmarks (adopted 2022) are the live state mandate requiring exactly this strand''s mechanism be taught.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'PALP-MANDATE-pa-2022-steels-evolution-benchmarks'
  UNION ALL
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'contrasts_with',
    'Pennsylvania''s real 2002 rulemaking changed its standard''s wording from "support or do not support" to the softer "relevant to" the theory of evolution after public pressure -- a documented case of hedged language replacing unhedged mechanistic language, a direct real-world contrast to this strand''s own unhedged framing.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'PALP-FINDING-pa-2002-proposed-vs-final-wording-change'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Pennsylvania -> Interdisciplinary (408a667a = Agency, Development, and
  -- Niche Construction)
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '06af1b7b-19bb-5d77-87ac-52f34650f556'::uuid, r.id, 'relates_to',
    'Kitzmiller v. Dover is the single most concrete real case of the "what counts as a testable scientific idea" boundary question (the demarcation problem) this strand explores abstractly -- a federal court ruling turned on exactly that question.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'PALP-CONTROVERSY-dover-intelligent-design-disclaimer'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '408a667a-93d5-58a1-bb50-f8e6606b9745'::uuid, r.id, 'relates_to',
    'All 8 Dover biology teachers really refused to read the intelligent-design disclaimer to their own classes -- a documented, named case of individual agency acting as a check inside an institutional system, a concrete real-world instance of this strand''s own "behavior shapes what a system stabilizes on" framing, applied to institutional rather than biological selection.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'PALP-EVENT-dover-teachers-refuse-and-disclaimer-first-read'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee'::uuid, r.id, 'relates_to',
    'Pennsylvania''s own real policy principle -- that a state standard requiring evolution be taught does not, by itself, prevent a local district from undermining it -- is a concrete real-world case of the state/local governance layering this strand frames abstractly.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'PALP-PRINCIPLE-a-state-standard-does-not-bind-a-local-mandate'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Tennessee -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'relates_to',
    'Tennessee''s real current Academic Standards for Science (2022), BIO1.LS4 Biological Change benchmarks, are the live state mandate requiring exactly this strand''s mechanism be taught.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'TNLP-MANDATE-tn-2022-academic-standards-science'
  UNION ALL
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'relates_to',
    'Tennessee''s own real documented shift from explicit religious framing (the 1973 "equal time" law) to secular "critical thinking" framing (the 2012 Teacher Protection Act) is a concrete example of politically-motivated doubt-casting language aimed at exactly the mechanism this strand teaches as settled science.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'TNLP-FINDING-1973-law-vs-2012-law-framing-shift'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd561e9fc-f767-5d25-94dc-6a4715f8ecd4'::uuid, r.id, 'contrasts_with',
    'Tennessee''s 1925 Butler Act really did criminally prohibit teaching the very mechanism this strand is built on, up to and including the Scopes trial and conviction -- a stark historical counter-case to any assumption that this content has always been uncontroversial to teach.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'TNLP-CONTROVERSY-butler-act-and-scopes-trial'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- Tennessee -> Interdisciplinary
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee'::uuid, r.id, 'relates_to',
    'Tennessee''s own real policy principle -- that when a recurring legislative fight loses in court, the next round tends to arrive in secularized language rather than a changed goal -- is a concrete real-world case of exactly this strand''s framing of culture/institutions as adaptive systems under selective pressure.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'TNLP-PRINCIPLE-softened-language-is-a-tactic-not-a-change-of-goal'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '408a667a-93d5-58a1-bb50-f8e6606b9745'::uuid, r.id, 'relates_to',
    'Gary Scott was really fired for teaching evolution in Tennessee, and that firing is what directly triggered the Butler Act''s eventual repeal -- a documented case of one individual''s behavior feeding back into institutional/legal change, the same agency-affects-the-system logic this strand applies outside biology.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'TNLP-EVENT-gary-scott-fired'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '06af1b7b-19bb-5d77-87ac-52f34650f556'::uuid, r.id, 'relates_to',
    'Tennessee''s own real policy principle -- that the Scopes Trial is itself a concrete, teachable case study in how scientific consensus and public institutions interact under pressure -- directly grounds this strand''s nature-of-science framing in a real, named historical precedent rather than an abstract claim.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'TNLP-PRINCIPLE-the-scopes-trial-is-itself-teachable-history-of-science-content'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- US Evolution Education Curriculum Repository (thematic/national) -> Bio-Core
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'::uuid, r.id, 'built_from',
    'Epperson v. Arkansas (1968) is the real US Supreme Court ruling establishing that no state may ban teaching evolution -- the actual national constitutional floor making this strand''s mechanism non-optional nationwide, not just a state-by-state curriculum preference.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'USLP-MANDATE-epperson-v-arkansas'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_bio_project, 'd561e9fc-f767-5d25-94dc-6a4715f8ecd4'::uuid, r.id, 'relates_to',
    'This thematic repository''s own real comparative finding -- that Florida, Pennsylvania, and Tennessee currently hold three genuinely different postures on evolution-education policy -- ties directly to this macroevolutionary strand as the real-world content most affected by that documented cross-state variation.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'USLP-FINDING-three-states-three-current-postures'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- US Evolution Education Curriculum Repository -> Interdisciplinary
  INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
  SELECT v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee'::uuid, r.id, 'relates_to',
    'This thematic repository''s own real policy principle -- that a landmark ruling gets redesigned around rather than defeated outright -- is a documented national-level pattern of institutional adaptation that directly illustrates this strand''s framing of culture/institutions as systems under ongoing selective pressure rather than settled once and for all.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'USLP-PRINCIPLE-landmark-rulings-get-redesigned-around-not-defeated'
  UNION ALL
  SELECT v_inter_project, '9d59fa89-cdc8-5147-a71e-95175b25fcee'::uuid, r.id, 'relates_to',
    'This thematic repository''s own explicit methodological caution -- that a real, documented national pattern is not the same thing as a single national rule -- is directly relevant to how this strand should talk about "culture" at national scale without overclaiming uniformity across jurisdictions.'
  FROM curriculum_repository_records r WHERE r.source_record_id = 'USLP-PRINCIPLE-a-national-pattern-is-not-a-national-rule'
  ON CONFLICT (data_object_id, repository_record_id, relation_type) DO NOTHING;

  -- ==========================================================================
  -- Level 3 -- the two new student-view-template registry entries
  -- (bio-core-us-fl-pa-tn-en / interdisciplinary-us-fl-pa-tn-en, added this
  -- same migration's PR to src/lib/student-view-templates.ts) are useless
  -- without a matching project_dashboard_views row + role assignments --
  -- exactly the same two-step 142 already did for the Sachsen/Thüringen and
  -- New York/California views. Caught live, in-session, verifying the real
  -- "Viewing" dropdown: without this, the registry entries above compile
  -- fine but are never actually selectable by anyone.
  -- ==========================================================================

  INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
  SELECT v_bio_project, 'Florida / Pennsylvania / Tennessee (US)', 'template', 'bio-core-us-fl-pa-tn-en'
  WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_bio_project AND template_id = 'bio-core-us-fl-pa-tn-en');
  SELECT id INTO v_view_id FROM project_dashboard_views WHERE project_id = v_bio_project AND template_id = 'bio-core-us-fl-pa-tn-en';
  FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'role', v_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO project_dashboard_views (project_id, name, kind, template_id)
  SELECT v_inter_project, 'Florida / Pennsylvania / Tennessee (US)', 'template', 'interdisciplinary-us-fl-pa-tn-en'
  WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_inter_project AND template_id = 'interdisciplinary-us-fl-pa-tn-en');
  SELECT id INTO v_view_id FROM project_dashboard_views WHERE project_id = v_inter_project AND template_id = 'interdisciplinary-us-fl-pa-tn-en';
  FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP
    INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
    VALUES (v_view_id, 'role', v_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

END $MIGRATION$;
