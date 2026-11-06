# us-evolution-education-lpm (curriculum-sources/us-evolution-education-lpm)

**OpenEvo CCS Lab's national-level intelligence layer for US
evolution-curriculum politics** — the source material behind OpenLPM's
national Curriculum Repository project (see [`GOVERNANCE.md`](GOVERNANCE.md);
not yet a ConceptBase-governed Foundational Repo). Founded 2026-10-20, right
after [`florida-lpm`](../florida-lpm/), [`pennsylvania-lpm`](../pennsylvania-lpm/),
and [`tennessee-lpm`](../tennessee-lpm/), in direct response to being asked
to connect the pieces across those three repos and think about the pattern
they're all instances of.

Three state repos turned out to share the same handful of national actors
(NCSE, the Discovery Institute, the ACLU) and to sit underneath the same two
US Supreme Court rulings that bind every state at once: **Epperson v.
Arkansas** (1968, striking down outright teaching bans) and **Edwards v.
Aguillard** (1987, striking down "balanced treatment" / equal-time laws).
This repo is the missing apex layer. It covers neither a single state nor a
single case; it covers the national pattern and the two nationally-binding
rulings the state repos' own histories sit underneath.

## Why this repo has no `state/` folder

Every state repo already has its own `national_ccs_policy/` folder for the
federal actors relevant to that one state's own story. This repo is
different in kind: it models two Supreme Court rulings that bind all fifty
states at once, and a recurring national pattern with no single state to
live inside. Pasting a bigger version of that content into one of the
existing state repos would misrepresent it as belonging to that state, so
it lives here instead, in a repo that is deliberately only
`national_ccs_policy/` and nothing else. See
[`GOVERNANCE.md`](GOVERNANCE.md) for the full reasoning.

## What's here as of founding (2026-10-20)

- **3 institutional-actor records** — NCSE, the Discovery Institute, and the
  ACLU, each the single canonical national-level record for an organization
  already modeled independently in two or three of the state repos, with
  `crossRepoRefs` linking all of them together in both directions.
- **2 institutional-mandate records** — *Epperson v. Arkansas* and *Edwards
  v. Aguillard*, both using the new `federal-supreme-court-precedent`
  mandate type (binding on every state, unlike a single district or circuit
  ruling), with the opinions' own holdings quoted directly.
- **3 timeline events** — the two rulings above, plus *Smith v. State of
  Mississippi* (1970), the case that applied *Epperson*'s reasoning to
  strike down Mississippi's own teaching ban.
- **2 coherence findings** — a real cross-state comparison of Florida's,
  Pennsylvania's, and Tennessee's current postures, and a finding comparing
  *Edwards*' own reasoning against Tennessee's still-in-force 2012 Teacher
  Protection Act.
- **1 policy-controversy record** — "The American evolution-education
  culture war" (1925-present), the single centerpiece record, using the new
  `cross-jurisdiction-pattern` controversy type and `crossRepoRefs` to all
  seven controversy records across the three state repos.
- **2 policy principles** — OpenEvo-authored positions that only make sense
  read across all three states at once.
- **`schema/`** — all 10 record schemas, ported from `tennessee-lpm` and
  hand-corrected for this repo's own national scope (new
  `federal-supreme-court-precedent` mandate type, new
  `cross-jurisdiction-pattern` controversy type, descriptions rewritten
  throughout to describe national rather than state-level use).

## Repository structure

```
national_ccs_policy/
  records/   — institutional-actors, mandates, timeline, coherence-findings,
               controversies, policy-principles (the entire content of this
               repo lives here; there is no state/ folder)

schema/     — JSON Schemas for all 10 record types
scripts/    — validate_records.py
docs/       — source-notes (the national case-law and actor research)
```

## Sibling repos

This repo sits one level above `deutsche_lp`/`nys_lp`/`india-lpm`/
`florida-lpm`/`pennsylvania-lpm`/`tennessee-lpm` rather than beside them —
the first repo in this ecosystem to do so. It contributes two new schema
mechanisms back (`federal-supreme-court-precedent`, `cross-jurisdiction-pattern`)
and is the first real user of the `cross-state-standards-divergence`
finding type that has existed in the shared schema since `florida-lpm`'s
own founding.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).

## Part of the CCS Lab ecosystem

- **[`florida-lpm`](../florida-lpm/)** / **[`pennsylvania-lpm`](../pennsylvania-lpm/)**
  / **[`tennessee-lpm`](../tennessee-lpm/)** — the three state repos this
  one sits above and cross-links with in both directions.
- **[`cross-repo-notes/`](../cross-repo-notes/)** — the narrative synthesis
  of how the national actors and controversies connect across all four
  repos.
- **`openlpm`** (this repo, two levels up) —
  `scripts/import_curriculum_repository.py` reads this folder directly and
  upserts into the live Curriculum Repository projects.
- **[`lab_manager`](../../../lab_manager/)** — the agent/skill layer.
