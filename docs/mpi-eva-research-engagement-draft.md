# MPI-EVA Research & Department Engagement — draft project shape

**Status:** Draft design note. Nothing described here has been built, reviewed by Dustin, reviewed by any MPI-EVA department, or applied to a real database. Prepared on branch `draft/mpi-eva-research-engagement-prep`, in an isolated worktree, specifically so it doesn't collide with anyone using the main OpenLPM checkout.

**Working title:** `mpi-eva-research-engagement-draft`. Deliberately not `eva-lpm` — that name, and the decision it's tied to (whether eva-graph's own draft curriculum content gets migrated into ConceptBase or formally retired), belong to a different, still-open question this document doesn't touch. See the last section for how the two are kept apart.

## What this would be

A future OpenLPM project that lets a researcher — and eventually a teacher — look up what each of the Max Planck Institute for Evolutionary Anthropology's seven departments actually studies right now: who leads the work, what theories and methods it uses, what's currently open or contested, and what's been published recently. Someone could browse a department's real content the way OpenLPM already lets a project browse curriculum concepts, and leave a comment or question against any of it, using mechanisms (Discussions, Notebooks, Theories) OpenLPM already has.

This document works out what shape that project would need in OpenLPM's real data model before anyone signs up, imports anything, or turns it on.

## Source material: mpi-eva-graph, not invented content

Every claim below is read directly from `D:\dev\openevo-ccs-lab\eva-graph\mpi-eva-graph\`, not summarized from memory or made up to fill out an example. The seven departments, each with its own `theories`/`domains`/`methods`/`topics`/`scicomm_sensitivities` node files and an `edges.json`:

| Code | Department | Theories | Domains | Methods | Topics | Scicomm |
|---|---|---|---|---|---|---|
| HBEC | Human Behavior, Ecology and Culture | 12 | 11 | 8 | 10 | 2 |
| HumOr | Human Origins | 6 | 6 | 8 | 6 | 2 |
| DLCE | Linguistic and Cultural Evolution | 6 | 10 | 8 | 13 | 2 |
| DAG | Archaeogenetics | 6 | 6 | 6 | 5 | 3 |
| CCP | Comparative Cultural Psychology | 5 | 6 | 5 | 5 | 3 |
| EvoGen | Evolutionary Genetics | 7 | 7 | 9 | 8 | 4 |
| PrimEvo | Primate Behavior and Evolution | 7 | 9 | 8 | 8 | 3 |

Real current directors and research groups are already recorded: Richard McElreath (HBEC), Tracy L. Kivell since February 2023 (HumOr), Johannes Krause (DAG, 2026 Leibniz Prize), Daniel Haun since 2019 (CCP), Svante Pääbo (EvoGen, 2022 Nobel Prize), Jenny Tung since 2022 (PrimEvo — the dataset originally had this wrong and was corrected). Each department's "Current research" section names specific groups and cites real, DOI-linked 2020–2026 papers rather than generic topic labels — for example DAG's plague-genomics and treponemal-disease-origins work (Spyrou et al. 2022, *Nature*; Barquera et al. 2024/2025, *Nature*), EvoGen's Neanderthal-introgression and COVID-19-haplotype findings (Zeberg & Pääbo 2020/2021), CCP's cross-cultural norm-enforcement study across eight societies (Kanngiesser, Schäfer, Haun, Tomasello et al. 2022, *PNAS*), and PrimEvo's Pan African Programme / Chimp&See citizen-science platform. Eleven real, geolocated field sites (Taï National Park, Amboseli, Ranis, Swartkrans, Bili-Uele, and others) sit alongside the department content.

A shared institute-level layer (`eva_institute/`) pulls out ten cross-department nodes (e.g. selection and adaptation, cultural transmission, cooperation and fairness) plus a department-history/lineage record, built by actually tracing which theories and topics recur across department boundaries rather than assuming overlap. The whole graph — 189+ department nodes plus the institute layer — is a single connected component with no isolated nodes as of the last network-analysis pass, and 16 nodes already carry a real, checked crosswalk to OpenEvo ConceptBase concept ids (`OE-CONCEPT-*` / `OE-SANDBOX-CONCEPT-*`).

One fact matters more than any of the content above: **every node in mpi-eva-graph carries `provenance.status: "draft"`.** It's curator-drafted from open-web research and published sources, not yet checked by anyone actually in the department. Each department's own README says this plainly and asks for correction. Any OpenLPM project built on this material has to carry the same caveat as visibly as OpenLPM already shows its epistemic-status and maturity badges — this is unreviewed material about real people and real departments, not settled department output, and should never be presented as if a department signed off on it.

## Where this content would actually come from, technically

`mpi-eva-graph` lives in `eva-graph`, a **private** repository (confirmed live via `gh repo view`). It is not one of the OpenEvo ecosystem's ten Foundational Repos (ConceptBase, TheoryBase, QuestionBase, LiteratureBase, CompetencyBase, MethodsBase, QuoteBase, HumanBase, ProjectBase, TeachingBase), so it has no entry in `project_base_links.base_repo` and shouldn't get one — that mechanism (RFC-0002 §5) is specifically for the ecosystem's shared base repos, and `mpi-eva-graph` is itself a Project-kind graph repo, the same category of thing OpenLPM already pulls curriculum content from directly.

The real fit is the mechanism migration `019_standards_and_project_scope.sql` already built for exactly this case: `project_source_declarations` — "what's being imported, in what format, and confirmation of rights to use it." Seven rows, one per department, each naming `mpi-eva-graph` as the source.

That also means pulling any of this in, even in draft form, isn't a live automated fetch. A private source repo can't be read from a browser the way OpenLPM's ConceptBase importer reads a public one — the same constraint the standing OpenLPM↔OpenEvo compatibility roadmap already found for TheoryBase and LiteratureBase applies here too. It would take a maintainer with real local read access to `eva-graph` doing a manual, curator-checked pass: picking specific theory, topic, and literature nodes and copying them into OpenLPM's own tables, not an automatic sync.

## How this maps onto OpenLPM's real tables today

OpenLPM's project model has moved on since RFC-0002 first proposed it — "branch" as a draft/fork mechanism was folded into a nested-Project model in migrations 015–016, and a real "Start new project" wizard (`src/pages/dashboard/new-project-wizard.tsx`) now collects geography, language, subject area, grade bands, and source declarations up front. This draft is scoped against that current shape, not the original RFC text alone.

- **`projects`** — one row: slug `mpi-eva-research-engagement-draft`; `status: planning`; `epistemic_status: in-development` (real content, not a synthetic comparison object like `bio-core-k12`, but not yet field-validated or department-reviewed either — OpenLPM's own local third value exists for exactly this case); `maturity: draft`; `focus_type: thematic`; no `parent_project_id` — nothing among OpenLPM's existing projects (EvoMentor, Sachsen Biologie, the two synthetic K-12 LPMs) is a natural parent for institute-wide research content, so this would start as its own Project Space, not a sub-project.
- **`project_source_declarations`** — seven rows, one per department, each pointing at `mpi-eva-graph/sub-units/<dept>/` and carrying the same "private repo, curator-drafted, not department-reviewed" rights note.
- **`project_base_links`** — one row: `conceptbase`, `can_import: true`, `can_propose_pr: false`. ConceptBase is the only Foundational Repo actually public today; this project has no standing yet to contribute anything back anywhere.
- **No grade-band framework, no jurisdiction rows.** This isn't jurisdiction-sequenced K-12 standards content, at least not in this first phase, so `grade_framework_id` and `project_jurisdictions` stay empty — a genuinely different shape from every one of OpenLPM's existing seed projects, which are all standards- or LPM-shaped.
- **Existing tabs, not new ones.** Theories (seeded from each department's `theories.json` plus the shared institute-level theories), Literature (seeded from the real DOI-cited papers already named in each department's "Current research" section — not a full literature review, matching the honesty of the source graph itself), Discussions (open against any of it immediately, using the review/discussion mechanism already generalized to theories and framework tags), Notebooks (a researcher's own working notes), and Concepts only where a real ConceptBase crosswalk already exists — 16 real links, not invented ones. There's no native "department" entity in OpenLPM's schema, and this project doesn't need one invented for it: each source declaration already marks the department boundary.

## Two audiences, two phases

**Phase A (what this document scopes): researcher-facing.** A colleague can look up what a specific department works on right now, who leads it, what it's recently published, and leave a comment or question against any of it.

**Phase B (out of scope here): teacher-facing.** A simplified layer for the pieces that genuinely work in a classroom, most likely reached through the content that already has a real ConceptBase link rather than raw research detail. This stays out of scope until Phase A content has actually had a department member look at it — turning unreviewed research description into classroom material without that step would compound the review gap, not just carry it forward.

## What's explicitly not done here

No Supabase project touched, real or otherwise. No account created. No project row inserted anywhere live. No content imported from `mpi-eva-graph` — the accompanying SQL file creates an empty project shell and its source declarations only, not any theory or literature content. No public listing, no announcement to MPI-EVA or anyone else.

## Kept separate from the eva-lpm decision

`eva-lpm` was removed from OpenLPM's seed projects on 2026-09-06 specifically because seeding it would have pre-empted eva-graph's own open call on its draft curriculum content (finish migrating it into ConceptBase, or retire it) — a decision that's still Dustin's to make and still unmade. This document is about a different thing: MPI-EVA's seven research *departments*, not eva-graph's curriculum strand content, and a project name that can't be confused with the retired one. Nothing here answers, narrows, or assumes an answer to that open question.

## Real decisions still open for Dustin

1. **Whether MPI-EVA department content should ever be shown outside a small trusted group at all.** `mpi-eva-graph` already flags real sensitivities that need deliberate handling before any wider release — animal research, human remains and repatriation, and the communities whose data the research draws on. That's an institute-level judgment call, not a schema question, and this document doesn't try to make it.
2. **Whether it's worth asking a real contact in each department to sanity-check their section** before this goes any further than a small-group draft — every line of the source content is explicitly self-labeled as unreviewed.

## Files in this draft

- `docs/mpi-eva-research-engagement-draft.md` — this document.
- `supabase/migrations-draft/DRAFT-mpi-eva-research-engagement-seed.sql` — an unapplied SQL sketch of the rows described above, in the same bootstrap seed style as migrations `005` and `008`, kept out of `supabase/migrations/` on purpose so it can't be picked up by ordinary migration tooling. See its own header for why and for what running it for real would actually require.
