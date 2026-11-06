# tennessee-lpm (curriculum-sources/tennessee-lpm)

**OpenEvo CCS Lab's intelligence layer for Tennessee's evolution-curriculum
politics** — the source material behind OpenLPM's Tennessee Curriculum
Repository project (see [`GOVERNANCE.md`](GOVERNANCE.md); not yet a
ConceptBase-governed Foundational Repo). Founded 2026-10-20, the third US
state built this session, following [`florida-lpm`](../florida-lpm/) and
[`pennsylvania-lpm`](../pennsylvania-lpm/).

Tennessee is where the whole modern American debate over teaching evolution
in public schools began: the **Butler Act** (1925) made it a crime to teach
evolution in a Tennessee public school. The ACLU engineered a test
prosecution in Dayton — **the Scopes "Monkey Trial"** — pitting Clarence
Darrow against three-time presidential candidate William Jennings Bryan in
the first trial broadcast live nationally by radio. Scopes was convicted;
the Tennessee Supreme Court upheld the law but reversed the conviction on a
technicality, ending enforcement without ever striking the law down. The
Butler Act stayed on the books until 1967. Tennessee tried again in 1973
with a law requiring Genesis be taught alongside evolution — struck down by
a federal appeals court in 1975. And in 2012, Tennessee enacted the
**Teacher Protection Act** ("monkey law"), letting teachers present
"scientific weaknesses" of evolution — still in force today, apparently
never challenged in court.

## Why Tennessee is the richest stress test yet

Florida's case (`florida-lpm`) is state-level and recurring, resolved by
votes. Pennsylvania's case (`pennsylvania-lpm`) is district-level, a single
episode, resolved by litigation. **Tennessee is both at once, three times
over, across a full century**: three separate state-level statutes (1925,
1973, 2012), chained via `policy-controversy-record.recurrenceOf` into the
deepest such chain in this ecosystem (three links, where Florida's own chain
is two). Each episode was ALSO resolved by a genuinely different mechanism —
a technicality dismissal, a substantive appellate strike-down, and simple
enactment with no legal test at all — meaning a single state's own history
contains nearly every resolution-shape this ecosystem's schema family was
built to distinguish. This repo contributed no new schema mechanism back —
unlike Florida (which authored `policy-controversy-record` itself) and
Pennsylvania (which added `school-district-policy`/`election`), Tennessee's
contribution is at the content level: proof the existing schema family,
built for two prior cases, needed nothing new to handle a third, much
longer and more complex one.

## What's here as of founding (2026-10-20)

- **`national_ccs_policy/`** — 4 federal/multi-state actor records (ACLU,
  NCSE, National Association of Biology Teachers, Public.Resource.Org).
- **`state/tennessee/local_policy/`** — 4 Tennessee institutional-actor
  records, a 21-event dated timeline (1925-2025), 5 mandate records (the
  1925 Butler Act, its 1967 repeal, the 1973 equal-time law, the 2012
  Teacher Protection Act, and the current 2022 standards), 2 coherence
  findings, and **3 `policy-controversy-record` entries chained via
  `recurrenceOf`**.
- **`state/tennessee/ccs_policy/`** — 3 OpenEvo-authored policy principles.
- **`state/tennessee/lp/`** — 3 curriculum-crosswalk records.
- **`case/`** — a CASE-format file for Tennessee's 2022 evolution/heredity
  benchmarks (17 benchmarks across grades 8-12), transformed from the
  Common Standards Project API — confirmed live, independently, twice this
  session — with a third distinct licensing case: CC BY 4.0 US, different
  from both Florida's (CC BY 3.0 US) and Pennsylvania's (no confirmed open
  license).
- **`docs/source-notes/`** — two full, fully-sourced research write-ups.
- **`schema/`** — all 10 record schemas ported from `pennsylvania-lpm`,
  adapted to Tennessee's all-state-level mandate pattern.

## What's deliberately NOT here yet

- No complete re-publication of Tennessee's full K-12 science standard set
  (Biology II's own much larger 28-benchmark evolution/phylogenetics strand
  was found but not built out).
- No confirmed native CASE Network feed reference (Tennessee IS reportedly
  listed with 14 frameworks on the renamed "Satchel Rosetta" registry, but
  this could not be confirmed by direct fetch — same JavaScript-rendering
  wall hit in Florida's and Pennsylvania's research).
- No independently-read copy of the actual 2012 bill PDF, the Malamud
  copyright letter, or the Tennessee State Library's own Scopes exhibit page
  — all three resisted direct fetch this session.

## Repository structure

```
national_ccs_policy/   — federal/multi-state actors

state/tennessee/
  local_policy/         — actors, timeline, mandates, coherence findings,
                          and policy-controversy records (the core content)
  ccs_policy/           — OpenEvo-authored policy principles
  lp/                   — curriculum-graph crosswalk references

case/                   — CASE-format (IMS CASE v1.0) machine-readable
                          standards files

schema/   — JSON Schemas for all 10 record types, adopted from
            pennsylvania-lpm unchanged
scripts/  — validate_records.py, ported from pennsylvania-lpm
docs/     — source-notes (the full century of history, and the
            machine-readable-format research)
```

## Sibling repos

This repo mirrors `deutsche_lp`/`nys_lp`/`india-lpm`/`florida-lpm`/`pennsylvania-lpm`'s
architecture deliberately, contributing no new schema mechanism back (see
`GOVERNANCE.md` for why that itself is a useful finding).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).

## Part of the CCS Lab ecosystem

- **[`pennsylvania-lpm`](../pennsylvania-lpm/)** /
  **[`florida-lpm`](../florida-lpm/)** / **[`nys_lp`](../../../nys_lp/)** /
  **[`deutsche_lp`](../../../deutsche_lp/)** / **[`india-lpm`](../india-lpm/)**
  — the sibling repos this one's schema/governance mirrors.
- **`openlpm`** (this repo, two levels up) —
  `scripts/import_curriculum_repository.py` reads this folder directly and
  upserts into the live Curriculum Repository projects.
- **[`openevo-graph`](../../../openevo-graph/)** —
  `schema/case_schema.json` (the CASE-format implementation `case/` conforms
  to) and `edges/disputes/dispute-openevo-vs-discovery-institute-edges.yaml`
  (the same Kitzmiller trial's bacterial-flagellum testimony referenced
  there, for a distinct scientific-content dispute).
- **[`bio-core-k12`](../../../bio-core-k12/)** —
  `strands/strand-102-natural-selection-adaptation.yaml`.
- **[`lab_manager`](../../../lab_manager/)** — the agent/skill layer.
