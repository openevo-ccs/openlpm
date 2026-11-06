# Contributing to tennessee-lpm

**Status:** Informative. For the authoritative rules, see
[`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

Read [`README.md`](README.md) for what belongs where. This repo mirrors
`pennsylvania-lpm`'s and `florida-lpm`'s structure deliberately — read those
repos' own `CONTRIBUTING.md` too if a convention here seems underspecified.

## Proposing a change

1. This repo is private with a single maintainer today — open a pull
   request against `main` (no `submissions` branch).
2. Run `python scripts/validate_records.py` before committing new/changed
   records.
3. Every `local_policy`/`lp`/`national_ccs_policy` record must carry a
   `verificationStatus`. New content starts at `unverified-secondary-source`
   unless independently checked against a primary/named source.

## This repo's distinctive discipline: the century span

All three of Tennessee's central mandates (1925, 1973, 2012) are real state
statutes — don't reach for `school-district-policy` here unless a genuine
district-level mandate surfaces (none did in the founding session). When
writing a `policy-controversy-record` for one of the three episodes, always
check whether it belongs in `recurrenceOf` pointing at the PRIOR episode —
that chain is this repo's single most valuable structural contribution, and
a new session adding a fourth future episode should continue it rather than
starting a new, disconnected record.

## Historical-source discipline for pre-digital-era events

A 1925 event cannot be "directly fetched" the way a 2026 news article can.
`verificationStatus: primary-source-confirmed` for an old event means a
primary historical document (the statute's own enacted text, a trial
transcript excerpt, a contemporaneous newspaper account, the appellate
court's own published opinion) was actually consulted — not that the event
is recent. Don't let the age of an episode push every record toward
`unverified-secondary-source` by default; a well-sourced history book or
widely-corroborated retrospective (e.g. NCSE's own Scopes-trial archive) can
still ground a `primary-source-confirmed` record if it quotes or cites the
underlying primary document directly.

## Writing a `policy-controversy-record`

Same house style as the sibling repos:

- Every `positions` entry needs a real, attributed stance with a source.
- `mediaCoverage` defaults to `citation-only`.
- Use `recurrenceOf` for the three-deep Butler Act → 1973 law → 2012 law
  chain — don't skip a link even where the resolution mechanism differed
  between episodes (a technicality dismissal, an appellate strike-down, and
  no litigation at all are three different outcomes of the SAME recurring
  political question).

## Adding a new state

Follow the sibling repos' own "Adding a new state" convention: create
`state/<state>/{local_policy,lp,ccs_policy}/records/`, do the same
primary-source grounding pass this repo's founding session did for
Tennessee, and check `national_ccs_policy/` first for whether a cross-state
actor (NCSE, the ACLU, Discovery Institute) already has a record worth
referencing informally.

## Cross-linking to other repos

References to ConceptBase concepts, CompetencyBase competencies, or
bio-core-k12/interdisciplinary-k12 LPM strand ids are informal for now, not
schema-validated resolvable links.

## Rendered deliverables

Any brief, roadmap, or comparison document meant to leave this repo is a
real committed file, never a Claude Artifact.

## Questions

This is a private single-maintainer repo for now — no issue-based workflow
yet.
