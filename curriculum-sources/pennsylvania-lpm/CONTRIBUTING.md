# Contributing to pennsylvania-lpm

**Status:** Informative. For the authoritative rules, see
[`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

Read [`README.md`](README.md) for what belongs where — `national_ccs_policy`
(federal/multi-state actors: NCSE, Discovery Institute, the national legal
teams) vs. `state/pennsylvania/local_policy` (Pennsylvania-specific
institutional facts, mandates at BOTH the state and school-district level,
and controversies) vs. `state/pennsylvania/lp` (curriculum-graph crosswalk
references) vs. `case/` (CASE-format machine-readable standards). This repo
mirrors `florida-lpm`'s structure deliberately — read that repo's own
`CONTRIBUTING.md` too if a convention here seems underspecified.

## Proposing a change

1. This repo is private with a single maintainer today — open a pull
   request against `main` (no `submissions` branch).
2. Run `python scripts/validate_records.py` before committing new/changed
   records.
3. Every `local_policy`/`lp`/`national_ccs_policy` record must carry a
   `verificationStatus`. New content starts at `unverified-secondary-source`
   unless independently checked against a primary/named source.

## The one thing this repo's records get right that's easy to get wrong: level

Before minting an `institutional-mandate-record`, decide which LEVEL of
government actually issued it. Pennsylvania's central case is a school
DISTRICT's own policy (`mandateType: school-district-policy`), not a state
action — conflating the two would misrepresent exactly the fact this repo
exists to document precisely (see
`docs/source-notes/2026-10-20-pennsylvania-evolution-curriculum-policy-history-research.md`'s
Part 2 for why this distinction matters). Check `issuingBody` and
`mandateType` agree before committing a mandate record.

## Writing a `policy-controversy-record`

Same house style as `florida-lpm`'s own `CONTRIBUTING.md`:

- Every `positions` entry needs a real, attributed stance with a source —
  not a label.
- `mediaCoverage` defaults to `citation-only`.
- Use `recurrenceOf` only when a new episode is genuinely the same
  underlying fault line resurfacing — Pennsylvania's two controversies here
  (the 2002 state-standards wording fight and the Dover litigation) are
  related by theme and jurisdiction but NOT chained via `recurrenceOf`,
  since they sit at different governmental levels and were resolved by
  different mechanisms (a rulemaking revision vs. a federal court ruling) —
  don't force a link that isn't genuinely the same fight.
- A federal court's own published opinion can be quoted at
  `full-text-stored` directly (it's a public judicial record), unlike
  ordinary news coverage.

## Adding a new state (if this pattern extends beyond Florida and Pennsylvania)

Follow `florida-lpm`'s own "Adding a new state" convention: create
`state/<state>/{local_policy,lp,ccs_policy}/records/`, do the same
primary-source grounding pass this repo's founding session did for
Pennsylvania, and check `national_ccs_policy/` first for whether a
cross-state actor (NCSE, Discovery Institute) already has a record here or
in a sibling repo worth referencing (informally) rather than re-describing
from scratch.

## Cross-linking to other repos

References to ConceptBase concepts, CompetencyBase competencies, or
bio-core-k12/interdisciplinary-k12 LPM strand ids are informal (plain string
ids/paths) for now, not schema-validated resolvable links — same convention
as `florida-lpm`/`deutsche_lp`/`nys_lp`/`india-lpm`.

## Rendered deliverables

Any brief, roadmap, or comparison document meant to leave this repo is a
real committed file (markdown, or an actual rendered PDF/HTML), never a
Claude Artifact.

## Questions

This is a private single-maintainer repo for now — no issue-based workflow
yet.
