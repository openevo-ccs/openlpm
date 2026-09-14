-- ============================================================================
-- STATUS: DRAFT -- NOT YET APPLIED. DO NOT RUN THIS AGAINST ANY DATABASE.
-- ============================================================================
-- This file targets a future SELF-HOSTED Supabase project for the real
-- `eva-lpm` project (MPI-EVA Research & Department Engagement) -- one that
-- does not exist yet. It must NEVER be run against OpenLPM's shared,
-- multi-tenant production Supabase project: that project's `projects` table
-- has a real RLS policy, "Authenticated users can view projects" USING
-- (auth.uid() IS NOT NULL), which makes every project's name/description
-- visible to any signed-up user of the shared service -- there is no
-- per-project privacy flag there. `hosting_mode: 'self-hosted'` below is
-- exactly the escape hatch (004_projects_branches_portfolios.sql,
-- RFC-0002 section 1) for a project that needs to stay gated: a separate
-- Supabase project, not a row in the shared one. See
-- docs/eva-lpm-self-hosted-prep.md for the full design rationale, the real
-- open decisions this depends on, and what "self-hosted" requires
-- operationally to actually go live (a real self-hosted Supabase project,
-- likely on the lab's home server, does not exist yet -- that's a separate
-- infrastructure task).
--
-- This file lives in supabase/migrations-draft/, deliberately NOT in
-- supabase/migrations/, and carries no numeric migration prefix -- so it
-- will not be picked up by `supabase db push`, `supabase migration up`, or
-- any tooling that globs that directory in sequence, on this project or any
-- future self-hosted one.
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
-- wizard once this project is actually ready to be created for real. Once a
-- self-hosted Supabase project is stood up and has the full OpenLPM schema
-- applied (migrations 001 through current head), creating this project for
-- real should go through the wizard with a real signed-in maintainer on
-- that instance, the normal way every OpenLPM project has been created
-- since real accounts existed.
--
-- Naming note: the slug 'eva-lpm' was used once before in OpenLPM's real
-- history, for a different, unrelated project -- seeded in
-- 005_seed_projects.sql against eva-graph/curriculum_models/ content (a
-- K-12 curriculum framework), then deleted in
-- 008_swap_eva_lpm_for_sachsen.sql because it would have pre-empted
-- eva-graph's own still-open, undecided call on that content (migrate into
-- ConceptBase, or retire). That row was actually DELETEd, not archived, so
-- the slug is free in the shared production database. This project reuses
-- the name deliberately, authorized by Dustin 2026-09-14, specifically for
-- a different thing: MPI-EVA's seven research departments
-- (eva-graph/mpi-eva-graph/), not eva-graph/curriculum_models/. It does not
-- touch, import from, or answer that older, still-open decision. See
-- docs/eva-lpm-self-hosted-prep.md's "Naming" section for the full account.
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
--   - No self-hosted Supabase infrastructure stood up. This file assumes
--     one exists and has the full OpenLPM schema already applied; making
--     that true is a separate, not-yet-started infrastructure task.
--
-- Written against the live schema through migration 024 (checked directly,
-- not assumed): projects.epistemic_status is the three-value enum fixed by
-- migration 007 ('designed-thought-experiment' | 'field-validated-
-- curriculum' | 'in-development'); maturity/focus_type/theme_tags/
-- working_languages come from migrations 015-016; project_source_
-- declarations and project_base_links come from migrations 019 and 004
-- respectively; hosting_mode has been on `projects` since migration 004
-- and is untouched by any later migration.
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
    v_project_id, 'eva-lpm', 'eva-lpm (MPI-EVA Research & Department Engagement)',
    'Gated, self-hosted project for browsing and discussing the Max Planck Institute for Evolutionary Anthropology''s seven research departments (HBEC, HumOr, DLCE, DAG, CCP, EvoGen, PrimEvo): their real current research groups, theories, methods, and open topics, grounded in mpi-eva-graph''s structured knowledge graph (eva-graph repo). Runs self-hosted, not on OpenLPM''s shared multi-tenant service, specifically so this project''s existence and content are not visible to the shared service''s wider user base -- see hosting_mode. Not live, not public, not announced. Every source node this project would draw on is itself curator-drafted and not yet reviewed by any MPI-EVA department; treat all of it as provisional until a real department contact has looked at it.',
    'planning', 'in-development',
    'Real MPI-EVA institute content, not a synthetic comparison object -- but unreviewed by any department, and not yet field-validated as curriculum or public-facing research communication. Distinct from bio-core-k12/oe-interdisciplinary-k12''s designed-thought-experiment status and from sachsen-biologie''s field-validated-curriculum status.',
    'draft', 'thematic', ARRAY['research-engagement', 'human-evolution', 'behavior', 'mpi-eva'], ARRAY['en'],
    'self-hosted' -- deliberate, not the column default ('hosted') -- see file header.
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
  -- Importing from it works the same way on a self-hosted instance as a
  -- hosted one -- it's a read of ConceptBase's own public repo/MCP tools,
  -- not a live link into OpenLPM's shared Supabase project, so hosting_mode
  -- doesn't block it. Contributing back is left off for a project that
  -- doesn't exist yet and has no maintainer assigned.
  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)
  VALUES (v_project_id, 'conceptbase', TRUE, FALSE);

END $$;
