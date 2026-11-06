# state/tennessee

The founding, and currently only, case for `tennessee-lpm` — Tennessee is
where the whole modern American fight over teaching evolution began, and
where it has recurred, in three distinct legislative forms, across a full
century.

**Read [`GOVERNANCE.md`](../../GOVERNANCE.md) before treating anything here
as settled fact.** Most of this folder's content reaches
`primary-source-confirmed` — the statutes' own text, court opinions, and a
live, directly-queried API were all read/queried directly — but several
specific day-level dates genuinely conflict across sources and are flagged
at the specific record, and a few sources (a primary bill PDF, a
copyright-dispute letter, a state archive's exhibit page) could not be
fetched directly this session and are relayed only via secondary
characterization.

## Contents

- [`local_policy/`](local_policy/) — the Tennessee General Assembly, State
  Board of Education, TDOE, and Tennessee Science Teachers Association; a
  21-event timeline from 1925 to 2025; 5 mandate records spanning three
  separate statutes a century apart; 2 coherence findings tracing the
  state's own shifting legislative strategy; and **3
  `policy-controversy-record` entries chained via `recurrenceOf`** — the
  deepest such chain in this ecosystem so far, and the first time all three
  of litigation-resolution, appellate-strike-down-resolution, and
  never-tested-resolution appear within a single state's own history.
- [`ccs_policy/`](ccs_policy/) — 3 OpenEvo-authored policy principles.
- [`lp/`](lp/) — curriculum-graph crosswalk references, pointing at
  `case/`'s CASE-format files (built from a third distinct licensing case —
  CC BY 4.0 US) and at `bio-core-k12`'s existing natural-selection/
  adaptation LPM strand.

## Comparative context

Tennessee is the fourth US state in this ecosystem after New York
(`nys_lp`), Florida (`florida-lpm`), and Pennsylvania (`pennsylvania-lpm`),
and the third to use `policy-controversy-record`. Florida's case is
state-level and recurring, resolved by votes. Pennsylvania's is
district-level, a single episode, resolved by litigation. **Tennessee is
both at once, three times over**: three state-level statutes, each resolved
by a genuinely different mechanism (a technicality dismissal, a substantive
appellate strike-down, and simple enactment with no legal test at all).
This repo needed no new schema mechanism to handle that — only content, the
deepest `recurrenceOf` chain this ecosystem has built so far. See
`GOVERNANCE.md` for the full comparison.
