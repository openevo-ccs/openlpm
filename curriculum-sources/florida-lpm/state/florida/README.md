# state/florida

The founding, and currently only, case for `florida-lpm` — Florida is where
a seven-member State Board of Education can, in one vote, decide whether the
word "evolution" appears in the standards every public-school biology
teacher in the state is required to teach to, and has done exactly that
twice: once in 2008 (adopting it, hedged), and again in a vote expected
December 2026 (on a draft that currently omits it).

**Read [`GOVERNANCE.md`](../../GOVERNANCE.md) before treating anything here
as settled fact.** This repo's founding research was done by two delegated
research agents instructed to fetch and read primary/named sources directly
— most of this folder's content reaches `primary-source-confirmed` on that
basis — but several specific facts (the exact 1996/1999 standards wording,
the 2026 draft's exact benchmark text, a handful of 2008-era procedural
details) rest only on search-aggregated secondary summaries and are flagged
`unverified-secondary-source` at the specific record, not silently
upgraded. Check each record's own `verificationStatus` before quoting it
externally.

## Contents

- [`local_policy/`](local_policy/) — institutional intelligence: FLDOE, the
  State Board of Education, the Legislature, CPALMS/USF, Florida Citizens for
  Science, the Florida Family Policy Council, the Florida Education
  Association, the Teacher Institute for Evolutionary Science; an 18-event
  timeline from 1996 to the planned December 2026 vote; 5 formal mandate
  records (the full 2008 SC.912.L.15 evolution standard text — all core
  benchmarks — fetched directly from a live, confirmed, CC-BY-3.0-licensed
  API, not a secondary mirror); 3 coherence findings from comparing
  standards text across editions; and **4 `policy-controversy-record`
  entries** — this repo's central contribution, documenting the 2008
  standards-wording fight, the 2008 "Academic Freedom Act" legislative
  fight, the 2017-18 HB 989 textbook challenges, and the still-active 2026
  proposed-standards fight, the last of which is explicitly chained back to
  2008 via `recurrenceOf`.
- [`lp/`](lp/) — curriculum-graph crosswalk references: the confirmed-live
  Common Standards Project API, this repo's CASE-format files (`../../case/`)
  transformed from it, and `bio-core-k12`'s existing natural-selection/
  adaptation LPM strand.
- [`ccs_policy/`](ccs_policy/) — 3 OpenEvo-authored policy principles
  grounded in `local_policy/`'s facts: explicit naming outlasting euphemism,
  standards committees needing proportionate disciplinary expertise, and
  documented controversy as legitimate Nature-of-Science classroom content.
  All `status: draft` -- first-pass positions from this founding session, not
  yet reviewed.

## Comparative context

Florida is the second US state in this ecosystem after New York
(`nys_lp`), and the first case built using the new
`policy-controversy-record` schema (see `../../GOVERNANCE.md`). Where New
York's case is a single, currently-in-progress reform with no real historical
opposition to document, Florida's case is the opposite shape: a
three-decade-long, recurring political fault line with multiple resolved and
one currently-active episode — exactly the kind of case the new schema was
built to handle, and a useful stress test of whether the existing
nine-schema family (built for New York's and Germany's much calmer reform
processes) could handle real political conflict. It mostly could, with one
real gap (no way to model multiple actors' opposing positions and press
coverage as a single bounded unit) that `policy-controversy-record` now
fills.
