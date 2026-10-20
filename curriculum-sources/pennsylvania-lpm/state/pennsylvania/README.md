# state/pennsylvania

The founding, and currently only, case for `pennsylvania-lpm` — Pennsylvania
is where a single school district's own board issued the curriculum mandate
that produced the most consequential evolution-education court ruling in US
history, Kitzmiller v. Dover Area School District (2005).

**Read [`GOVERNANCE.md`](../../GOVERNANCE.md) before treating anything here
as settled fact.** Most of this folder's content reaches
`primary-source-confirmed` (the trial record, the ruling itself, the
Pennsylvania Bulletin's own rulemaking notices, and a live, directly-fetched
API were all read/queried directly) — but several specific facts (Discovery
Institute's exact withdrawal rationale, a bill's prime sponsor, one
commission's exact approval date) rest on secondary summaries and are
flagged at the specific record.

## Contents

- [`local_policy/`](local_policy/) — PDE, the State Board of Education,
  IRRC, and Dover Area School District; a 17-event timeline from 2000 to
  2025; 4 mandate records spanning TWO governmental levels (state and
  school-district); 3 coherence findings; and **2 `policy-controversy-record`
  entries** — the 2000-2002 state-standards wording fight, and Kitzmiller v.
  Dover itself, the first repo to actually populate a `controversyType:
  litigation` record.
- [`ccs_policy/`](ccs_policy/) — 3 OpenEvo-authored policy principles.
- [`lp/`](lp/) — curriculum-graph crosswalk references, pointing at
  `case/`'s CASE-format files and at `bio-core-k12`'s existing
  natural-selection/adaptation LPM strand.

## Comparative context

Pennsylvania is the third US state in this ecosystem after New York
(`nys_lp`) and Florida (`florida-lpm`), and the second to use the
`policy-controversy-record` schema. Where Florida's case is a recurring,
decades-long STATE-level pattern resolved each time by a subsequent vote,
Pennsylvania's central case is a single, intensely documented episode at the
SCHOOL-DISTRICT level, resolved by federal litigation rather than politics
— a genuinely different shape the schema family handled without needing a
new record type, only one new `mandateType` value
(`school-district-policy`) and one new `eventType` value (`election`). See
`GOVERNANCE.md` for the full comparison.
