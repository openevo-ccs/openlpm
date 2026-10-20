# florida-lpm — Governance

**Status:** Sandbox / pre-RFC. This repo is **not yet** a ConceptBase-governed
Foundational Repo under `openevo-core`'s RFC process. Nothing here has a
permanent, ecosystem-wide identifier yet. Ecosystem-wide conventions (the
RFC process itself, cross-repo id resolution once this repo is proposed for
adoption) are set by
[`openevo-core/GOVERNANCE.md`](https://github.com/openevo-ccs/openevo-core/blob/main/GOVERNANCE.md);
this document covers only what's specific to `florida-lpm` today.

This repo's architecture is a deliberate structural mirror of
[`../../../nys_lp/GOVERNANCE.md`](../../../nys_lp/GOVERNANCE.md),
[`../../../deutsche_lp/GOVERNANCE.md`](../../../deutsche_lp/GOVERNANCE.md), and
[`../india-lpm/GOVERNANCE.md`](../india-lpm/GOVERNANCE.md) — same
verification discipline, same lifecycle states, same identifier shape — so
all four repos stay genuinely comparable rather than diverging into
incompatible conventions. Differences are noted explicitly below and in
`schema/`'s own descriptions; anything not called out as different should be
assumed identical in spirit.

## Founding scope (2026-10-20)

Founded to document Florida's K-12 science-curriculum policy history as it
relates to teaching evolution — from the 1996 Sunshine State Standards
through the 2008 Next Generation Sunshine State Standards (NGSSS) adoption
fight, the 2017 instructional-materials-objection statute, the 2019-2020
B.E.S.T. Standards rewrite, and the 2026 proposed-standards rewrite covered
by NCSE
([ncse.ngo/florida-opens-pandoras-box-educational-horrors-proposed-new-science-standards](https://ncse.ngo/florida-opens-pandoras-box-educational-horrors-proposed-new-science-standards)).
See `docs/source-notes/` for the full sourced research this repo's founding
session produced, and `README.md` for what's populated as of founding vs.
left for a later pass.

## The one real structural addition this repo contributes back — `policy-controversy-record`

Florida's case surfaced a gap in the shared nine-schema family every sibling
repo until now used unchanged: none of the nine record types directly model
a **named public controversy** — multiple actors taking opposing positions,
real press coverage, and a tracked (or unresolved) outcome. `nys_lp`'s
Portrait of a Graduate reform and `deutsche_lp`'s/`india-lpm`'s comparative
licensing/coverage findings are genuinely different in kind: Florida's
evolution-education history is made of recurring, decades-spanning public
fights, not just policy-text facts. `schema/policy-controversy-record.schema.json`
is the tenth schema, first authored here, designed to be adopted unchanged
(same shape, repo's own id prefix) by any sibling repo that later needs it —
`india-lpm`'s own Kerala-vs-NCERT evolution-content-retention dispute
(already described in prose in `india-lpm/state/kerala/README.md`) is a
clear future candidate, not yet formalized as a record under this schema
pending a dedicated pass in that repo.

`schema/policy-timeline-event.schema.json`'s `eventType` enum also gained
four new values here (`court-ruling`, `public-hearing`, `school-board-action`,
`advocacy-campaign`) — generic enough to belong in the shared base
vocabulary, not Florida-specific, but not back-ported into the other three
repos' own schema copies in this founding session (that's a mechanical,
low-risk follow-up, not attempted here to keep this session's scope to
Florida's own content).

## A machine-readable standards layer the other three repos don't have yet — `case/`

Florida's founding-session research (`docs/source-notes/`) found that CPALMS
(Florida's official standards repository, run by the University of South
Florida) is reportedly a 1EdTech Contributing Member publishing Florida's
standards via the CASE (Competencies & Academic Standards Exchange) format
through the 1EdTech CASE Network — but this repo's own research could not
get that specific registry (`casenetwork.1edtech.org`/`rosetta.commongoodlt.com`)
to render Florida's content directly (JavaScript-rendering wall in automated
fetches). A second, separate lead — the Common Standards Project API
(`api.commonstandardsproject.com`) — is a plain REST endpoint, not
JS-rendered, and direct `curl` calls against it (same founding session, no
browser involved) confirmed it live: the complete, exact text of all 15
`SC.912.L.15` (evolution) benchmarks, independently CC BY 3.0 US licensed.
`case/` holds files conforming to `openevo-graph/schema/case_schema.json`
(already a real IMS CASE v1.0 schema in this ecosystem, unused by any state
repo until now), transformed from that confirmed-live source rather than
hand-typed from a secondary mirror. See `case/README.md` for the full
detail and the one open item still worth a human's ~10 minutes in a real
browser — whether CPALMS's own *native* CASE Network feed is also live,
separately from the Common Standards Project data that is now confirmed.

## Verification status — the load-bearing concept in this repo

Distinct from the ecosystem's usual `provenance.review_status`
(`author-draft` → `peer-nominated` → `community-reviewed` →
`expert-validated` → `deprecated`), every `local_policy`/`national_ccs_policy`
record in this repo also carries a `verificationStatus`:

| Value | Meaning |
|---|---|
| `unverified-secondary-source` | Derived from a source not independently checked against an official primary document — a news article's own characterization of what a standard says, a secondary summary, a search-result snippet. |
| `primary-source-confirmed` | Checked directly against a primary or directly-fetched named source (FLDOE's/CPALMS's own published standards text, the actual statutory text on the Florida Legislature's own site, a named outlet's article read in full with a URL recorded) with a URL recorded. |
| `verified` | Confirmed via primary source AND, where the record concerns a live institutional relationship or named individual (a current State Board member, a current FLDOE official), independently cross-checked as current on a date *later* than the initial research pass. |

`ccs_policy`-equivalent policy-principle records use the ordinary
`review_status` field instead — they're authored positions, not factual
claims about external institutions.

## Media coverage and the press — a distinct, lighter-weight discipline

`policy-controversy-record.mediaCoverage` entries are about real, copyrighted
journalism, not government text. The default tier is `citation-only`
(outlet + headline + url, no quoted text) unless a short, clearly-bounded,
attributed quotation is genuinely needed, in which case `excerpt-only`
applies — never `full-text-stored` for a news article. This is a stricter
default than this repo's own government-text discipline below, because the
legal basis is different (government-works public-record status vs.
ordinary copyright + fair use).

## Synthetic content — a third, orthogonal axis

Same rule as `deutsche_lp`/`nys_lp`/`india-lpm`:
`schema/synthetic-curriculum-redesign-record.schema.json` records
(`FLLP-SYNTHETIC-*`) propose hypothetical redesigns, marked
`contentStatus: adjacent-possible-synthetic-redesign`, and must never be
cited in outreach material as describing real, adopted policy. No records
exist under this schema as of founding.

## Lifecycle status

```
proposed → accepted → stable → deprecated → superseded
                                    ↘
                                     retracted
```

## Identifier scheme

**Provisional, repo-local, not ecosystem-permanent:** `FLLP-<TYPE>-<slug>`,
e.g. `FLLP-ACTOR-florida-state-board-of-education`,
`FLLP-EVENT-ngsss-2008-state-board-vote`,
`FLLP-CONTROVERSY-2008-ngsss-evolution-wording-fight`. Types in use as of
founding: `ACTOR`, `EVENT`, `MANDATE`, `FINDING`, `CONTROVERSY`. Types
defined but not yet populated: `PRINCIPLE`, `CROSSWALK`, `LATENT`, `BRIEF`,
`SYNTHETIC`.

## Independent versioning

Each record type versions independently using semver (`provenance.version`),
same convention as sibling repos.

## Tooling

`scripts/validate_records.py` (ported from `nys_lp`'s/`india-lpm`'s script of
the same name, generalized to the `FLLP` id prefix): walks every
`$schema`-declaring YAML file in the repo, validates each record against its
declared JSON Schema, checks every cross-reference field resolves to a real
id somewhere in the repo, and flags duplicate ids. Run it after adding or
editing any record:

```
python scripts/validate_records.py
```

Requires `pyyaml` and `jsonschema`. No CI workflow runs it automatically yet
— still a manual step before committing new/changed records.

## Relationship to deutsche_lp, nys_lp, and india-lpm

Four sibling repos (this one living inside `openlpm/curriculum-sources/`
rather than as a standalone repo, matching `india-lpm`'s precedent set
2026-10-09), one architecture, genuinely different governance and political
landscapes each worth keeping legible on its own terms — see
`lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
for the original three-way comparison this repo's structure extends to a
fourth case.
