# us-evolution-education-lpm — Governance

**Status:** Sandbox / pre-RFC. This repo is **not yet** a ConceptBase-governed
Foundational Repo under `openevo-core`'s RFC process. Nothing here has a
permanent, ecosystem-wide identifier yet.

## Founding scope (2026-10-20) — the missing apex layer

Founded the same session as `florida-lpm`, `pennsylvania-lpm`, and
`tennessee-lpm`, after all three were already built, in direct response to
being asked to "think across spaces, [the] US as a whole, and states." Each
of those three repos documents one state's own evolution-education politics
completely and self-containedly — but three national organizations (NCSE,
the Discovery Institute, the ACLU) turned out to be real, independently
confirmed actors in two or three of them, and the whole pattern those three
states are instances OF is itself a national one, shaped directly by two US
Supreme Court rulings that bind every state at once: ***Epperson v.
Arkansas*** (1968, striking down an outright teaching ban, the same
Butler-Act-era law type Tennessee itself had already repealed by then) and
***Edwards v. Aguillard*** (1987, striking down Louisiana's "balanced
treatment" law — the same "equal time" template Tennessee's own 1973 law,
struck down by a lower court in 1975, anticipated by over a decade). This
repo is that missing layer. It covers neither a single state nor a single
case; it covers the national pattern and the two nationally-binding rulings
that the three state repos' own histories all sit underneath.

## Why this is a repo of its own

Every state repo already has its own `national_ccs_policy/` folder for
federal-level actors relevant to THAT state's own story (e.g.
`florida-lpm/national_ccs_policy/` models NCSE and the Discovery Institute
specifically as they relate to Florida). This repo is different in kind: it
has no `state/` folder at all, because its own subject matter — two US
Supreme Court rulings binding on all fifty states, and the recurring
national pattern of state/district attempts to work around them — has no
single state to live inside. Modeling it as a fourth, bigger copy pasted
into one of the existing state repos would misrepresent it as belonging to
that state; modeling it here, as its own small repo containing only a
`national_ccs_policy/` folder and no `state/` folder, keeps it honestly
scoped to what it actually is.

## What's here

- **`national_ccs_policy/records/institutional-actors.yaml`** — ONE
  canonical record each for the national organizations already modeled
  independently (2-3 times each) across `florida-lpm`/`pennsylvania-lpm`/
  `tennessee-lpm`: NCSE, the Discovery Institute (including real facts about
  its 1990 founding and the leaked 1999 "Wedge Document" strategy memo,
  context none of the three state repos' own, narrower research passes had
  reason to dig up), and the ACLU (including its 1920 founding, predating
  Scopes by five years). Each state repo's own existing actor record for
  the same organization now carries a `crossRepoRefs` entry pointing here as
  well as sideways to its sibling state repos — this repo's own record is
  not claimed as more "canonical" than theirs; see the cross-repo-identity
  note below.
- **`national_ccs_policy/records/mandates.yaml`** — the two Supreme Court
  rulings, modeled as `institutional-mandate-record`s with a NEW
  `mandateType` value, `federal-supreme-court-precedent`: a binding
  national requirement, just one set by a court ruling rather than a
  statute or a board vote. This is the one new schema mechanism this repo
  contributes back — none of `florida-lpm`/`pennsylvania-lpm`/`tennessee-lpm`
  needed it, since none of the rulings they document bound more than one
  state or one federal circuit.
- **`national_ccs_policy/records/timeline.yaml`** — the two rulings as
  dated events, plus the Scopes Trial's own national significance (it
  happened in Tennessee, lives in full in `tennessee-lpm`, but its role as
  the literal origin point of this entire national pattern belongs here
  too, referenced via `crossRepoRefs` rather than re-described).
- **`national_ccs_policy/records/controversies.yaml`** — ONE
  `policy-controversy-record`, "The American evolution-education culture
  war" (1925-present), using `crossRepoRefs` to point at all three state
  repos' own controversy records as the concrete, documented instances this
  national pattern is actually built from.
- **`national_ccs_policy/records/coherence-findings.yaml`** — a real
  `cross-state-standards-divergence` finding (a value that existed in the
  shared schema from `florida-lpm`'s own founding but had never actually
  been used until this repo) comparing Florida's, Pennsylvania's, and
  Tennessee's genuinely different current postures side by side.
- **`national_ccs_policy/records/policy-principles.yaml`** — OpenEvo-authored
  positions that only make sense read across all three states at once.

## Cross-repo actor and controversy identity — still informal, by design

Same discipline as the three state repos' own `CONTRIBUTING.md`:
`crossRepoRefs` (on `institutional-actor-record` and
`policy-controversy-record`, added 2026-10-20) are plain strings. They are
unvalidated. This repo does NOT retroactively "own" NCSE's, the Discovery
Institute's, or the ACLU's identity at the expense of the state repos' own
records — all four records for, say, NCSE (one here, one each in
`florida-lpm`/`pennsylvania-lpm`/`tennessee-lpm`) are peers, cross-linked in
both directions. There is no hub-and-spoke hierarchy among them. See
`../cross-repo-notes/national-actors-across-state-repos-2026-10-20.md` for
the narrative synthesis and `../README.md` for the full index.

## Verification status

Same three-tier discipline as the sibling repos
(`unverified-secondary-source` / `primary-source-confirmed` / `verified`).
The two Supreme Court rulings reach `primary-source-confirmed` where this
repo's own research read the opinions' holdings/quotes directly via a
named legal-reference source (Justia/Oyez) rather than a secondary summary.

## Lifecycle status

```
proposed → accepted → stable → deprecated → superseded
                                    ↘
                                     retracted
```

## Identifier scheme

**Provisional and repo-local, pending a future RFC for ecosystem-wide
permanence:** `USLP-<TYPE>-<slug>`, e.g. `USLP-ACTOR-ncse`,
`USLP-MANDATE-epperson-v-arkansas`,
`USLP-CONTROVERSY-american-evolution-education-culture-war`.

## Tooling

`scripts/validate_records.py`, ported from `tennessee-lpm`'s script of the
same name, generalized to the `USLP` id prefix.

```
python scripts/validate_records.py
```

## Relationship to deutsche_lp, nys_lp, india-lpm, florida-lpm, pennsylvania-lpm, and tennessee-lpm

This is the first repo in this ecosystem that sits ABOVE the state/country
level rather than at it — see `../README.md` for how it fits into the
overall `curriculum-sources/` structure.
