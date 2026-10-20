# state/florida/local_policy

Institutional intelligence: who the real actors are, what they've formally
committed to, when things happened or are scheduled to happen, what a direct
reading of the policy documents (where available) shows, and — new in this
repo — the bounded public controversies that tie those facts together
politically.

## Contents

- [`records/institutional-actors.yaml`](records/institutional-actors.yaml) —
  9 actor records: FLDOE and the State Board of Education (the
  administrative/governing pair), the Florida Legislature, CPALMS/USF (the
  official standards repository and this repo's lead on the
  machine-readable-format question), Florida Citizens for Science (the
  central pro-evolution-education grassroots voice since 2006), the Florida
  Family Policy Council (the central organized-opposition voice in 2008), the
  Florida Education Association, and the Teacher Institute for Evolutionary
  Science.
- [`records/timeline.yaml`](records/timeline.yaml) — 18 dated events, 1996
  through the planned December 2026 State Board vote.
- [`records/mandates.yaml`](records/mandates.yaml) — 5 formal mandate
  records: the 2008 NGSSS SC.912.L.15 standard, benchmark SC.912.L.15.1, and
  the human-evolution-specific benchmarks SC.912.L.15.10-11 — all three
  fetched directly from a live, confirmed, CC-BY-licensed API this session
  (`full-text-stored`/`primary-source-confirmed`, not secondary mirrors) —
  plus the 2017 instructional-materials law (HB 989), and the 2026 draft's
  evolution-omission (deliberately kept at `status: proposed` and
  `unverified-secondary-source` since it characterizes reporting about the
  draft, not the draft text itself).
- [`records/coherence-findings.yaml`](records/coherence-findings.yaml) — 3
  findings comparing Florida's standards text across editions: the
  1996-to-2008 naming-explicitness shift, the 2019-2020 B.E.S.T. rewrite's
  science-standards non-involvement (an important correction to a plausible
  misreading), and the 2008-to-2026 reversal of explicit evolution/climate
  naming.
- [`records/controversies.yaml`](records/controversies.yaml) — **the
  centerpiece of this repo's founding**: 4 `policy-controversy-record`
  entries (a new, tenth schema type first authored in this repo — see
  `GOVERNANCE.md`) documenting the 2008 standards-wording fight, the 2008
  "Academic Freedom Act" legislative fight, the 2017-18 HB 989 textbook
  challenges, and the active 2026 proposed-standards fight — the last of
  which is explicitly linked back to the 2008 episode via `recurrenceOf`,
  turning two isolated incidents 18 years apart into one documented, recurring
  political pattern.

## A note on how this founding session's research was done

Unlike `nys_lp`'s founding session (direct live fetches of NYSED/Regents
pages in the same session the records were written) or `deutsche_lp`'s
(a single pasted AI deep-research document, corrected later), this repo's
founding research was done by two delegated research agents, each
instructed to fetch and read primary/named sources directly rather than rely
on search snippets, and each explicitly flagging where that wasn't possible
(CPALMS.org and fldoe.org/standardsreview/ both resisted automated fetch —
see `docs/source-notes/`). Every record's `verificationStatus` and
`accessTier` reflects that distinction precisely: facts attributed to a
directly-fetched-and-read NCSE/Florida Phoenix/WUSF article are
`primary-source-confirmed`; facts that came through AI-synthesized search
summaries (the 1996/1999 standards' exact wording, the Tampa Tribune's 2008
blow-by-blow, the 2026 draft's exact benchmark text) are honestly held at
`unverified-secondary-source`, with the specific gap named in
`contributor_notes` rather than silently upgraded.
