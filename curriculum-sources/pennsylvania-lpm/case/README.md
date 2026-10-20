# pennsylvania-lpm/case — CASE-format machine-readable standards

Mirrors `florida-lpm/case/README.md`'s approach: files conforming to
[`openevo-graph/schema/case_schema.json`](../../../../openevo-graph/schema/case_schema.json).

## Where the content came from

The **Common Standards Project API** (`api.commonstandardsproject.com`) has
Pennsylvania's real, current (2022) STEELS science standards as structured
JSON, confirmed live the same session as Florida's equivalent check:

```
curl -s https://api.commonstandardsproject.com/api/v1/jurisdictions
# Pennsylvania: {"id":"5A99211C6D874994A2CFEE2AE40023DD","title":"Pennsylvania","type":"state"}

curl -s https://api.commonstandardsproject.com/api/v1/standard_sets/5A99211C6D874994A2CFEE2AE40023DD_D21358967_grades-09-10-11-12
# -> 177 real standards, document D21358967 "Science, Technology & Engineering
#    and Environmental Literacy & Sustainability Standards (STEEL)",
#    publicationStatus "Published"
```

Cross-validated against a second, independent CSP cataloging of the same
content (document D21302564), which uses a different internal code scheme
but identical benchmark wording at grades 6-8 — the parallel grades-9-12
entry for *that* cataloging came back empty, a data-quality gap in that one
specific catalog entry, not in STEEL itself (which is complete at every
grade band checked).

## A real difference from Florida: no confirmed open license

Florida's equivalent Common Standards Project data was independently
licensed **CC BY 3.0 US**. Pennsylvania's is **not** — the API's license
`title`/`URL` fields are both blank for this document, with `rightsHolder`
listed only as "D2L Corporation" (almost certainly the data submitter, not a
rights claim). This repo's records rely instead on Pennsylvania's own
apparent non-assertion of copyright over its standards documents (direct
inspection found no copyright notice on the actual PDFs, one of which
explicitly says "these standards are offered as a voluntary resource") —
see `state/pennsylvania/local_policy/records/mandates.yaml`'s
`licenseOrRightsNote` fields for the full legal discussion, including the
relevant statute (71 Pa. Stat. Ann. § 636) that makes Pennsylvania's
*default* legal posture less automatically public-domain-friendly than
Florida's, even though these specific documents don't exercise that option.

## What's here

**`pennsylvania-steels-2022-evolution-benchmarks.json`** — Discipline 3.1
Life Science's five evolution/heredity-related strands (Inheritance of
Traits, Variation of Traits, Evidence of Common Ancestry and Diversity,
Natural Selection, Adaptation), at both the 6-8 and 9-12 grade bands: 17
benchmarks plus the shared Strand/Domain hierarchy, 23 `CFItems` total.
`adoptionStatus: "Active"` — STEELS has been the fully mandatory standard
since the 2025-2026 school year (the prior 2002 standards sunset
2025-06-30).

## What's NOT here, on purpose

No complete re-publication of the full ~177-item grades-9-12 Science
standard set (physical science, earth/space science, technology/engineering,
and the rest of life science are out of scope). No CASE file for the
superseded 2002 "Academic Standards for Science and Technology" — its full
benchmark set beyond the single evolution standard (3.3.10.D) was not
independently re-fetched this session; its quoted text lives in
`state/pennsylvania/local_policy/records/mandates.yaml` instead.

## CASE Network / Standards Satchel — still unconfirmed

Same open item as Florida: `casenetwork.1edtech.org`/`rosetta.commongoodlt.com`
could not be checked via automated fetch (JavaScript-rendered). A secondhand,
unverified search result claims "Pennsylvania has 20 frameworks available
through the CASE Network" — worth a human checking directly in a real
browser before treating it as confirmed.
