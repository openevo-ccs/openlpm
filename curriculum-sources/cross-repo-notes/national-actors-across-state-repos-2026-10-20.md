# National actors across florida-lpm, pennsylvania-lpm, tennessee-lpm, and us-evolution-education-lpm

Each of this ecosystem's three evolution-curriculum state repos was founded
in its own research session, independently, before any of them existed to
cross-reference. Three national organizations — the National Center for
Science Education (NCSE), the Discovery Institute, and the American Civil
Liberties Union (ACLU) — turned out to be real, independently-confirmed
actors in two or three of these repos' own histories. This note is the
connected version of that story: what the research actually found about
each organization's role in each state, read side by side, plus a pointer
to the mechanical cross-reference (`institutional-actor-record.crossRepoRefs`,
added 2026-10-20 to all three repos' schema) that lets a query jump from one
repo's own record to the matching one in a sibling repo.

**Update, same day**: a fourth repo, [`us-evolution-education-lpm`](../us-evolution-education-lpm/),
now holds one canonical national-level record each for NCSE, the Discovery
Institute, and the ACLU, plus the single `policy-controversy-record` ("The
American evolution-education culture war") that the state repos' own
controversy records are all instances of. Every actor and controversy
record described below now also carries a `crossRepoRefs` entry pointing at
its counterpart there. That repo's own record stands alongside the three described here as a peer
rather than replacing them — see its `GOVERNANCE.md` for why identity stays
spread across all four repos rather than consolidating into one.

**How to use this alongside the records themselves**: this document is a
narrative synthesis for a human reader. The actual machine-readable
connection lives in each repo's own
`national_ccs_policy/records/institutional-actors.yaml`, where the relevant
record now carries a `crossRepoRefs` field pointing at the matching id in
each sibling repo that also modeled this organization. Treat this document
as the "why it's worth connecting" case; treat the records themselves as
the source of truth for any specific claim.

## National Center for Science Education (NCSE)

The only organization with a confirmed, independent role in **all three**
state repos — and the clearest evidence that this ecosystem's three
"separate" state cases are really chapters of the same, continuing
national story.

- **Florida** (`FLLP-ACTOR-ncse`): NCSE is the direct source of the article
  that prompted this whole three-state research effort — Glenn Branch's
  October 2026 coverage of Florida's proposed science-standards rewrite. Its
  own 2005/2020 evaluative reports are the two data points this repo uses to
  show Florida's standards weren't always this contested (the 2008 fight
  over explicit evolution-naming) and aren't contested in the same way every
  cycle (the 2026 fight is specifically about *removal* of naming that
  2008's fight had been about *adding*).
- **Pennsylvania** (`PALP-ACTOR-ncse`): NCSE hosts the Kitzmiller v. Dover
  trial transcript archive and the ruling itself — this repo's single most
  load-bearing primary source. NCSE's current Board Chair, Kenneth R.
  Miller, was also the plaintiffs' lead expert witness at trial in 2005,
  meaning the organization's institutional memory of this case is literally
  continuous with a participant, well beyond arm's-length commentary.
- **Tennessee** (`TNLP-ACTOR-ncse`): NCSE's 2009 Mead & Mates study graded
  Tennessee's then-current standards on evolution content specifically
  (an "A," unlike the later "D" sometimes mis-cited against the *current*
  2022 standards — see `tennessee-lpm`'s own coherence-finding record for
  why that distinction matters), and NCSE is the primary tracking source for
  the 2012 "monkey law" fight, including direct quotes from its then
  executive director, Eugenie C. Scott.

**The throughline**: these three records describe one continuously operating
institution whose own staff and board carried direct, personal
institutional memory from the 2005 Dover trial through the 2012 Tennessee
fight to the 2026 Florida fight this research effort started from. A future
session wanting NCSE's own longest-range institutional position on
evolution-education policy should treat these three records as three
partial views of one continuous actor rather than three independent data
points.

## Discovery Institute (Center for Science and Culture)

Confirmed in **two** of the three repos, with a genuinely different role in
each: two sides of the same institution's actual strategy, read together
rather than as two separate sightings of the same behavior.

- **Florida** (`FLLP-ACTOR-discovery-institute`): authored the model
  "Academic Freedom Act" legislative template that Florida's 2008 bill
  (SB 2692/HB 1483) followed — the Institute as active drafter and promoter
  of specific legislative language.
- **Pennsylvania** (`PALP-ACTOR-discovery-institute`): the opposite posture.
  Its own site states it repeatedly warned the Dover Area School District
  and its defense counsel that the board's specific intelligent-design
  disclaimer policy "was problematic and should be replaced," and three of
  its affiliated fellows (Dembski, Meyer, Campbell) withdrew as defense
  expert witnesses before depositions rather than testify in support of it.

**The throughline**: both records describe the same real strategic pattern,
visible only by reading them together — the Discovery Institute's actual
preferred vehicle for its ideas was *legislative* ("teach the controversy,"
"academic freedom," never a specific district's own binding classroom
policy), and Dover's 2004 disclaimer was exactly the kind of blunt,
court-vulnerable local action the Institute itself tried to steer Dover away
from. The Institute's Florida-era legislative template and its
Pennsylvania-era distancing from Dover resolve into the same underlying
preference (favor legislation that survives court review over a district's
own disclaimer that doesn't), showing up twice, four years apart.
`tennessee-lpm`'s own coherence-finding record
(`TNLP-FINDING-1973-law-vs-2012-law-framing-shift`) independently arrives at
a closely related observation about Tennessee's 2012 law's carefully secular
language — plausibly the same broader post-Kitzmiller strategic shift,
though no Discovery Institute actor record exists in `tennessee-lpm` itself,
since this repo's own research found no direct institutional tie between
the Institute and Tennessee's 2012 bill specifically (see that repo's own
source-notes for what was and wasn't confirmed).

## American Civil Liberties Union (ACLU)

Confirmed in **two** of the three repos, with the Pennsylvania and
Tennessee records describing genuinely different kinds of cases a full
82 years apart.

- **Pennsylvania** (`PALP-ACTOR-aclu`): its Pennsylvania affiliate (ACLU of
  Pennsylvania; attorneys Vic Walczak and Paula Knudsen) was co-counsel for
  the Kitzmiller plaintiffs — a real civil lawsuit against a specific,
  already-adopted district policy, brought by affected parents.
- **Tennessee** (`TNLP-ACTOR-aclu`): the organization's own 1925
  advertisement is what directly produced the Scopes Trial in the first
  place — a deliberately engineered test case the ACLU itself solicited,
  recruiting a willing defendant before any actual harm had occurred, rather
  than a response to an aggrieved party's complaint. Forty-two years
  later, the ACLU (via attorney William Kunstler) also represented Gary
  Scott, whose 1967 firing for teaching evolution was a real, unplanned
  grievance — much closer in shape to the Dover case than to the organized
  Scopes test case.

**The throughline**: the ACLU's own two Tennessee-era cases (1925's
engineered test case and 1967's real grievance) already show the organization
using both of the strategies Pennsylvania's single case (1925's
engineered-test-case logic, replayed as organized litigation after a real
grievance in 2004) also displays — meaning Pennsylvania's Dover case sits
structurally closer to Tennessee's 1967 Gary Scott case (a real firing/real
policy, litigated after the fact) than to Tennessee's own 1925 Scopes case
(a deliberately solicited test), even though Dover and Scopes are the two
most famous episodes across all three repos. Reading the ACLU's role across
both repos side by side is what surfaces this — neither record alone states
it.

## Why this is a narrative document rather than a merged database record

This ecosystem's established convention (see any of these three repos' own
`CONTRIBUTING.md`) treats cross-repo references as informal, deliberately:
plain strings, unvalidated, until a base repo's own schema and content
patterns stabilize enough to formalize. Consolidating
NCSE's three records (or Discovery Institute's two, or the ACLU's two) into
one canonical record now would mean picking one repo to "own" that identity
and demoting the others to pointers, which would break each repo's own
internal self-containedness (a reader of `tennessee-lpm` alone should not
need to open `florida-lpm` just to learn who NCSE is). `crossRepoRefs` plus
this narrative document gets the actual value asked for — a connected,
readable account of how these national actors' roles relate across
Florida/Pennsylvania/Tennessee — without that cost.
