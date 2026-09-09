# RFC 0002 — Projects, branches, portfolios, and cross-base linking

**Status:** Accepted — Dustin Eirdosh, 2026-09-05, live session.
**Date:** 2026-09-05

## Motivation

OpenLPM's current data model (migration `001_initial_schema.sql`) is entirely global: one flat set of literature references, schema elements, LPM data objects, and discussions, with no notion of which research group or initiative any given row belongs to. That was fine for a single pilot deployment. It stops being fine the moment OpenLPM is asked to do what this RFC is about: host multiple independent Learning Progression Model efforts side by side, including replacing two previously standalone tools (`EvoMentor`, `EvoMentor_DE`) that currently only work as separate static sites with no accounts, no shared schema, and no way to compare their coherence strategies against each other.

This RFC introduces the entities needed for that: **projects**, **branches**, **portfolios**, and a **base-repo linking** model that generalizes how any project imports from — and, for trusted roles, contributes back to — the wider OpenEvo ecosystem's foundational base repos (ConceptBase, TheoryBase, QuestionBase, LiteratureBase, CompetencyBase, MethodsBase, QuoteBase, HumanBase, ProjectBase, TeachingBase).

## Decisions

### 1. Hosting model: hybrid

OpenLPM runs as a single hosted, multi-tenant deployment by default — this is what makes live cross-project commons/federation possible at all. A group that needs full data sovereignty can still self-host its own Supabase project (as the founding RFC assumed), but a self-hosted instance only gets async export/import with the rest of the ecosystem, not live commons linking. This departs from the founding RFC's "every group self-hosts" default, which predates the federation requirement.

### 2. Canonical curriculum schema: ConceptBase, extended

Surveying `EvoMentor`'s `canonical-curriculum-item` schema, `EvoMentor_DE`'s `lernziel`/`basiskonzeptbezug`/`kohaerenzfaden` schemas, and `conceptbase/schemas/{lpm,strand,concept,competency,learningObject}.schema.yaml` together, ConceptBase's model is the most mature and the only one with real cross-repo governance (RFC process, stable ids, CI validation). It becomes OpenLPM's canonical target shape for curriculum content: `oe:LPM` → `oe:Strand`/`oe:SubStrand` (`concepts[]` with `emphasis: primary|reinforcing`, a `relations` vocabulary richer than either EvoMentor variant's own progression fields) → thin `oe:LearningObject` pointers.

**Correction (2026-09-06):** the schema *definitions* for all five types do live in `conceptbase/schemas/`, exactly as named above. But per RFC-0015 (accepted, executed), the canonical, resolvable home for actual `oe:Competency` *data* was relocated out of ConceptBase into a sibling Foundational repo, **CompetencyBase** — ConceptBase's own README states its `/competency/` path no longer resolves competency records. OpenLPM's competency import/contribute path (section 5) should target CompetencyBase, not ConceptBase, once built.

OpenLPM's import layer evolves EvoMentor's already-built importer pattern (it already normalizes CASE and FWU/Mem-Schule-ontology sources), retargeting its output at ConceptBase's schema instead of a fourth parallel one. Fields with no home yet in ConceptBase's Phase-1 schema — EvoMentor_DE's `basiskonzeptbezug` graded relevance-plus-justification, its Kohärenzfäden coherence threads — live in ConceptBase's own `extensions` escape hatch as project-local data, with a path to actually propose them into core schema later if they prove broadly useful across projects, rather than being silently dropped.

### 3. Branching: two-tier, mapped onto ConceptBase's own sandbox/permanent-tier model

A **branch** starts as a content-level fork: it shares its parent project's schema/concept vocabulary exactly, diverging only in data (grade span, subject focus, language, depth). If a branch outgrows shared schema — the way `EvoMentor_DE` actually diverged from `EvoMentor` in practice, not just in language — it can be **promoted** to a fully independent project with structural freedom.

This isn't a new mechanism to invent: ConceptBase already distinguishes **sandbox-tier** LPMs (`sandboxMeta` lifecycle, `forkedFrom`/`mergedInto` lineage, originating in RFC-0001 and extended from concepts to LPMs/Strands by RFC-0010) from **permanent-tier** ones (git-governed, RFC+PR, `status` lifecycle). An OpenLPM branch is a sandbox-tier LPM (or a project-local branch not yet even registered in ConceptBase); "promote to full project" is the point at which someone pursues actual permanent-tier registration through ConceptBase's own existing RFC/PR process — OpenLPM does not, and should not, write permanent-tier content directly (see §5). Finer-grained branching — a different grade span or depth for one substrand without forking the whole project — maps onto RFC-0009's `trajectoryVariants`/`contextAssumption` instead of a full branch.

*(Correction 2026-09-06: the paragraph above originally attributed sandbox-tier lifecycle to RFC-0010 alone; `sandboxMeta` itself originates in RFC-0001, with RFC-0010 extending it to LPMs specifically. `trajectoryVariants` is RFC-0009, confirmed live in `strand.schema.yaml`.)*

### 4. Portfolios: unlimited, named, per user per project

Eva KGDJ gives each user exactly one portfolio per deployment. OpenLPM needs more: a user can hold unlimited named portfolios per project (e.g. one per class taught, one per personal research thread), matching the brief directly. Everything else about Eva KGDJ's portfolio design is adopted as-is: portfolio items are **references** (foreign keys) into canonical project content plus a personal annotation, never copies; a portfolio can also hold fully-owned private nodes and links that never existed in the canonical graph.

### 5. Cross-base linking: import freely, contribute via real PRs, project-scoped

This generalizes "how does OpenLPM write to ConceptBase" into "how does OpenLPM relate to every OpenEvo base repo":

- Each project declares, at configuration time, which base repos it links to — not a fixed set; the project's organizer chooses (a curriculum-only project might link only ConceptBase; a research-heavy one adds TheoryBase, QuestionBase, LiteratureBase).
- **Import (read)** is unrestricted for any linked, public base repo — OpenLPM pulls its content (via the repo's files or the shared `openevo-mcp` tools already wired into this ecosystem) to populate a project's working copy. No special permission beyond the base being public.
- **Contribute (write)** never happens as a silent background sync. A project-scoped role with contribute rights (proposed default: `maintainer`) can trigger OpenLPM to format project content according to the target base's own schema and open a real, attributed pull request against that base's own repo, using its own existing review workflow (ConceptBase's RFC+PR process, LiteratureBase's CI-gated submissions-branch flow, etc.). That base's own maintainers and CI decide whether to merge it — OpenLPM is a well-formatted PR client across every base, not a second authority over any of them.

### 6. Epistemic status stays visible, not just governed

ConceptBase's RFC-0019 `epistemicStatus` (`designed-thought-experiment` vs. `field-validated-curriculum` — its exact two live values, confirmed 2026-09-06 against `conceptbase/schemas/common.defs.yaml`) already gives OpenLPM the synthetic/real distinction the brief asks for. Every project surfaces it prominently and persistently in the UI — synthetic projects (`bio-core-k12`, `oe-interdisciplinary-k12`) get a clearly different visual treatment from real ones (`EvoMentor`, `sachsen-biologie`), not a buried metadata field. OpenLPM adds one local third value, `in-development`, undocumented upstream, for real project work not yet claiming field-validated status (migration `007`) — kept visibly distinct from ConceptBase's own two, not silently merged into either.

### 7. Seed projects

Four projects are created and developed in parallel, deliberately, to stress-test the model against genuinely different formats and aims rather than overfitting to one case: `EvoMentor` (with `EvoMentor_DE` becoming a branch of it — this formalizes, after the fact, the fork that never formally happened between the two independently-built repos), `bio-core-k12` and `oe-interdisciplinary-k12` (both synthetic), and `sachsen-biologie` (real, FWU/Mem-Schule-ontology-sourced via live SPARQL — a genuinely different ingestion format from the other three, and OpenLPM's live test case for the FWU import path in section 2).

*(Correction 2026-09-06, migration `008`: the fourth seed project was originally `eva-lpm`, assumed a simple available orphan. Direct investigation found `eva-graph`'s own team already has a live, named "only Dustin can decide" fork open for it — migrate into ConceptBase's real `oe:LPM` schema, or formally retire it — and OpenLPM adopting it as a seed project was not one of the two branches that decision considered. Its source repo (`eva4k12`) was also hard-deleted 2026-07-24, and it is self-disaffiliated, Draft-status, and only 31% complete. Swapped for `sachsen-biologie`, which serves the same stress-test purpose without pre-empting another repo's open decision.)*

### 8. Commons/federation: deferred, not designed yet

A Commons is a future, explicit link between two projects/branches with mutually granted permissions (read/annotate/propose). Out of scope for this RFC's implementation slice — real design work happens once 2+ real projects exist to actually federate against each other.

## New data model (summary; see migration `004`)

`projects`, `project_members` (role-scoped per project), `branches` (with `forked_from_branch_id`, `promoted_to_project_id`), `project_base_links` (which base repos + what a project may do with each), `portfolios`, `portfolio_items` (FK reference, not copy), `portfolio_private_nodes`, `portfolio_links`. Existing tables (`literature_references`, `lpm_schema_elements`, `lpm_data_objects`, `discussion_topics`, `evidence_links`, `peer_review_assignments`) gain `project_id` (and, where relevant, `branch_id`) foreign keys and project-membership-scoped RLS, replacing the current "any authenticated user" policies from migration `002`.

## Explicitly not yet decided

- Exact role granularity for who may create a branch, trigger a base-repo PR, or create a Commons link beyond the `maintainer`-can-do-both default assumed above — expected to get refined once the four seed projects are actually in use.
- Whether a self-hosted instance can ever join live federation later, versus staying async-only permanently.

## Implementation plan

1. **Phase 1** (this RFC's immediate follow-up): schema migration for the tables above; seed the four projects with their trunk branches.
2. **Phase 2**: retrofit the existing literature/schema dashboard pages to be project-scoped.
3. **Phase 3**: branch UI (fork/promote), portfolio UI (Cytoscape network view + card view — Eva KGDJ has no card view, so this is net-new).
4. **Phase 4**: project base-link configuration UI; the ConceptBase import pipeline (first, since its schema is most mature); PR-generation for contribution.
5. **Phase 5**: Commons/federation design and implementation.
