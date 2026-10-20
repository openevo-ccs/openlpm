# pennsylvania-lpm (curriculum-sources/pennsylvania-lpm)

**OpenEvo CCS Lab's intelligence layer for Pennsylvania's evolution-curriculum
politics** — the source material behind OpenLPM's Pennsylvania Curriculum
Repository project (see [`GOVERNANCE.md`](GOVERNANCE.md); not yet a
ConceptBase-governed Foundational Repo). Founded 2026-10-20, as a direct
companion to [`florida-lpm`](../florida-lpm/), built the same session.

Pennsylvania is the site of **Kitzmiller v. Dover Area School District**
(2005) — the single most consequential evolution-education court case in US
history: a school district's own board required a disclaimer about
"intelligent design" be read before biology's evolution unit; eleven parents
sued; a six-week federal trial followed; voters ousted every pro-policy
board member before the ruling came down; and Judge John E. Jones III ruled
the policy unconstitutional. Separately, Pennsylvania's own state-level
science standards have their own, much less famous, but real 2000-2002
wording fight — and a 2022 rewrite (STEELS) where, unlike Florida's 2026
rewrite, evolution was never actually the point of controversy.

Lives inside `openlpm/curriculum-sources/`, following `india-lpm`'s and
`florida-lpm`'s precedent.

## Why this repo is a genuinely different case, not just a second Florida

Florida's case (`florida-lpm`) is a **state-level**, **recurring**,
**politically-resolved** story: one authority repeatedly re-adopting and
re-wording the same standard across decades. Pennsylvania's central episode
is the opposite on every axis: a **school-district-level** mandate, a
**single, intensely documented** episode (not a recurring pattern), resolved
by **federal litigation** rather than a subsequent vote. This mattered for
the shared schema family in a concrete way: `institutional-mandate-record`
needed one new `mandateType` value (`school-district-policy`) that Florida's
story never required, and `policy-timeline-event` needed one new `eventType`
value (`election`) for a school-board election that was itself the pivotal
event, not a board's own action. `policy-controversy-record`'s
`controversyType: litigation` value — added at Florida's founding without a
case yet to use it on — gets its first real use here.

## What's here as of founding (2026-10-20)

- **`national_ccs_policy/`** — 6 federal/multi-state actor records (NCSE,
  Discovery Institute, Americans United for Separation of Church and State,
  the ACLU, Thomas More Law Center, Pepper Hamilton LLP).
- **`state/pennsylvania/local_policy/`** — 4 Pennsylvania institutional-actor
  records spanning two governmental levels (state and school-district), a
  17-event dated timeline (2000-2025), 4 mandate records (the Dover
  disclaimer policy and its rescission; Pennsylvania's own 2002 and 2022
  state evolution standards), 3 coherence findings, and **2
  `policy-controversy-record` entries** — the 2000-2002 state-standards
  wording fight and Kitzmiller v. Dover itself.
- **`state/pennsylvania/ccs_policy/`** — 3 OpenEvo-authored policy
  principles.
- **`state/pennsylvania/lp/`** — 3 curriculum-crosswalk records.
- **`case/`** — a CASE-format file for Pennsylvania's 2022 STEELS evolution
  benchmarks (17 benchmarks across 5 strands, grades 6-12), transformed from
  the Common Standards Project API, confirmed live the same session as
  Florida's identical check — with one real, flagged difference: unlike
  Florida's confirmed CC BY 3.0 US license, Pennsylvania's data carries no
  open-license statement; see `case/README.md`.
- **`docs/source-notes/`** — two full, fully-sourced research write-ups.
- **`schema/`** — all 10 record schemas ported from `florida-lpm` and
  adapted to Pennsylvania's own governance vocabulary (a multi-body
  regulatory rulemaking process, not a single board vote; a school
  district's own binding policy, a level Florida's story never needed).

## What's deliberately NOT here yet

- No complete re-publication of PA's full ~177-item science standard set.
- No independently re-confirmed full text of the superseded 2002 standard
  beyond its single central evolution benchmark.
- No confirmed native CASE Network feed reference (same open item as
  Florida — a human checking `casenetwork.1edtech.org` directly in a real
  browser is the one remaining ~10-minute follow-up).

## Repository structure

```
national_ccs_policy/   — federal/multi-state actors

state/pennsylvania/
  local_policy/         — actors, timeline, mandates, coherence findings,
                          and policy-controversy records (the core content)
  ccs_policy/           — OpenEvo-authored policy principles
  lp/                   — curriculum-graph crosswalk references

case/                   — CASE-format (IMS CASE v1.0) machine-readable
                          standards files

schema/   — JSON Schemas for all 10 record types, adopted from florida-lpm
            (policy-controversy-record unchanged; institutional-mandate-record
            and policy-timeline-event each gain one new value Pennsylvania's
            story needed)
scripts/  — validate_records.py, ported from florida-lpm
docs/     — source-notes (the full history and machine-readable-format
            research)
```

## Sibling repos

This repo mirrors `deutsche_lp`/`nys_lp`/`india-lpm`/`florida-lpm`'s
architecture deliberately. See `GOVERNANCE.md` for the one new mandateType
value this repo contributes back (`school-district-policy`), not yet
back-ported into `florida-lpm`'s own schema copy since Florida's story never
needed it.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).

## Part of the CCS Lab ecosystem

- **[`florida-lpm`](../florida-lpm/)** / **[`nys_lp`](../../../nys_lp/)** /
  **[`deutsche_lp`](../../../deutsche_lp/)** / **[`india-lpm`](../india-lpm/)**
  — the sibling repos this one's schema/governance mirrors.
- **`openlpm`** (this repo, two levels up) —
  `scripts/import_curriculum_repository.py` reads this folder directly and
  upserts into the live Curriculum Repository projects.
- **[`openevo-graph`](../../../openevo-graph/)** —
  `schema/case_schema.json` (the CASE-format implementation `case/` conforms
  to) and `edges/disputes/dispute-openevo-vs-discovery-institute-edges.yaml`
  (the same real-world Discovery Institute institution, and the same
  Kitzmiller trial's bacterial-flagellum testimony, modeled there for a
  distinct scientific-content dispute rather than this repo's institutional/
  litigation history).
- **[`bio-core-k12`](../../../bio-core-k12/)** —
  `strands/strand-102-natural-selection-adaptation.yaml`.
- **[`lab_manager`](../../../lab_manager/)** — the agent/skill layer.
