# pennsylvania-lpm — Governance

**Status:** Sandbox / pre-RFC. This repo is **not yet** a ConceptBase-governed
Foundational Repo under `openevo-core`'s RFC process. Nothing here has a
permanent, ecosystem-wide identifier yet. Ecosystem-wide conventions (the
RFC process itself, cross-repo id resolution once this repo is proposed for
adoption) are set by
[`openevo-core/GOVERNANCE.md`](https://github.com/openevo-ccs/openevo-core/blob/main/GOVERNANCE.md);
this document covers only what's specific to `pennsylvania-lpm` today.

This repo's architecture is a deliberate structural mirror of
[`../florida-lpm/GOVERNANCE.md`](../florida-lpm/GOVERNANCE.md),
[`../../../nys_lp/GOVERNANCE.md`](../../../nys_lp/GOVERNANCE.md),
[`../../../deutsche_lp/GOVERNANCE.md`](../../../deutsche_lp/GOVERNANCE.md), and
[`../india-lpm/GOVERNANCE.md`](../india-lpm/GOVERNANCE.md) — same
verification discipline, same lifecycle states, same identifier shape — so
all five repos stay genuinely comparable rather than diverging into
incompatible conventions. Differences are noted explicitly below and in
`schema/`'s own descriptions; anything not called out as different should be
assumed identical in spirit.

## Founding scope (2026-10-20)

Founded to document Pennsylvania's K-12 evolution-education policy history
as a direct companion to `florida-lpm`, built the same session. Pennsylvania
is the site of **Kitzmiller v. Dover Area School District** (2005) — the
single most consequential evolution-education court case in US history: in
October 2004 the Dover Area School District board voted to require a
disclaimer statement about "intelligent design" be read to ninth-grade
biology students before the evolution unit; eleven parents sued; a six-week
federal trial before Judge John E. Jones III (US District Court, Middle
District of Pennsylvania) ran September-November 2005; all eight
pro-intelligent-design board members up for reelection were defeated at the
polls on November 8, 2005, before the ruling came down; and on December 20,
2005, Judge Jones ruled that intelligent design is not science, is a form of
creationism, and that the board's policy violated the Establishment Clause —
a ruling the new board did not appeal. See `docs/source-notes/` for the full
sourced research this repo's founding session produced, and `README.md` for
what's populated as of founding vs. left for a later pass.

## Why this case is a genuinely different shape than Florida's

`florida-lpm` documents a **state-level** story: one authority (the State
Board of Education) repeatedly re-adopting and re-wording the same standard
across decades, resolved each time by a subsequent vote or a later
standards-review process. Pennsylvania's central episode is structurally
different on every axis:

- **The mandate was never state-level.** Dover's policy was a single
  school district's own board action — real, binding, and quotable, but
  binding roughly 3,500 students, not 2.8 million. `schema/institutional-mandate-record.schema.json`
  gained a `school-district-policy` mandateType value here specifically to
  model this, a level none of the four sibling repos' own mandates needed.
- **It was resolved by litigation, not by a subsequent vote.** The dispute
  ended when a federal court ruled the policy unconstitutional, not when a
  board readopted different wording. `policy-controversy-record.controversyType`
  already had a `litigation` value (added at florida-lpm's founding without
  a case yet to use it on) — Pennsylvania's is the first repo to actually
  populate a controversy record of that type.
- **It is a single, extremely well-documented episode, not a recurring
  thirty-year pattern.** Where Florida's `recurrenceOf` field chains four
  episodes across eighteen years, Pennsylvania's single episode needed no
  equivalent chain as of this founding session — though PA's own *separate*
  state-level science standards (distinct from Dover's district-level
  policy) may have their own, less dramatic history worth a coherence-finding
  pass; see `docs/source-notes/` for what this session found.

## Schemas adopted unchanged from florida-lpm

`schema/policy-controversy-record.schema.json` (the tenth, ecosystem-wide
schema first authored at florida-lpm's founding) and the four added
`policy-timeline-event.eventType` values (`court-ruling`, `public-hearing`,
`school-board-action`, `advocacy-campaign`) are adopted here with this
repo's own `PALP-` id prefix, unchanged in shape — exactly the "designed to
be adopted unchanged by any sibling repo that later needs it" case
`florida-lpm/GOVERNANCE.md` anticipated. The one addition THIS repo
contributes back is `institutional-mandate-record.mandateType`'s new
`school-district-policy` value (see above) — not yet back-ported into
`florida-lpm`'s own schema copy, since Florida's own story never needed it,
but available for any future repo whose central mandate also turns out to
be district-level rather than state-level.

## Verification status — the load-bearing concept in this repo

Distinct from the ecosystem's usual `provenance.review_status`
(`author-draft` → `peer-nominated` → `community-reviewed` →
`expert-validated` → `deprecated`), every `local_policy`/`national_ccs_policy`
record in this repo also carries a `verificationStatus`:

| Value | Meaning |
|---|---|
| `unverified-secondary-source` | Derived from a source not independently checked against an official primary document, trial record, or the court's own published opinion. |
| `primary-source-confirmed` | Checked directly against a primary or directly-fetched named source (the court's own published opinion, the Dover board's own meeting minutes/policy text as quoted in the trial record, PDE's own published standards text, a named outlet's article read in full with a URL recorded). |
| `verified` | Confirmed via primary source AND, where the record concerns a live institutional relationship or named individual, independently cross-checked as current on a date *later* than the initial research pass. |

`ccs_policy`-equivalent policy-principle records use the ordinary
`review_status` field instead — they're authored positions, not factual
claims about external institutions.

## Media coverage and the press — a distinct, lighter-weight discipline

Same rule as `florida-lpm`: `policy-controversy-record.mediaCoverage`
entries are about real, copyrighted journalism, not government or court
text. The default tier is `citation-only` (outlet + headline + url, no
quoted text) unless a short, clearly-bounded, attributed quotation is
genuinely needed. A federal court's own published opinion, by contrast, is a
public judicial record and can be quoted directly at `full-text-stored`
where the quote is load-bearing for a record's claim.

## Synthetic content — a third, orthogonal axis

Same rule as `deutsche_lp`/`nys_lp`/`india-lpm`/`florida-lpm`:
`schema/synthetic-curriculum-redesign-record.schema.json` records
(`PALP-SYNTHETIC-*`) propose hypothetical redesigns, marked
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

**Provisional, repo-local, not ecosystem-permanent:** `PALP-<TYPE>-<slug>`,
e.g. `PALP-ACTOR-dover-area-school-district`,
`PALP-EVENT-kitzmiller-v-dover-ruling`,
`PALP-CONTROVERSY-dover-intelligent-design-disclaimer`. Types in use as of
founding: see `README.md` for the actual populated set once this founding
session's records are written. Types defined but not necessarily populated:
`ACTOR`, `EVENT`, `MANDATE`, `FINDING`, `CONTROVERSY`, `PRINCIPLE`,
`CROSSWALK`, `LATENT`, `BRIEF`, `SYNTHETIC`.

## Independent versioning

Each record type versions independently using semver (`provenance.version`),
same convention as sibling repos.

## Tooling

`scripts/validate_records.py` (ported from `florida-lpm`'s script of the
same name, generalized to the `PALP` id prefix): walks every
`$schema`-declaring YAML file in the repo, validates each record against its
declared JSON Schema, checks every cross-reference field resolves to a real
id somewhere in the repo, and flags duplicate ids. Run it after adding or
editing any record:

```
python scripts/validate_records.py
```

Requires `pyyaml` and `jsonschema`. No CI workflow runs it automatically yet
— still a manual step before committing new/changed records.

## Relationship to deutsche_lp, nys_lp, india-lpm, and florida-lpm

Five sibling repos (this one living inside `openlpm/curriculum-sources/`
rather than as a standalone repo, matching `india-lpm`'s and `florida-lpm`'s
precedent), one shared architecture, genuinely different governance and
political landscapes each worth keeping legible on its own terms rather than
flattened into one undifferentiated "US evolution-education politics"
bucket — see
`lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
for the original three-way comparison this repo's structure extends to a
fifth case, and `florida-lpm/GOVERNANCE.md` for the fourth.
