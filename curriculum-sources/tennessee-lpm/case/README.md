# tennessee-lpm/case — CASE-format machine-readable standards

Mirrors `florida-lpm/case/` and `pennsylvania-lpm/case/`'s approach: files
conforming to
[`openevo-graph/schema/case_schema.json`](../../../../openevo-graph/schema/case_schema.json).

## Where the content came from

The **Common Standards Project API** has Tennessee's real, current (2022)
science standards as structured JSON, confirmed live by two independent
checks this session (a delegated research agent, and the main session's own
direct `curl` calls):

```
curl -s https://api.commonstandardsproject.com/api/v1/jurisdictions
# Tennessee: {"id":"180878796A3C448D808F38BCCCFD26CF","title":"Tennessee","type":"state"}

curl -s https://api.commonstandardsproject.com/api/v1/standard_sets/E068CD122CE146DFBCED7A17EE6E130A
# -> Biology I (grades 9-12), 25 real standards, document title "Tennessee
#    Academic Standards for Science", sourceURL dated 2022-10-28, license
#    CC BY 4.0 US (rightsHolder: Common Curriculum, Inc.)
```

**Three generations of Tennessee science standards exist in this API** (2009,
2016, and 2022) — the 2022 generation is the current, in-force one (adopted
October 2022, phased in from the 2025-26 school year, in effect through
2033-34); see `docs/source-notes/2026-10-20-tennessee-machine-readable-standards-landscape-research.md`
for the full detail, including a data-quality quirk (Tennessee's current-era
records don't carry an explicit `publicationStatus`/`valid` field the way
Florida's and Pennsylvania's do).

## A third distinct licensing case

Florida = CC BY 3.0 US. Pennsylvania = no confirmed open license.
**Tennessee = CC BY 4.0 US**, rightsHolder "Common Curriculum, Inc." — a
different version and a different rightsHolder than either sibling state.
Three states, three different licensing postures from the same aggregator.

## What's here

**`tennessee-2022-evolution-benchmarks.json`** — Tennessee's current (2022)
evolution/heredity cluster: strand "BIO1.LS4: Biological Change: Unity and
Diversity" (5 benchmarks, Biology I / grades 9-12), strand "BIO1.LS3:
Heredity: Inheritance and Variation of Traits" (4 benchmarks, Biology I),
and strand "8.LS4: Biological Change: Unity and Diversity" (5 benchmarks,
grade 8) — 17 `CFItems` total including the shared Domain/Strand hierarchy.
`adoptionStatus: "Active"` — this is the standard currently being phased
into classrooms.

## What's NOT here, on purpose

No complete re-publication of Tennessee's full K-12 science standard set
(Biology II, Chemistry, Physics, Earth/Space Science, Environmental Science,
and the rest of Life Science are out of scope). Biology II's own much
larger "BIO2.LS4" strand (28 benchmarks, including explicit "theory of
evolution" language and content on classification, phylogenetics, and
co-evolution) was found and is a real, available resource for a future
session wanting deeper coverage, but was not built out here. No CASE file
for either of the two older (2009, 2016) standard generations — this repo's
founding research didn't pull their full benchmark text, since the current
repo's central historical content (the 1925/1973/2012 statutes) all predate
even the oldest of these three API-catalogued standard generations and is
handled entirely through `institutional-mandate-record` instead.

## CASE Network / Standards Satchel — listed, but still unconfirmed by direct read

A search result specifically names a Tennessee page on the renamed CASE
Network 2 ("Satchel Rosetta"), reportedly with 14 frameworks — but direct
fetch attempts hit the same JavaScript-rendering wall as the Florida and
Pennsylvania research. Worth a human checking
`https://rosetta.commongoodlt.com/63b86793-ba9b-49e6-b02c-45e694997328`
directly in a real browser.
