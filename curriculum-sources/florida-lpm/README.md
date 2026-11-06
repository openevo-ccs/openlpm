# florida-lpm (curriculum-sources/florida-lpm)

**OpenEvo CCS Lab's intelligence layer for Florida's K-12 evolution-curriculum
politics** — the source material behind OpenLPM's Florida Curriculum
Repository project (see [`GOVERNANCE.md`](GOVERNANCE.md); not yet a
ConceptBase-governed Foundational Repo). Founded 2026-10-20, prompted by
[NCSE's coverage](https://ncse.ngo/florida-opens-pandoras-box-educational-horrors-proposed-new-science-standards)
of Florida's currently-in-progress science-standards rewrite — the first
since 2008, reportedly omitting the word "evolution" from high-school
life-science standards and "climate change"/"global warming" entirely.

Lives inside `openlpm/curriculum-sources/`, following the precedent
`india-lpm` set 2026-10-09, rather than as a standalone sibling repo like
`nys_lp`/`deutsche_lp`.

## Why this repo exists

Florida is the second US state in this ecosystem after New York. But where
New York's case (`nys_lp`) is a single, calm, currently-in-progress reform
with essentially no organized historical opposition, Florida's case is a
three-decade-long, recurring public fight: standards avoided naming
"evolution" at all before 2008; a hard-fought 2008 State Board vote adopted
explicit language only after a last-minute hedging compromise; a parallel
2008 legislative push for a Discovery-Institute-template "Academic Freedom
Act" failed; a 2017 law letting any resident challenge instructional
materials was used against evolution content in at least three counties;
and the state's first science-standards rewrite since 2008 — now underway,
expected to reach a State Board vote in December 2026 — is reportedly
reversing the 2008 standards' explicit naming of both evolution and climate
change.

This repo was built with an explicit second goal beyond documenting Florida
itself: **use Florida's genuinely contentious history to find and fill a
real gap in the curriculum-policy schema family this ecosystem already
shares across `deutsche_lp`/`nys_lp`/`india-lpm`.** That family's nine
existing record types — built for Germany's calm 16-Land comparison and New
York's single, uncontested reform — had no way to represent a bounded public
controversy: multiple named actors taking opposing positions, real press
coverage, a tracked (or unresolved) outcome, and a link to earlier/later
recurrences of the same underlying fight. `schema/policy-controversy-record.schema.json`
is the result — a tenth schema, first authored here, designed to be adopted
unchanged by any sibling repo that needs it. See `GOVERNANCE.md` for the
full rationale.

## What's here as of founding (2026-10-20)

- **`national_ccs_policy/`** — 5 federal/multi-state actor records (NCSE,
  Discovery Institute, Fordham Institute, National Academy of Sciences,
  Answers in Genesis).
- **`state/florida/local_policy/`** — 9 Florida institutional-actor records,
  an 18-event dated timeline (1996 → planned December 2026 vote), 5 formal
  mandate records (the full 2008 NGSSS SC.912.L.15 evolution standard — all
  15 benchmarks fetched from a live, confirmed, openly-licensed API, not a
  secondary mirror — the 2017 instructional-materials law, and the 2026
  draft's evolution-omission), 3 coherence findings comparing standards text
  across editions, and **4 `policy-controversy-record` entries** — the 2008
  standards-wording fight, the 2008 Academic Freedom Act legislative fight,
  the 2017-18 HB 989 textbook challenges, and the active 2026
  proposed-standards fight (explicitly linked back to 2008 via
  `recurrenceOf`).
- **`state/florida/lp/`** — 3 curriculum-crosswalk records: one documenting
  the confirmed-live Common Standards Project API, one pointing at `case/`'s
  CASE-format files transformed from it, and one pointing at `bio-core-k12`'s
  existing natural-selection/adaptation LPM strand.
- **`state/florida/ccs_policy/`** — 3 OpenEvo-authored policy principles
  grounded in the local_policy facts above.
- **`case/`** — [IMS CASE-format](https://www.imsglobal.org/activity/case)
  machine-readable standards files (conforming to the real
  `openevo-graph/schema/case_schema.json` already in this ecosystem, unused
  by any state repo until now): the complete 2008 NGSSS SC.912.L.15 standard
  (all 15 benchmarks plus Access Points), transformed from a real, live,
  CC-BY-3.0-licensed API confirmed reachable this session, and a placeholder
  for the 2026 draft (deliberately empty of fabricated benchmark text — see
  `case/README.md`).
- **`docs/source-notes/`** — two full, fully-sourced research write-ups: the
  evolution-curriculum policy history, and the machine-readable
  curriculum-standards landscape (CPALMS, the 1EdTech CASE Network, Standards
  Satchel, Learning Commons, Common Standards Project, and others).
- **`schema/`** — all 9 record schemas ported from `nys_lp`/`india-lpm` and
  adapted to Florida's own governance vocabulary (a State Board rule-making
  vote, not a Regents vote; a Legislature-passed statute, not a national
  policy framework), plus the new tenth schema,
  `policy-controversy-record.schema.json`.

## What's deliberately NOT here yet

- **No complete re-publication of Florida's full science standard set** —
  `case/`'s files cover only the specific evolution-related benchmarks this
  founding research could directly quote and source, not every NGSSS/B.E.S.T.
  benchmark.
- **No confirmed native CASE Network feed reference** — CPALMS is reportedly
  a 1EdTech Contributing Member publishing Florida's standards via CASE, but
  this repo's research could not get that specific registry to render
  through automated fetch (a different, separate source — the Common
  Standards Project API — WAS confirmed live and is what `case/`'s files are
  built from; see `docs/source-notes/2026-10-20-florida-machine-readable-standards-landscape-research.md`'s
  update section). Checking `rosetta.commongoodlt.com`/`casenetwork.1edtech.org`
  in a real browser remains the one ~10-minute follow-up worth a human's
  time.
- **No 2008-era Fordham PDFs, CPALMS.org, Tampa Tribune archive, or
  flascience.org's live 2026 posts fetched directly** — several specific
  claims rest on secondary-source characterization pending these direct
  fetches; see each affected record's `contributor_notes` and the
  source-notes' own confidence-flag list.

## Repository structure

```
national_ccs_policy/   — federal/multi-state actors (NCSE, Discovery
                          Institute, Fordham, NAS, Answers in Genesis)

state/florida/
  local_policy/         — actors, timeline, mandates, coherence findings,
                          and policy-controversy records (the core content)
  lp/                   — curriculum-graph crosswalk references

case/                   — hand-built CASE-format (IMS CASE v1.0) machine-
                          readable standards files

schema/   — JSON Schemas for all 10 record types (9 ported + the new
            policy-controversy-record)
scripts/  — validate_records.py, ported from nys_lp/india-lpm
docs/     — source-notes (the full licensing/history/machine-readable-format
            research)
```

## Sibling repos: deutsche_lp, nys_lp, india-lpm

This repo mirrors their architecture deliberately — same record schemas
(plus one new one), same `verificationStatus` discipline, same lifecycle
states — so all four stay genuinely comparable. See `GOVERNANCE.md` for the
one real structural addition this repo contributes back
(`policy-controversy-record`, and four new `policy-timeline-event.eventType`
values), and for why `india-lpm`'s own Kerala-vs-NCERT evolution-content-
retention dispute (already described in prose in that repo's own README) is
a clear future candidate to formalize under the new schema, not yet
attempted here.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md)
— read the `policy-controversy-record` house-style notes in
`CONTRIBUTING.md` before adding a new controversy record.

## Part of the CCS Lab ecosystem

- **[`nys_lp`](../../../nys_lp/)** / **[`deutsche_lp`](../../../deutsche_lp/)**
  / **[`india-lpm`](../india-lpm/)** — the sibling repos this one's
  schema/governance mirrors.
- **`openlpm`** (this repo, two levels up) — `scripts/import_curriculum_repository.py`
  reads this folder directly and upserts into the live Curriculum Repository
  projects, same mechanism as the three sibling repos.
- **[`openevo-graph`](../../../openevo-graph/)** — `schema/case_schema.json`
  (the CASE-format implementation `case/` conforms to) and
  `edges/disputes/dispute-openevo-vs-discovery-institute-edges.yaml` (the
  same real-world Discovery Institute institution, modeled there for a
  distinct scientific-content dispute rather than Florida's legislative
  history specifically).
- **[`bio-core-k12`](../../../bio-core-k12/)** — `strands/strand-102-natural-selection-adaptation.yaml`,
  the existing, concept-tagged LPM strand `state/florida/lp/records/crosswalk.yaml`
  points at.
- **[`conceptbase`](https://github.com/openevo-ccs/conceptbase)** /
  **[`competencybase`](https://github.com/openevo-ccs/competencybase)** —
  concept and competency ids referenced loosely from any future
  policy-principle or crosswalk records.
- **[`lab_manager`](../../../lab_manager/)** — the agent/skill layer.
