# florida-lpm/case — CASE-format machine-readable standards

This directory holds files conforming to
[`openevo-graph/schema/case_schema.json`](../../../../openevo-graph/schema/case_schema.json)
— a real, already-existing implementation of the IMS Global/1EdTech CASE
(Competencies & Academic Standards Exchange) v1.0 specification in this
ecosystem, previously unused by any state curriculum-source repo until this
one.

## Where the content actually came from — two different findings, not one

Florida's official standards repository, **CPALMS** (run by the University
of South Florida), is — per a 1EdTech Consortium announcement — "the
authorized publisher of Florida academic standards in digital format,"
joining 1EdTech as a Contributing Member to publish Florida's standards via
CASE through the free public CASE Network. This repo's research could
**not** confirm that specific feed is actually live/browsable: both
`casenetwork.1edtech.org`/`rosetta.commongoodlt.com` (the CASE Network
registry) and CPALMS's own `Standards_API.aspx` page are JavaScript-rendered
apps that returned only page chrome to automated fetch, and a direct CASE
REST API query against them returned HTTP 403. **That specific lead remains
open** — see
[`docs/source-notes/2026-10-20-florida-machine-readable-standards-landscape-research.md`](../docs/source-notes/2026-10-20-florida-machine-readable-standards-landscape-research.md).

**A separate, different lead did come through, confirmed live the same
session**: the **Common Standards Project API**
(`api.commonstandardsproject.com`) is a plain REST API, not JS-rendered, and
direct `curl` calls against it worked immediately with no authentication:

```
curl -s https://api.commonstandardsproject.com/api/v1/jurisdictions
# -> Florida: {"id":"80B94A122D3D4B95884660FF09CC357E","title":"Florida","type":"state"}

curl -s https://api.commonstandardsproject.com/api/v1/standard_sets/80B94A122D3D4B95884660FF09CC357E_D1000338_grades-09-10-11-12
# -> the complete Grades 9-12 "Science (2008-)" standard set, 546 standards,
#    document D1000338 ("Science Next Generation Sunshine State Standards"),
#    publicationStatus "Published", independently licensed CC BY 3.0 US
#    (rightsHolder: Desire2Learn Incorporated)
```

This is real, structured, machine-readable Florida science-standards data —
not CASE format natively (it's the **ASN**, Achievement Standards Network,
data model, a predecessor/cousin schema to CASE), but genuine, live,
openly-licensed, and directly fetchable. The files in this directory are
**transformed from this confirmed-live source into CASE's own CFItem shape**
— not a last-resort hand-built fallback for unreachable content. See
`state/florida/lp/records/crosswalk.yaml`'s
`FLLP-CROSSWALK-sc912l15-common-standards-project-api` record for the full
detail.

**Still-open next step for a human (~10 minutes):** open
`rosetta.commongoodlt.com` or `casenetwork.1edtech.org` in a real browser and
search "Florida" to settle whether CPALMS's own *native CASE* feed (as
opposed to this confirmed Common Standards Project data) is also live. If it
is, compare it against this directory's files for any discrepancy before
treating either as sole source of truth.

## What's here

- **`florida-ngsss-2008-evolution-benchmarks.json`** — the 2008 Next
  Generation Sunshine State Standards (NGSSS), covering all of `SC.912.L.15`
  ("Diversity and Evolution of Living Organisms"): all 15 core benchmarks
  (`SC.912.L.15.1`-`.15`) plus 2 representative Access Points, transformed
  from the confirmed-live Common Standards Project data above.
  `adoptionStatus: "Active"` because this remains Florida's legally
  operative science standard pending the State Board's expected December
  2026 vote (the 2019-2020 B.E.S.T. Standards rewrite covered ELA/Math only,
  never touched science — independently confirmed by this same dataset's
  continuous, unbroken "Science (2008-)" subject tag).
- **`florida-2026-draft-science-standards.json`** — a `CFDocument`-only
  placeholder (`adoptionStatus: "Draft"`, no `CFItems`) for the proposed 2026
  rewrite. Deliberately empty of benchmark-level content: this repo's
  research characterizes the draft only through news reporting about it, not
  a direct read of the draft document itself (`fldoe.org/standardsreview/`
  returned HTTP 403 on automated fetch). Fabricating specific benchmark
  codes/text without having read the primary document would misrepresent
  this file's actual evidentiary basis.

## What's NOT here, on purpose

Neither file attempts a complete re-publication of the full ~546-item NGSSS
Grades 9-12 Science standard set (physical science, earth/space science, and
the rest of life science) or the proposed 2026 standard set — only
`SC.912.L.15`, the standard directly relevant to the evolution/climate-change
controversy this repo was founded to document. A future session wanting
full coverage can pull the rest directly from the confirmed-live Common
Standards Project API (same endpoint, same document id `D1000338`, just the
other `standards` entries in the response) rather than hand-transcribing
anything — the hard part (finding a working, licensed, machine-readable
source) is already done.

## Closing the loop once the 2026 standards are actually adopted

Once the State Board votes (expected December 2026): add a real `CFItems`
array to `florida-2026-draft-science-standards.json` (or a new,
dated file if the adopted text differs meaningfully from the draft), set its
`adoptionStatus` to `"Active"`, set `florida-ngsss-2008-evolution-benchmarks.json`'s
`adoptionStatus` to `"Superseded"`, and add a `replacedBy`-type
`CFAssociation` linking the two `CFDocument`s — the same supersession-chain
pattern `openlpm/scripts/import_curriculum_repository.py` already resolves
for `policy-timeline-event`/`institutional-mandate-record` pairs (via
`supersedes`/`supersededBy`), applied here at the CASE-document level
instead.
