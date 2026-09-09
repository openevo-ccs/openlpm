# RFC 0004 — Portfolio discovery, collaborative portfolios, and Commons

**Status:** Accepted — Dustin Eirdosh, 2026-09-06, live session.
**Date:** 2026-09-06

## Motivation

RFC 0002 gave every user unlimited named portfolios per project, referencing canonical content rather than copying it. It didn't give portfolios any way to be *found* by other members, any way for more than one person to jointly edit one, or any way for two projects to relate to each other — Commons was explicitly deferred to "once 2+ real projects exist to federate against each other."

That trigger condition is now real, not hypothetical: **EvoMentor** (thematic, cross-jurisdiction — evolutionary-coherence framing) already pulls a Sachsen Biology evolution-focused subset via its own importer pipeline, while **sachsen-biologie** (geographic, jurisdiction-first — 2026-09-06) aims to hold the *complete* Sachsen Biology curriculum. Both have a legitimate claim on the same underlying content for different purposes. Separately, a geographic/community project (e.g. a future `thuringia-biologie`) needs individual teachers to discover and learn from each other's portfolios, and in some cases jointly maintain one (a department team), neither of which today's schema supports.

Per the 2026-09-06 discussion that motivated this RFC: no new `project_kind` (thematic vs. geographic) distinction is being introduced — a project stays one flexible shape either way. What's missing is (1) making a project's scope *queryable*, (2) letting portfolios be discovered and jointly edited, and (3) a real cross-project reference mechanism.

## Decisions

### 1. Projects get structured scope fields, not just prose

`projects` gains `jurisdiction` (nullable, ISO-3166-2-style, e.g. `DE-TH`), `subject` (nullable, e.g. `Biologie`), `school_type` (nullable, e.g. `Gymnasium`). Null for genuinely cross-jurisdiction thematic projects (EvoMentor's trunk); set for jurisdiction-first ones (`sachsen-biologie`: `DE-SN`/`Biologie`/`Gymnasium`). This is purely additive metadata — nothing about how a project's own content/branches/portfolios work changes — but it's what makes "browse projects near me" and "suggest a Commons link between adjacent jurisdictions" possible instead of parsing free text.

**`school_type` is required to be honest, not defaulted.** `deutsche_lp`'s own research (2026-08-24) found every one of its and EvoMentor_DE's prior findings had been silently Gymnasium-only, despite roughly two-thirds of German students being on a different track (Regelschule/Oberschule/Sekundarschule). A geographic project's `school_type` must state its actual scope plainly — "Gymnasium" is a real, honest, narrower answer, not a default nobody questioned.

**`projects` also gains `policy_grounding_refs TEXT[]`** (informal `DELP-*` id citations into `deutsche_lp`, e.g. `DELP-MANDATE-sachsen-massnahme-2-2-faecherverbindender-unterricht`) and **`region_tags TEXT[]`** (freeform regional groupings, e.g. `{MDR}` for the Sachsen/Sachsen-Anhalt/Thüringen collaboration case `deutsche_lp` already names) — both following the exact `projectbase_ref` precedent from RFC 0002 (a soft string, deliberately not a foreign key): `deutsche_lp`'s own `GOVERNANCE.md` states its `DELP-*` ids are "provisional, repo-local, not ecosystem-permanent" and may be re-minted if it's ever adopted as a real Foundational/Project repo, so a hard reference would be a real future breakage, not just excess caution.

### 2. Portfolio discovery is mostly a UI gap, not a schema gap

The RLS policy a portfolio already needs for this ("Members can view shared or project-visible portfolios," migration 004) already covers browsing — a portfolio owner sets `visibility: project` and any project member can already see it. The only schema addition is `portfolios.context_tags TEXT[] DEFAULT '{}'` (freeform — `{"Klasse 9", "Gymnasium"}` — no controlled vocabulary imposed yet) so a gallery view can filter by grade/class-context instead of listing every project-visible portfolio undifferentiated. New UI: a gallery route showing other members' project/shared-visibility portfolios, filterable by tag.

### 3. Collaborative co-editing — SUPERSEDED by RFC 0006

*(Correction, 2026-09-06): the `can_edit` boolean approach below turned out to be the wrong shape once the same question came up for Eva KGDJ and Dustin clarified what real collaborative curation actually needs — opt-in, role-gated participation with propose/review/decide workflow and provenance, not direct write access via a flag. See `proposals/0006-commons-spaces.md`, a joint design with the KGDJ session, for the real mechanism. Left below for history, not implemented as written.)*

~~`portfolio_shares` (migration 004) already grants a specific named member `can_review` access to an otherwise-private portfolio. Adding `can_edit BOOLEAN NOT NULL DEFAULT FALSE` alongside it, plus RLS policies on `portfolio_items`/`portfolio_private_nodes`/`portfolio_links` extending write access to any member with a `can_edit` share (not just the owner), turns this into real joint ownership without inventing a "team" entity — a department's shared portfolio is just a portfolio with several `can_edit` shares. No change to the one-`owner_id`-per-portfolio shape; the owner is whoever created it, edit rights are a grant like any other.~~

### 4. Commons: permission grants + reference-not-copy, mirroring mechanisms OpenLPM already has

Two new tables, each reusing a shape this repo already proved out rather than inventing new vocabulary:

- **`project_commons_links`** (`id`, `from_project_id`, `to_project_id`, `can_reference`, `can_propose_tags_back`, `created_by`, `created_at`) — mirrors `project_base_links`' `can_import`/`can_propose_pr` shape exactly, one level up: instead of a project linking to a foundational base repo, it links to *another OpenLPM project*. Granted by `to_project_id`'s maintainers (the project being referenced *from* — e.g. sachsen-biologie's maintainers grant EvoMentor the right to reference sachsen-biologie's items). Unlike RFC 0002 §5's "import is unrestricted for any public base repo," a Commons grant is **not** automatic just because both projects exist — project content can include pre-publication or personal framing a base repo's public registry doesn't have, so an explicit grant is required in both directions before any reference can be created.
- **`commons_item_references`** (`id`, `referencing_project_id`, `referencing_branch_id` nullable, `source_project_id`, `source_item_id` FK into `lpm_data_objects`, `local_annotation`, `local_framework_tags` JSONB, `created_by`, `created_at`) — mirrors `portfolio_items`' reference-not-copy pattern exactly, one level up: instead of a personal portfolio referencing a project's canonical item, another *project* references it, adding its own local framing (EvoMentor's `evolutionsdidaktischer_impuls`-style annotation) without copying or forking the base item's own fields. Deleting or editing the source item is the source project's business; a dangling reference is surfaced, not silently duplicated data quietly drifting out of sync.

## New data model (summary; migration TBD pending review)

`projects` gains `jurisdiction`/`subject`/`school_type`/`policy_grounding_refs`/`region_tags`. `portfolios` gains `context_tags`. New tables: `project_commons_links`, `commons_item_references`. (§3's `portfolio_shares.can_edit` is superseded by RFC 0006 — not part of this RFC's actual data model anymore.)

## Explicitly not yet decided

- Whether a `commons_item_references` row needs its own review/approval step before it's considered stable, versus being immediately live once `can_reference` is granted.
- Whether `can_propose_tags_back` (a referencing project suggesting its local annotation get absorbed into the source project's own canonical record) is in scope now or a later RFC — named here so the column exists, but no workflow is designed yet.
- Whether the portfolio gallery should ever span *across* projects (e.g. browse all `DE-TH` teachers regardless of which specific project they're in) — deferred; today's gallery is single-project only, which matches the concrete Thuringia-community case but may not generalize.

## Implementation plan

1. Review of this proposal.
2. Migration: the additions above, RLS extensions for `can_edit`.
3. UI: portfolio gallery (filter by `context_tags`), a "invite collaborator" flow surfacing `can_edit` alongside the existing `can_review` share, a Commons link management view (grant/revoke between two projects), a reference-picker for pulling a Commons-linked item into a project with local annotation.
4. Concrete first real Commons pairing: `sachsen-biologie` ⇄ `EvoMentor` trunk, once both exist as real linked rows — proving the model against the actual overlap that motivated this RFC, not a synthetic test case.
