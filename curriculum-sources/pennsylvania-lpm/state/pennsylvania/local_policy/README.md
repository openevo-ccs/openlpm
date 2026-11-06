# state/pennsylvania/local_policy

Institutional intelligence at TWO levels of government — the state (PDE,
State Board of Education, IRRC) and a single school district (Dover Area
School District) whose own board issued the central mandate this repo was
founded to document.

## Contents

- [`records/institutional-actors.yaml`](records/institutional-actors.yaml) —
  4 actor records: PDE, the State Board of Education, IRRC, and Dover Area
  School District.
- [`records/timeline.yaml`](records/timeline.yaml) — 17 dated events, 2000
  through 2025 (STEELS full implementation).
- [`records/mandates.yaml`](records/mandates.yaml) — 4 mandate records: the
  Dover intelligent-design disclaimer policy and its 2006 rescission (both
  `mandateType: school-district-policy`, a value added specifically for this
  repo — see `GOVERNANCE.md`), and Pennsylvania's own 2002 and 2022
  state-level evolution standards (`state-board-adopted-standard`). The 2022
  STEELS benchmarks were fetched directly from a live, confirmed API, not a
  secondary mirror.
- [`records/coherence-findings.yaml`](records/coherence-findings.yaml) — 3
  findings: the 2002 proposed-vs-final standards-wording change; the direct
  textual comparison showing Dover's district policy went well beyond what
  the state standard required or permitted (`district-vs-state-standard-divergence`,
  a finding type added specifically for this repo); and a cross-state
  comparison establishing that, unlike Florida, evolution content was never
  the point of controversy in Pennsylvania's own standards-revision cycle.
- [`records/controversies.yaml`](records/controversies.yaml) — 2
  `policy-controversy-record` entries: the lesser-known 2000-2002 state
  rulemaking wording fight, and Kitzmiller v. Dover itself —
  `controversyType: litigation`, resolved by a federal court ruling rather
  than a subsequent vote, a genuinely different shape than any of
  `florida-lpm`'s four controversy records.

## A note on this founding session's research

Done by two delegated research agents instructed to fetch and read
primary/named sources directly — the trial record, the ruling itself (read
via two independent routes), the Pennsylvania Bulletin's own rulemaking
notices, and the Common Standards Project API. A handful of specific facts
(Discovery Institute's exact deposition-withdrawal rationale, HB 1007's
prime sponsor, IRRC's exact 2022 approval date) rest on secondary summaries
and are flagged `unverified-secondary-source`/`contributor_notes` at the
specific record rather than silently upgraded.
