-- ============================================================================
-- STATUS: DRAFT -- NOT YET APPLIED. DO NOT RUN THIS AGAINST ANY DATABASE.
-- ============================================================================
-- This file lives in supabase/migrations-draft/, deliberately NOT in
-- supabase/migrations/, and carries no numeric migration prefix -- so it
-- will not be picked up by `supabase db push`, `supabase migration up`, or
-- any tooling that globs that directory in sequence. It exists only to show
-- the target shape of a future `mpi-eva-research-engagement-draft` OpenLPM
-- project for review, before anyone builds it for real. See
-- docs/mpi-eva-research-engagement-draft.md for the full design rationale
-- and the real open decisions this depends on.
--
-- Why this isn't just "the next numbered migration": OpenLPM's real
-- project-creation path today is the authenticated "New Project" wizard
-- (src/pages/dashboard/new-project-wizard.tsx) -- an RLS-gated INSERT that
-- requires a signed-in user and auth.uid() = created_by
-- (004_projects_branches_portfolios.sql's "Authenticated users can create
-- projects" policy). The DO-block seed style below is how OpenLPM's
-- original seed projects were created (005_seed_projects.sql,
-- 008_swap_eva_lpm_for_sachsen.sql), back before any real user account
-- existed. It's reused here only because it's a familiar, reviewable shape
-- for showing target row content -- not a recommendation to bypass the
-- wizard once this project is actually ready to be created for real. A real
-- creation should go through the wizard with a real signed-in maintainer,
-- the normal way every OpenLPM project has been created since real accounts
-- existed.
--
-- Explicitly not done by this file, and not done by running it either:
--   - No account, project, source declaration, or base link created in any
--     real Supabase project, hosted or self-hosted.
--   - No content imported from mpi-eva-graph. eva-graph is a private repo;
--     even a real run of this file would only create an empty project
--     shell and its source declarations, not any theory/literature
--     content -- that still needs the manual, curator-checked import pass
--     described in the design doc, and department review before it goes
--     any further than a small trusted group.
--   - Not a stand-in for, or a quiet answer to, eva-graph's own still-open
--     eva-lpm decision (migrate its strand/objectives layer into
--     ConceptBase, or retire it). This is a new, separate, differently-
--     scoped project about MPI-EVA's seven research departments, not about
--     eva-graph's curriculum strand content.
--
-- Written against the live schema through migration 024 (checked directly,
-- not assumed): projects.epistemic_status is the three-value enum fixed by
-- migration 007 ('designed-thought-experiment' | 'field-validated-
-- curriculum' | 'in-development'); maturity/focus_type/theme_tags/
-- working_languages come from migrations 015-016; project_source_
-- declarations and project_base_links come from migrations 019 and 004
-- respectively.
-- ============================================================================

DO $$
DECLARE
  v_project_id UUID := uuid_generate_v4();
BEGIN

  INSERT INTO projects (
    id, slug, name, description, status, epistemic_status, epistemic_status_note,
    maturity, focus_type, theme_tags, working_languages, hosting_mode
  )
  VALUES (
    v_project_id, 'mpi-eva-research-engagement-draft', 'MPI-EVA Research & Department Engagement (draft)',
    'Prospective project for browsing and discussing the Max Planck Institute for Evolutionary Anthropology''s seven research departments (HBEC, HumOr, DLCE, DAG, CCP, EvoGen, PrimEvo): their real current research groups, theories, methods, and open topics, grounded in mpi-eva-graph''s structured knowledge graph (eva-graph repo). Working title only -- not live, not public, not announced. Every source node this project would draw on is itself curator-drafted and not yet reviewed by any MPI-EVA department; treat all of it as provisional until a real department contact has looked at it.',
    'planning', 'in-development',
    'Real MPI-EVA institute content, not a synthetic comparison object -- but unreviewed by any department, and not yet field-validated as curriculum or public-facing research communication. Distinct from bio-core-k12/oe-interdisciplinary-k12''s designed-thought-experiment status and from sachsen-biologie''s field-validated-curriculum status.',
    'draft', 'thematic', ARRAY['research-engagement', 'human-evolution', 'behavior', 'mpi-eva'], ARRAY['en'], 'hosted'
  );

  -- Seven source declarations, one per department -- the real mechanism
  -- (019_standards_and_project_scope.sql) for naming what a project draws
  -- on and confirming rights to use it. mpi-eva-graph is not one of the
  -- ecosystem's 10 Foundational Repos and has no project_base_links entry
  -- of its own; this is the correct table for it, not that one.
  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, url)
  VALUES
  (v_project_id, 'mpi-eva-graph / sub-units/hbec (Department of Human Behavior, Ecology and Culture)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Source repo (eva-graph) is private, internal to the OpenEvo CCS Lab. Every node is curator-drafted, not department-reviewed. Do not import beyond a maintainer-curated draft pass; do not publish before Dustin confirms MPI-EVA is comfortable with it.', NULL),
  (v_project_id, 'mpi-eva-graph / sub-units/humor (Department of Human Origins)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Same private-repo, curator-drafted, not-department-reviewed status as every other department declaration in this project.', NULL),
  (v_project_id, 'mpi-eva-graph / sub-units/dlce (Department of Linguistic and Cultural Evolution)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Same private-repo, curator-drafted, not-department-reviewed status as every other department declaration in this project.', NULL),
  (v_project_id, 'mpi-eva-graph / sub-units/dag (Department of Archaeogenetics)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Same private-repo, curator-drafted, not-department-reviewed status as every other department declaration in this project.', NULL),
  (v_project_id, 'mpi-eva-graph / sub-units/ccp (Department of Comparative Cultural Psychology)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Same private-repo, curator-drafted, not-department-reviewed status as every other department declaration in this project.', NULL),
  (v_project_id, 'mpi-eva-graph / sub-units/evogen (Department of Evolutionary Genetics)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Same private-repo, curator-drafted, not-department-reviewed status as every other department declaration in this project.', NULL),
  (v_project_id, 'mpi-eva-graph / sub-units/primevo (Department of Primate Behavior and Evolution)',
   'json (nodes + edges, mpi-eva-graph/sub-units/schema/department-schema.json)',
   'Same private-repo, curator-drafted, not-department-reviewed status as every other department declaration in this project.', NULL);

  -- ConceptBase is the only one of the ecosystem's 10 Foundational Repos
  -- that is actually public today (see lab_manager/docs/design-notes/
  -- openlpm-openevo-foundational-repos-compatibility-and-integration-
  -- roadmap.md, section 1, checked live via `gh repo view` 2026-09-13).
  -- Importing from it is real and available; contributing back is left off
  -- for a project that doesn't exist yet and has no maintainer assigned.
  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)
  VALUES (v_project_id, 'conceptbase', TRUE, FALSE);

END $$;
