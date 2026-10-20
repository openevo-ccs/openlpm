# Contributing to florida-lpm

**Status:** Informative. For the authoritative rules, see
[`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

Read [`README.md`](README.md) for what belongs where — `national_ccs_policy`
(federal/multi-state context: SCOTUS rulings, NGSS, national advocacy
organizations) vs. `state/florida/local_policy` (Florida-specific
institutional facts, mandates, controversies) vs. `state/florida/lp`
(curriculum-graph crosswalk references) vs. `case/` (hand-built CASE-format
machine-readable standards). This repo mirrors `nys_lp`'s/`india-lpm`'s
structure deliberately — read those repos' own `CONTRIBUTING.md` too if a
convention here seems underspecified.

## Proposing a change

1. This repo is private with a single maintainer today — open a pull
   request against `main` (no `submissions` branch).
2. Run `python scripts/validate_records.py` before committing new/changed
   records — it checks schema conformance, cross-reference ids, and
   duplicate ids across the whole repo (see `GOVERNANCE.md` § Tooling).
3. Every `local_policy`/`lp`/`national_ccs_policy` record must carry a
   `verificationStatus` (see `GOVERNANCE.md`). New content sourced from a web
   search, a news article, or any source not independently checked against a
   primary/named source starts at `unverified-secondary-source` — never
   default it to something stronger.

## Doing a verification pass

Moving a record from `unverified-secondary-source` to
`primary-source-confirmed` means: find the actual primary or directly-named
source (FLDOE's/CPALMS's own page, an official PDF, the Florida Legislature's
own bill-text page, a named outlet's article read in full) and record its URL
in `provenance.sourceProvenance`. Do this before quoting a record's specific
claims (an official's name/title, a vote count, a benchmark's exact wording)
in anything that leaves this repo.

Moving a record to `verified` additionally means checking, on a date later
than the original research pass, that a named individual's title/role is
still current. If a claim turns out to be wrong or stale on verification,
correct the record and note what changed in `provenance.contributor_notes`
— don't silently overwrite it.

## Writing a `policy-controversy-record`

This schema is new (see `GOVERNANCE.md`), so some house style worth stating
explicitly:

- **Every `positions` entry needs a real, attributed stance** — not "pro-
  evolution groups objected" but the specific named organization or person
  and what they actually said, with a source. A controversy record with only
  one side's position documented is incomplete, not neutral — go find the
  other side's own stated position before treating the record as done.
- **`mediaCoverage` defaults to `citation-only`** (outlet + headline + URL,
  no quoted text) — see `GOVERNANCE.md`'s media-coverage section. Raise to
  `excerpt-only` only for a short, clearly-bounded, attributed quotation.
- **Use `recurrenceOf` whenever a new episode is plausibly the same fault
  line resurfacing** (Florida's evolution-standards fight has recurred at
  least in 2008, 2017, and 2026) — this is what turns isolated incidents into
  a documented historical pattern, the core ask behind this repo's founding.
  Don't force a `recurrenceOf` link that isn't genuinely the same underlying
  question, though — a textbook-challenge controversy and a standards-wording
  controversy can share a `themes` tag without being the same recurring
  fight.
- **Always state `exhaustivenessCaveat` honestly** — a controversy record
  built from the sources fetched in one research session is not a claim that
  every relevant news article or every actor's position was found.

## Adding a new state (if this pattern extends beyond Florida)

Follow `nys_lp`'s/`india-lpm`'s own "Adding a new state" convention: create
`state/<state>/{local_policy,lp}/records/`, do the same primary-source
grounding pass this repo's founding session did for Florida, and check
`national_ccs_policy/` first for whether a cross-state principle or national
actor already covers the new state's situation.

## Cross-linking to other repos

References to ConceptBase concepts, CompetencyBase competencies, or
bio-core-k12/interdisciplinary-k12 LPM strand ids are informal (plain string
ids/paths) for now, not schema-validated resolvable links — same convention
as `deutsche_lp`/`nys_lp`/`india-lpm`.

## Rendered deliverables

Any brief, roadmap, or comparison document meant to leave this repo is a
real committed file (markdown, or an actual rendered PDF/HTML), never a
Claude Artifact — see the sibling repos' own `briefs/README.md` convention
if this repo later grows a `briefs/` folder.

## Questions

This is a private single-maintainer repo for now — no issue-based workflow
yet.
