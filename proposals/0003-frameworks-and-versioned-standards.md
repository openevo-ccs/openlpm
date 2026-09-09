# RFC 0003 — Cross-cutting frameworks, versioned standards, and comparison

**Status:** Accepted — Dustin Eirdosh, 2026-09-06, live session.
**Date:** 2026-09-06

## Motivation

RFC 0002 gave OpenLPM projects/branches/portfolios and a path to import ConceptBase-shaped curriculum content. It didn't give OpenLPM two things every real ingestion session immediately needs, confirmed concretely this session against a live example (Thuringia's new 2026 Biologie Gymnasium Erprobungsfassung, arriving alongside a hand-authored Basiskonzepte taxonomy CSV):

1. **A first-class way to model a cross-cutting conceptual framework** (German Biologiedidaktik's Basiskonzepte, NGSS's Cross-Cutting Concepts, or any project's own custom taxonomy) as a *versioned, crosswalkable* thing in its own right — not a flat tag list, and not silently merged into whichever version of the framework a project happened to start with. The ecosystem already has a proven shape for this (`EvoMentor/data/kmk-basiskonzepte-biologie.json`: distinct `frameworkId`s per generation, a hierarchy of tags with `parentTagId`, and a separate confidence-rated `crosswalk[]` between generations) — this RFC brings that shape into OpenLPM's own schema rather than leaving it a file only EvoMentor's Python scripts read.
2. **A way to hold more than one version of the same jurisdiction's standards side by side and compare them** — Thuringia's own 2024→2026 Lehrplan revision is a real, concrete case: some items are pure wording refinements, some are genuinely new content, one is a change to *which grades a section covers at all*. Today's schema (`lpm_data_objects`) has no notion of "this object supersedes that one" or "here's what changed and why."

Both gaps showed up immediately on the very first real ingestion attempt this RFC's data model is meant to generalize from — see `data/frameworks/basiskonzepte-taxonomie-biologiedidaktik-de-v1.json` and `data/frameworks/thuringia-biologie-gym-2024-2026-diff.json`, staged this session as plain files precisely because these tables don't exist yet.

## Decisions

### 1. Frameworks are project-scoped rows, not embedded JSON

New tables: `frameworks` (`id`, `project_id`, `framework_key` e.g. `kmk-basiskonzepte-biologie-2024`, `label`, `source`, `version_note`) and `framework_tags` (`id`, `framework_id`, `tag_key`, `label`, `parent_tag_id` self-referencing FK, `definition`, `sort_order`). A tag's `parent_tag_id` gives the same arbitrary-depth hierarchy `kmk-basiskonzepte-biologie.json` already needed (Basiskonzept → Unterkonzept1 → Unterkonzept2, three real levels in the newly-staged taxonomy, not the two EvoMentor_DE's own JSON-nesting pattern caps at).

`project_id` makes a framework project-scoped by default (matching the 2026-09-06 decision to keep the new Basiskonzepte taxonomy project-local rather than a ConceptBase contribution) — nullable to allow a small number of ecosystem-shared frameworks (the real KMK generations) to be seeded once and referenced by any project, rather than every project re-importing its own copy.

### 2. Crosswalks are their own table, never a silent overwrite

New table `framework_crosswalks` (`from_tag_id`, `to_tag_id`, `confidence` — `exact | approximate | structural | none`, `note`). Two tags sharing a literal id/key across frameworks (the convention EvoMentor's crosswalk file already uses for e.g. `bk_struktur_funktion` appearing unchanged across both KMK generations) need no row here — the shared key *is* the correspondence; this table is only for tags that genuinely differ in id but relate in content. A `confidence: none` row (like EvoMentor's own `bk_organisationsebenen -> []`) is a legitimate, real assertion — "considered and found no counterpart" — not an omission.

### 3. Standards get real version lineage

New table `standards_documents` (`id`, `project_id`, `jurisdiction`, `subject`, `school_type`, `grade_range`, `version_label`, `source_file`, `supersedes_document_id` self-FK, `adopted_at`). `lpm_data_objects` (already existing, RFC 0002) gains `standards_document_id` so an ingested learning objective always knows which document-version it came from. A learning objective doesn't need its own supersession pointer — that's derived from which document it belongs to plus the item-level diff table below, not duplicated onto every row.

### 4. Version comparison is structured data, not a one-off script output

New table `standards_item_changes` (`id`, `from_item_id`, `to_item_id` — either nullable, for pure additions/removals — `change_type`, `note`). `change_type` is an open, growing enum seeded from real categories found this session (`content-added`, `content-removed`, `wording-refinement`, `wording-simplification`, `example-changed`, `restructured`, `grade-band-split`) rather than a single generic "modified" — the Thuringia 2024→2026 diff needed all seven to describe its 17 real changes honestly, and collapsing them would have hidden which changes are substantive (added/removed/restructured) versus cosmetic (wording-refinement).

### 5. Framework relevance is a join table, not required fields on every item

EvoMentor_DE's `basiskonzeptbezug[]` (exactly 6 entries, one per Basiskonzept, always present, each requiring a written justification even at low relevance) is genuinely valuable — its own lessons-doc calls it richer than anything in the ecosystem's other schemas — and the chosen ambition for OpenLPM is to support that full depth, not a stripped-down version. But its own lessons-doc also flags it as possibly unaffordable at multi-jurisdiction scale if *every* item must rate *every* tag in *every* linked framework.

Resolution: a new table `standards_item_framework_relevance` (`item_id`, `framework_tag_id`, `relevance` 1-3, `justification`, `related_tag_ids[]`) holds exactly this shape, but nothing requires a row for every (item, tag) pair — exhaustiveness is a per-project authoring choice enforced by review workflow/UI, not a schema constraint, so a small pilot project can populate it sparsely while EvoMentor's full Thuringia migration can populate it exhaustively, without two different schemas.

## New data model (summary; migration TBD pending review)

`frameworks`, `framework_tags`, `framework_crosswalks`, `standards_documents`, `standards_item_changes`, `standards_item_framework_relevance`. `lpm_data_objects` gains `standards_document_id`.

## Explicitly not yet decided

- Whether `frameworks`/`framework_tags` should also be a valid target for `portfolio_items` (can a user pin a Basiskonzept into their personal portfolio the way they can a concept today?) — likely yes, deferred to avoid conflating this RFC's scope.
- Whether `standards_item_changes` needs its own review/approval workflow (peer_review_assignments already exists for other content) before a diff is considered "confirmed" versus machine/LLM-suggested.
- Exact seeding mechanism for the small set of ecosystem-shared (non-project-scoped) frameworks — likely a `NULL project_id` row visible to all, but the RLS implications need the same care migration 004's helper functions got.

## Implementation plan

1. Review of this proposal.
2. Migration: the six new objects above, RLS following migration 004's project-membership pattern.
3. Import path for the two files already staged this session (`data/frameworks/*.json`) as the first real rows, once the schema exists — proving the model against real content before anyone else's.
4. UI: framework hierarchy browser + crosswalk view, version-compare view (`app/dashboard/[project]/standards/`).
