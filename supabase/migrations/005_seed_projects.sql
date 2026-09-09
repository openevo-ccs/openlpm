-- RFC 0002, section 7: seed the four pilot projects, developed in parallel
-- to stress-test the projects/branches/base-linking model against genuinely
-- different formats and aims rather than overfitting to one case.
--
-- created_by is left NULL here -- no real user account exists yet at
-- migration time. The auto-enroll-owner trigger (handle_new_project) only
-- fires when created_by is set, so the first real maintainer to sign in
-- should be added to project_members manually (role 'owner') for each
-- project they'll actually steward, once accounts exist.

DO $$
DECLARE
  v_eva_lpm_id UUID := uuid_generate_v4();
  v_evomentor_id UUID := uuid_generate_v4();
  v_bio_core_id UUID := uuid_generate_v4();
  v_interdisciplinary_id UUID := uuid_generate_v4();
  v_eva_lpm_trunk_id UUID := uuid_generate_v4();
  v_evomentor_trunk_id UUID := uuid_generate_v4();
  v_bio_core_trunk_id UUID := uuid_generate_v4();
  v_interdisciplinary_trunk_id UUID := uuid_generate_v4();
  v_evomentor_de_branch_id UUID := uuid_generate_v4();
BEGIN

  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, projectbase_ref, hosting_mode)
  VALUES
  (
    v_eva_lpm_id, 'eva-lpm', 'eva-lpm',
    'A K-12 curriculum framework organized around "What does it mean to be human?", grounded in evolutionary anthropology: 13 cross-cutting concept strands, currently ~18% populated. Its strand/objectives layer (eva-graph/curriculum_models/) was never migrated into ConceptBase -- RFC-0012 only migrated its concept layer -- a real, standing orphan this project exists to resolve, not a hypothetical import test case.',
    'active', 'in-process', 'Real, in-process working content -- not a synthetic/thought-experiment LPM.', 'project:eva-lpm', 'hosted'
  ),
  (
    v_evomentor_id, 'evomentor', 'EvoMentor',
    'Replaces the standalone EvoMentor and EvoMentor_DE static-site tools with a single OpenLPM project. A multi-jurisdiction curriculum-coherence tool integrating evolution as a unifying framework across grade levels and subject areas, importing from CASE, the FWU/Mem-Schule ontology, and custom-format standards.',
    'active', 'in-process', 'Real, in-process working content, migrating two previously-standalone tools.', NULL, 'hosted'
  ),
  (
    v_bio_core_id, 'bio-core-k12', 'Bio-Core K-12',
    'Synthetic, designed-thought-experiment K-12 Learning Progression Model for core evolutionary biology concepts (variation/inheritance, natural selection/adaptation, speciation/diversity) -- a comparison object for LPM design research, not a field-validated curriculum.',
    'active', 'designed-thought-experiment', 'Synthetic comparison object per ConceptBase RFC-0019 -- always label distinctly from in-process/field-validated projects.', NULL, 'hosted'
  ),
  (
    v_interdisciplinary_id, 'oe-interdisciplinary-k12', 'OE Interdisciplinary K-12',
    'Synthetic, designed-thought-experiment K-12 Learning Progression Model spanning evolution, agency/development, culture/technology, and analogy/metacognition strands across subject areas -- a comparison object for LPM design research, not a field-validated curriculum.',
    'active', 'designed-thought-experiment', 'Synthetic comparison object per ConceptBase RFC-0019 -- always label distinctly from in-process/field-validated projects.', NULL, 'hosted'
  );

  INSERT INTO branches (id, project_id, slug, label, description, is_trunk, status)
  VALUES
  (v_eva_lpm_trunk_id, v_eva_lpm_id, 'main', 'Trunk', 'The single genesis branch.', TRUE, 'active'),
  (v_evomentor_trunk_id, v_evomentor_id, 'main', 'Trunk (multi-jurisdiction)', 'Multi-jurisdiction canonical-curriculum-item pipeline -- formerly EvoMentor v2''s importer scope (US-VA, Bavaria, Saxony, Rhineland-Palatinate).', TRUE, 'active'),
  (v_bio_core_trunk_id, v_bio_core_id, 'main', 'Trunk', 'The single genesis branch.', TRUE, 'active'),
  (v_interdisciplinary_trunk_id, v_interdisciplinary_id, 'main', 'Trunk', 'The single genesis branch.', TRUE, 'active');

  -- EvoMentor_DE becomes a branch of EvoMentor, formalizing after the fact
  -- the real structural divergence the two independently-built repos
  -- actually underwent (RFC 0002, sections 3 and 7) -- not a starting
  -- assumption, a recorded historical fact.
  INSERT INTO branches (id, project_id, slug, label, description, is_trunk, forked_from_branch_id, fork_rationale, status)
  VALUES (
    v_evomentor_de_branch_id, v_evomentor_id, 'evomentor-de', 'EvoMentor_DE (Thüringen)',
    'Thuringia grades 5-10 German biology/MNT curriculum: 302 curated Lernziele, the Kohärenzfäden coherence-thread methodology, and a basiskonzeptbezug graded-relevance model richer than the trunk''s own frameworkTags -- kept in this branch''s ConceptBase extensions until/unless proposed back into core schema.',
    FALSE, v_evomentor_trunk_id,
    'EvoMentor and EvoMentor_DE were independently built, static, client-only tools with no shared history -- this branch formalizes their relationship after the fact rather than treating it as an ordinary fork.',
    'active'
  );

  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)
  VALUES
  (v_eva_lpm_id, 'conceptbase', TRUE, TRUE),
  (v_eva_lpm_id, 'projectbase', TRUE, FALSE),
  (v_evomentor_id, 'conceptbase', TRUE, TRUE),
  (v_evomentor_id, 'theorybase', TRUE, FALSE),
  (v_evomentor_id, 'competencybase', TRUE, FALSE),
  (v_bio_core_id, 'conceptbase', TRUE, FALSE),
  (v_interdisciplinary_id, 'conceptbase', TRUE, FALSE);

END $$;
