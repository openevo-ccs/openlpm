# tennessee-lpm — Governance

**Status:** Sandbox / pre-RFC. This repo is **not yet** a ConceptBase-governed
Foundational Repo under `openevo-core`'s RFC process. Nothing here has a
permanent, ecosystem-wide identifier yet. Ecosystem-wide conventions (the
RFC process itself, cross-repo id resolution once this repo is proposed for
adoption) are set by
[`openevo-core/GOVERNANCE.md`](https://github.com/openevo-ccs/openevo-core/blob/main/GOVERNANCE.md);
this document covers only what's specific to `tennessee-lpm` today.

This repo's architecture is a deliberate structural mirror of
[`../pennsylvania-lpm/GOVERNANCE.md`](../pennsylvania-lpm/GOVERNANCE.md),
[`../florida-lpm/GOVERNANCE.md`](../florida-lpm/GOVERNANCE.md),
[`../../../nys_lp/GOVERNANCE.md`](../../../nys_lp/GOVERNANCE.md),
[`../../../deutsche_lp/GOVERNANCE.md`](../../../deutsche_lp/GOVERNANCE.md), and
[`../india-lpm/GOVERNANCE.md`](../india-lpm/GOVERNANCE.md) — same
verification discipline, same lifecycle states, same identifier shape.

## Founding scope (2026-10-20)

Founded as the third US-state evolution-curriculum repo built the same
session, directly following `florida-lpm` and `pennsylvania-lpm`. Tennessee
is where the whole modern American debate over teaching evolution in public
schools began: the **Butler Act** (1925) made it a criminal misdemeanor for
any Tennessee public school or university teacher to teach "any theory that
denies the story of the Divine Creation of man as taught in the Bible" in
favor of descent from a lower order of animals. Within months, the ACLU
engineered a test case in Dayton, Tennessee — **State of Tennessee v. John
Thomas Scopes**, the "Scopes Monkey Trial" — pitting Clarence Darrow against
three-time presidential candidate William Jennings Bryan in front of a
packed courtroom and the first live radio broadcast of a trial in US
history. Scopes was convicted; the Tennessee Supreme Court upheld the law's
constitutionality in 1927 but reversed the conviction on a sentencing
technicality, effectively ending enforcement without the law itself ever
being struck down. The Butler Act stayed on the books until repealed in
1967. Tennessee tried again in 1973 with an "equal time" law requiring
Genesis be taught alongside evolution — struck down by the Sixth Circuit in
1975 (*Daniel v. Waters*). And in 2012, Tennessee enacted the **Teacher
Protection Act** ("monkey law"), letting teachers present "scientific
weaknesses" of evolution and other theories — still in force as of this
repo's founding. See `docs/source-notes/` for the full sourced research.

## Why Tennessee is the richest stress test yet for this schema family

Florida's case (`florida-lpm`) is state-level and recurring, resolved by
votes. Pennsylvania's case (`pennsylvania-lpm`) is district-level, a single
episode, resolved by litigation. **Tennessee is both at once, three times
over, across a full century**: three separate state-level statutes (1925,
1973, 2012), each a real, distinct `institutional-mandate-record`, chained
together via `policy-controversy-record.recurrenceOf` into what is — as of
this repo's founding — the deepest `recurrenceOf` chain in this ecosystem
(three links, where Florida's own chain is two). Each of the three episodes
was ALSO resolved by a genuinely different mechanism: the 1925 law survived
a court test on a technicality (and was later repealed by ordinary
legislative action, not forced by any ruling); the 1973 law was struck down
outright by a federal appellate court; the 2012 law has never been
challenged in court at all and remains active law today. A single US
state's own history turns out to contain, on its own, nearly every
resolution-shape this ecosystem's schema family was built to distinguish.

## Schemas adopted unchanged from florida-lpm/pennsylvania-lpm

`schema/policy-controversy-record.schema.json` (the tenth, ecosystem-wide
schema), `policy-timeline-event.eventType`'s five added values
(`court-ruling`, `public-hearing`, `school-board-action`,
`advocacy-campaign`, `election`), and `institutional-mandate-record.mandateType`'s
`school-district-policy` value are all inherited unchanged with this repo's
own `TNLP-` id prefix. This repo contributes no new schema mechanism back —
unlike Florida (which authored `policy-controversy-record` itself) and
Pennsylvania (which added `school-district-policy`/`election`), Tennessee's
genuinely novel contribution is at the CONTENT level (a three-deep
`recurrenceOf` chain), not the structural level, which is itself a useful
finding: the schema family built for two prior cases needed nothing new to
handle a third, much longer and more complex one.

## Verification status — the load-bearing concept in this repo

Distinct from the ecosystem's usual `provenance.review_status`
(`author-draft` → `peer-nominated` → `community-reviewed` →
`expert-validated` → `deprecated`), every `local_policy`/`national_ccs_policy`
record in this repo also carries a `verificationStatus`:

| Value | Meaning |
|---|---|
| `unverified-secondary-source` | Derived from a source not independently checked against an official primary document, trial record, or the court's own published opinion. |
| `primary-source-confirmed` | Checked directly against a primary or directly-fetched named source (the court's own published opinion, the statute's own text, a named outlet's article read in full with a URL recorded). |
| `verified` | Confirmed via primary source AND, where the record concerns a live institutional relationship or named individual, independently cross-checked as current on a date *later* than the initial research pass. |

A note specific to this repo's unusually old content: 1925-era claims
necessarily rely more heavily on secondary historical scholarship and
retrospective journalism than on records this session fetched live (no
"direct fetch" of a 1925 courtroom document is possible the way a 2026 news
article can be) — `verificationStatus` here tracks whether a *historical*
primary source (the trial transcript, the statute's own text, the appellate
ruling) was consulted, not whether the event itself is "recent."

## Media coverage and the press

Same rule as `florida-lpm`/`pennsylvania-lpm`: `policy-controversy-record.mediaCoverage`
entries default to `citation-only`. A state appellate court's own published
opinion is a public judicial record and can be quoted at `full-text-stored`
directly where load-bearing.

## Synthetic content — a third, orthogonal axis

Same rule as all sibling repos:
`schema/synthetic-curriculum-redesign-record.schema.json` records
(`TNLP-SYNTHETIC-*`) propose hypothetical redesigns and must never be cited
as describing real, adopted policy. No records exist under this schema as
of founding.

## Lifecycle status

```
proposed → accepted → stable → deprecated → superseded
                                    ↘
                                     retracted
```

## Identifier scheme

**Provisional, repo-local, not ecosystem-permanent:** `TNLP-<TYPE>-<slug>`,
e.g. `TNLP-ACTOR-tennessee-general-assembly`, `TNLP-EVENT-scopes-trial`,
`TNLP-CONTROVERSY-butler-act-and-scopes-trial`. See `README.md` for the
actual populated set.

## Independent versioning

Each record type versions independently using semver (`provenance.version`).

## Tooling

`scripts/validate_records.py` (ported from `pennsylvania-lpm`'s script of
the same name, generalized to the `TNLP` id prefix). Run after adding or
editing any record:

```
python scripts/validate_records.py
```

Requires `pyyaml` and `jsonschema`.

## Relationship to deutsche_lp, nys_lp, india-lpm, florida-lpm, and pennsylvania-lpm

Six sibling repos, one shared architecture, genuinely different governance
and political landscapes each worth keeping legible on its own terms. See
`lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
for the comparison this repo's structure extends to a sixth case, and
`florida-lpm/GOVERNANCE.md`/`pennsylvania-lpm/GOVERNANCE.md` for the fourth
and fifth.
