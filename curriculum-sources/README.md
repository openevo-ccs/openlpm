# curriculum-sources

Regional curriculum-policy intelligence repos living inside `openlpm`
(rather than as standalone sibling repos, the precedent `india-lpm` set
2026-10-09). Each repo is independently founded, independently governed
(see each repo's own `GOVERNANCE.md`), and feeds its records into the live
OpenLPM app via `../scripts/import_curriculum_repository.py`.

## Repos

- **[`india-lpm`](india-lpm/)** — India/Karnataka/Maharashtra/Kerala, founded
  2026-09-30. Curriculum-licensing landscape, institutional actors.
- **[`florida-lpm`](florida-lpm/)** — Florida, founded 2026-10-20. Florida's
  recurring, state-level evolution-standards fights (1996-2026), including
  the active 2026 rewrite that omits "evolution" and "climate change."
  Authored the shared `policy-controversy-record` schema (the tenth,
  ecosystem-wide record type) and four `policy-timeline-event.eventType`
  values.
- **[`pennsylvania-lpm`](pennsylvania-lpm/)** — Pennsylvania, founded
  2026-10-20. Kitzmiller v. Dover Area School District (2005), the most
  consequential evolution-education court case in US history — a
  district-level mandate resolved by federal litigation. Added
  `institutional-mandate-record.mandateType: school-district-policy` and
  `policy-timeline-event.eventType: election`.
- **[`tennessee-lpm`](tennessee-lpm/)** — Tennessee, founded 2026-10-20. A
  full century (1925-2026) of recurring state-level evolution-education law:
  the Butler Act and Scopes "Monkey Trial," the 1973 "equal time" law
  struck down in 1975, and the 2012 Teacher Protection Act still in force —
  three statutes chained via `recurrenceOf`, each resolved by a genuinely
  different mechanism. Needed no new schema mechanism of its own.
- **[`us-evolution-education-lpm`](us-evolution-education-lpm/)** — the
  national apex layer, founded 2026-10-20 right after the three state repos
  above. Holds the two US Supreme Court rulings that bind every state at
  once (*Epperson v. Arkansas*, 1968; *Edwards v. Aguillard*, 1987), one
  canonical record each for the national actors (NCSE, the Discovery
  Institute, the ACLU) already modeled independently across the three state
  repos, and the single controversy record ("The American
  evolution-education culture war") that the three states' own controversies
  are all instances of. Has no `state/` folder — see its own `GOVERNANCE.md`
  for why. Added `institutional-mandate-record.mandateType:
  federal-supreme-court-precedent` and
  `policy-controversy-record.controversyType: cross-jurisdiction-pattern`.

Each of the four US repos (`florida-lpm`/`pennsylvania-lpm`/`tennessee-lpm`/
`us-evolution-education-lpm`, plus `nys_lp` as a standalone sibling repo one
level up) shares the same ten-record-type schema family, adapted per repo to
that state's or the nation's own governance vocabulary — see any one repo's
`GOVERNANCE.md` for the full "why this schema, why these differences"
account, and `cross-repo-notes/` below for synthesis that spans more than
one repo at once.

## `cross-repo-notes/`

Documents that connect specific facts across two or more of the repos
above, where the connection itself is the point and doesn't belong inside
any single repo's own self-contained account:

- **[`national-actors-across-state-repos-2026-10-20.md`](cross-repo-notes/national-actors-across-state-repos-2026-10-20.md)**
  — NCSE, the Discovery Institute, and the ACLU each turned out to be real,
  independently-confirmed actors in two or three of the three
  evolution-education state repos, modeled independently in each (since
  each repo was founded before any of the others existed to cross-reference).
  This note reads their roles side by side and is the narrative counterpart
  to the mechanical `institutional-actor-record.crossRepoRefs` field, since
  extended to also point at each organization's own canonical record in
  `us-evolution-education-lpm`.

## A note on why cross-repo actor identity stays informal

`crossRepoRefs` (and the ConceptBase/CompetencyBase/bio-core-k12 references
used elsewhere in these repos) are deliberately plain strings. They are
unvalidated and unresolved — see any repo's own `CONTRIBUTING.md`. Even with
`us-evolution-education-lpm` now holding one canonical national-level record
each for NCSE, the Discovery Institute, and the ACLU, the state repos' own
records for the same organizations stay independent peers rather than being
replaced by a single resolved link. Formalizing real cross-repo identity
resolution further is left as future work, and shouldn't be assumed to
exist beyond what a repo's own docs describe.
