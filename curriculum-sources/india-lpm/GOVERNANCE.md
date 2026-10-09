# india_lp — Governance

**Status:** Sandbox / pre-RFC. This repo is **not yet** a ConceptBase-governed
Foundational Repo under `openevo-core`'s RFC process. Nothing here has a
permanent, ecosystem-wide identifier yet. Ecosystem-wide conventions (the
RFC process itself, cross-repo id resolution once this repo is proposed for
adoption) are set by
[`openevo-core/GOVERNANCE.md`](https://github.com/openevo-ccs/openevo-core/blob/main/GOVERNANCE.md);
this document covers only what's specific to `india_lp` today.

This repo's architecture is a deliberate structural mirror of
[`../../../deutsche_lp/GOVERNANCE.md`](../../../deutsche_lp/GOVERNANCE.md) and
[`../../../nys_lp/GOVERNANCE.md`](../../../nys_lp/GOVERNANCE.md) — same verification
discipline, same lifecycle states, same identifier shape — so all three
repos stay genuinely comparable rather than diverging into incompatible
conventions. Differences are noted explicitly below and in `schema/`'s own
descriptions; anything not called out as different should be assumed
identical in spirit.

## The one real difference from deutsche_lp/nys_lp — a storage-tier discipline from day one

`deutsche_lp` and `nys_lp` added an `accessTier` field
(`full-text-stored` / `excerpt-only` / `summary-only` / `citation-only`) to
their source-quoting record types on 2026-09-30, well after both repos had
already been quoting curriculum-policy text for weeks under an implicit
"short excerpt, always cited" norm. `india_lp` was founded the same day,
directly out of the same design effort — see
`lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
— so it has the field from its very first commit, and uses it more strictly:
**every founding-session record in this repo defaults to `citation-only`**,
regardless of how much text was actually available to quote, because this
repo's own founding research
(`docs/source-notes/2026-09-30-india-curriculum-licensing-landscape-research.md`)
found India's redistribution-rights picture for NCERT/CBSE curriculum
content to be a genuinely open legal question, not a settled one the way
"German ministry press releases get quoted in secondary reporting all the
time" or "NY government publications are government works" could plausibly
be treated as defaults. See
`docs/strategy/2026-09-30-india-legal-review-scope.md` for what a real
review would need to resolve before any record's tier gets raised above
`citation-only`.

One confirmed exception exists already: Karnataka's DSERT publishes its
KOER textbooks and materials under an explicit, checkable **CC BY-SA 4.0**
license (see `state/karnataka/local_policy/records/institutional-actors.yaml`)
— a real, already-resolved case, not one waiting on the legal review. Any
future Karnataka-sourced record may cite that license directly as grounds
for a higher tier, the same way a `nys_lp` record could cite a confirmed
US-government-works determination.

## Verification status — the load-bearing concept in this repo

Distinct from the ecosystem's usual `provenance.review_status`
(`author-draft` → `peer-nominated` → `community-reviewed` →
`expert-validated` → `deprecated`), every `local_policy`/`national_ccs_policy`
record in this repo also carries a `verificationStatus`:

| Value | Meaning |
|---|---|
| `unverified-secondary-source` | Derived from a source that was not read directly by whoever wrote the record — a search-engine excerpt, a secondary summary. This repo's founding session hit this repeatedly: several .gov.in pages (epathshala.nic.in, osre.ncert.gov.in) refused automated fetch attempts, so specific claims (e.g. NCERT's DIKSHA-platform license terms) rest only on search-snippet evidence and are flagged this way. |
| `primary-source-confirmed` | Checked directly against a primary or directly-fetched named source with a URL recorded, and the actual document text was read (not just a search snippet about it). This repo's founding session read several primary PDFs directly — NCERT's own state-adoption license agreement, Maharashtra Balbharati's Revised Policy PDF — and those records start at this tier. |
| `verified` | Confirmed via primary source AND independently cross-checked as current on a date later than the initial research pass. No records in this repo have reached this tier yet. |

`ccs_policy` policy-principle records use the ordinary `review_status` field
instead — they're authored positions, not factual claims about external
institutions.

## Synthetic content — a third, orthogonal axis

Same rule as `deutsche_lp`/`nys_lp`:
`schema/synthetic-curriculum-redesign-record.schema.json` records
(`INLP-SYNTHETIC-*`) propose hypothetical redesigns, marked
`contentStatus: adjacent-possible-synthetic-redesign`, and must never be
cited in outreach material as describing real, adopted policy. No records
exist under this schema yet.

## Lifecycle status

```
proposed → accepted → stable → deprecated → superseded
                                    ↘
                                     retracted
```

## Identifier scheme

**Provisional, repo-local, not ecosystem-permanent:** `INLP-<TYPE>-<slug>`,
e.g. `INLP-ACTOR-ncert`, `INLP-EVENT-balbharati-2020-fee-revision`. Types in
use as of founding: `ACTOR`, `EVENT`. Types defined but not yet populated:
`MANDATE`, `PRINCIPLE`, `CROSSWALK`, `FINDING`, `LATENT`, `BRIEF`,
`SYNTHETIC`.

## Independent versioning

Each record type versions independently using semver (`provenance.version`),
same convention as sibling repos.

## Tooling

`scripts/validate_records.py` (ported from `nys_lp`'s script of the same
name, itself ported from `deutsche_lp`'s): walks every `$schema`-declaring
YAML file in the repo, validates each record against its declared JSON
Schema, checks every cross-reference field resolves to a real id somewhere
in the repo, and flags duplicate ids. Run it after adding or editing any
record:

```
python scripts/validate_records.py
```

Requires `pyyaml` and `jsonschema`. No CI workflow runs it automatically yet
— still a manual step before committing new/changed records.

## Relationship to deutsche_lp and nys_lp

Three sibling repos, one architecture, three genuinely different governance
and rights landscapes — see
`lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
for the direct comparison across all three. Folding India into either
existing repo (e.g. as a third "country" branch under a hypothetical unified
tree) would have blurred exactly the differences that make the comparison
worth doing — same reasoning `nys_lp` already gives for why it isn't a 17th
"Land" inside `deutsche_lp`.
