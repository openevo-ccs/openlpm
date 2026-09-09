-- Replaces the 'eva-lpm' seed project (005_seed_projects.sql) with a real
-- Sachsen Biologie Gymnasium project, per a 2026-09-06 cross-repo
-- reconciliation session.
--
-- Why: migration 005 seeded eva-lpm assuming it was a simple orphan OpenLPM
-- could adopt. Direct investigation of eva-graph (where eva-lpm actually
-- lives, inside curriculum_models/) found its own team already has a live,
-- named "only Dustin can decide" fork open: migrate eva-lpm's strand/
-- objectives layer into ConceptBase's real oe:LPM schema, or formally retire
-- it. OpenLPM adopting it as a seed project was not one of the two branches
-- that decision considered, its source repo (eva4k12) was hard-deleted
-- 2026-07-24, and it's self-disaffiliated, Draft-status, and only 31%
-- complete (51/163 items). Claiming it here would implicitly prejudge a
-- decision that isn't OpenLPM's to make.
--
-- Sachsen Biologie Gymnasium is a better fit for what this seed project was
-- always meant to demonstrate (a real, non-ConceptBase-native curriculum
-- format -- here, FWU/Mem-Schule ontology via live SPARQL -- being pulled
-- into OpenLPM) and isn't entangled in another repo's open decision:
--
--   - A real 9-document Sachsen Biologie curriculum registry, independently
--     verified live against FWU-DE's public SPARQL endpoint
--     (https://sparql.mem.edufeed.org/sparql) by EvoMentor's own
--     fwu_lehrplan_importer.py (see EvoMentor/importers/
--     fwu_sn_document_registry.json), spanning grades 5-13 across Gymnasium,
--     Oberschule, Fachoberschule, and Berufsschule tracks.
--   - 2,556 real, machine-readable Lernziel/Kompetenz-level elements counted
--     across those 9 documents (via the FWU ontology's bfo:BFO_0000051
--     has-part pattern) -- concentrated in two overlapping Gymnasium Biologie
--     documents covering grades 5-12 (708 + 628 items).
--   - Of those, 86 evolution-focused items are already fully concept-tagged
--     against real ConceptBase OE-CONCEPT-* ids and schema-validated (see
--     EvoMentor/importers/sn_evolution_canonical_items.json) -- a genuine,
--     if partial, proof that this pipeline produces real canonical items,
--     not just counted-but-untouched source data.
--   - The remaining ~2,470 items are real and counted but not yet
--     concept-tagged -- an honestly disclosed backlog (a semantic-judgment
--     step still to do), not synthetic placeholder data. This is exactly
--     the kind of import-and-curate workflow OpenLPM's Standards & Frameworks
--     UI is being built to support.

DO $$
DECLARE
  v_eva_lpm_id UUID;
  v_sachsen_id UUID := gen_random_uuid();
  v_sachsen_trunk_id UUID := gen_random_uuid();
BEGIN

  SELECT id INTO v_eva_lpm_id FROM projects WHERE slug = 'eva-lpm';
  -- Cascades to its trunk branch (branches.project_id) and base link
  -- (project_base_links.project_id) via their ON DELETE CASCADE FKs
  -- (004_projects_branches_portfolios.sql) -- no separate cleanup needed.
  IF v_eva_lpm_id IS NOT NULL THEN
    DELETE FROM projects WHERE id = v_eva_lpm_id;
  END IF;

  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, projectbase_ref, hosting_mode)
  VALUES (
    v_sachsen_id, 'sachsen-biologie', 'Sachsen Biologie (Gymnasium)',
    'Real Saxon Biologie Gymnasium curriculum (grades 5-12), sourced live from FWU-DE''s public Mem-Schule/Lehrplan-Ontologie SPARQL endpoint -- a genuinely different ingestion format from ConceptBase-native projects (RDF/SPARQL rather than YAML), and OpenLPM''s live test case for the FWU/Mem-Schule import path RFC 0002 always intended to support. 2,556 real curriculum elements counted across 9 documents (grades 5-13 across school types); 86 evolution-focused items already concept-tagged and schema-validated against real ConceptBase ids, the rest a disclosed, real backlog awaiting the same concept-tagging pass.',
    'active', 'field-validated-curriculum',
    'Real, currently-taught Saxon state curriculum, not a synthetic comparison object -- concept-tagging coverage is partial (86 of ~2,556 items) and tracked separately from this project-level status.',
    NULL, 'hosted'
  );

  INSERT INTO branches (id, project_id, slug, label, description, is_trunk, status)
  VALUES (v_sachsen_trunk_id, v_sachsen_id, 'main', 'Trunk', 'The single genesis branch.', TRUE, 'active');

  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)
  VALUES (v_sachsen_id, 'conceptbase', TRUE, TRUE);

END $$;
