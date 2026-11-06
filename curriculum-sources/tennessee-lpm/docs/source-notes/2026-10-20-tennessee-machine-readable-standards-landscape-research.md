# Machine-readable curriculum-standards landscape for Tennessee — founding research (2026-10-20)

Mirrors the Florida and Pennsylvania machine-readable-standards research passes. The Common Standards Project API covers Tennessee too, confirmed independently twice (once by a delegated research agent, once directly by the main session), with a third distinct licensing case.

## Common Standards Project API — confirmed real, high confidence

`GET https://api.commonstandardsproject.com/api/v1/jurisdictions` → Tennessee: `"id":"180878796A3C448D808F38BCCCFD26CF","title":"Tennessee","type":"state"`.

**Three generations of Tennessee science standards found in the API**, all real:

- **"Science (2009-2016)"** — oldest. Document `D100033F`, "Tennessee Science Standards," `valid: "2009"`, explicitly `publicationStatus: "Deprecated"`. License CC BY 3.0 US, rightsHolder "Desire2Learn Incorporated."
- **"Science (2016-)"** — middle generation. E.g. document `D2766763`, "Tennessee Academic Standards: Biology I," `valid: "2016"`, explicitly `publicationStatus: "Published"` in its own metadata **despite being superseded in practice** by the 2022 revision — Tennessee's API data doesn't cleanly flip old records to "Deprecated" the way a `publicationStatus` field implies it should. License CC BY 3.0 US, rightsHolder "D2L Corporation."
- **"Science (2022-)"** — current, in-force generation. Title "Tennessee Academic Standards for Science." `sourceURL`: `https://www.tn.gov/content/dam/tn/stateboardofeducation/documents/standards/science/New%2010-28-22%20Science%20Standards.pdf` (the filename itself dates adoption to **2022-10-28**). License **CC BY 4.0 US**, rightsHolder **"Common Curriculum, Inc."** — confirmed by direct fetch of the live API response, not inferred.

**A real data-quality quirk, confirmed directly**: unlike Florida/Pennsylvania, the 2022-era records' `document` object carries no explicit `publicationStatus` or `valid` field at all — only `title` + `sourceURL`. Currency was confirmed independently via web search: the State Board adopted these standards in October 2022, classroom implementation phases in starting the 2025-26 school year, in effect through 2033-34 — meaning as of this repo's founding session (2026-10-20) they are the live, currently-taught standards, not a future draft.

## License comparison across all three state repos so far

Florida = CC BY 3.0 US. Pennsylvania = no license statement (blank fields). **Tennessee = CC BY 4.0 US, a different version AND a different rightsHolder ("Common Curriculum, Inc.") than either.** Three states, three distinct licensing postures for data pulled from the same aggregator API — a real finding about how inconsistent even a single third-party aggregator's own licensing metadata can be across states, not a pattern to assume is uniform going forward.

## The benchmarks: Tennessee's evolution/heredity cluster

**Biology I** (grades 9-12, current 2022 standards), fetched from `GET https://api.commonstandardsproject.com/api/v1/standard_sets/E068CD122CE146DFBCED7A17EE6E130A`. Strand **"BIO1.LS4: Biological Change: Unity and Diversity"** (5 benchmarks):

- **BIO1.LS4.1** — "Analyze and interpret scientific data that common ancestry and biological evolution are supported by multiple lines of empirical evidence (e.g. DNA sequences, amino acid sequences, anatomical structures, the fossil record, biogeography, or order of appearance of structures during embryological development)."
- **BIO1.LS4.2** — "Apply concepts of statistics (i.e. probability) to support explanations that organisms in a population with an advantageous heritable trait tend to increase in proportion to organisms lacking this trait."
- **BIO1.LS4.3** — "Analyze and interpret data that natural selection is influenced by (1) the potential for a species to increase in number, (2) the heritable genetic variation of individuals in a species due to mutation and sexual reproduction, (3) competition for limited resources, and (4) the proliferation of those organisms that are better able to survive and reproduce in the environment."
- **BIO1.LS4.4** — "Construct an explanation based on evidence for how natural selection leads to adaptation in populations."
- **BIO1.LS4.5** — "Obtain, evaluate, and communicate information about how changes in environmental conditions may result in (1) increases in the number of individuals of some species, (2) the emergence of new species over time, and (3) the extinction of other species."

Plus the adjacent strand **"BIO1.LS3: Heredity: Inheritance and Variation of Traits"** (4 benchmarks, directly feeds the above): LS3.1 (mitosis), LS3.2 (meiosis and genetic variation), LS3.3 (genes/alleles and gene expression), LS3.4 (sources of genetic variation — crossing over, mutation, environmental factors).

**Grade 8** (middle school, current 2022 standards), fetched from `standard_sets/D19049B7586D4FD2B5E1CE17D2694B94`. Strand **"8.LS4: Biological Change: Unity and Diversity"** (5 benchmarks) — the direct NGSS MS-LS4 analog: LS4.1 (fossil record patterns), LS4.2 (anatomical/genetic comparison of extinct and extant organisms), LS4.3 (genetic variation and survival probability), LS4.4 (natural selection and environmental change), LS4.5 (artificial selection technologies).

**Also found, not the core focus**: Biology II (elective) has a much larger 28-benchmark "BIO2.LS4" strand covering classification/phylogenetics across all life, including explicit evolution-theory language (e.g. BIO2.LS4.2: "...explain how these patterns support the theory of evolution"), endosymbiosis, cladograms, and co-evolution — available as a richer future resource if this repo's scope ever expands beyond the core Biology I/grade 8 cluster.

**A data oddity worth flagging**: Grade 6's standard set encodes two different strands both under the notation "6.LS4" (one on biodiversity/ecosystem services, one on Earth's Systems) — likely a real numbering quirk in Tennessee's own source document, not a fetch error.

## Tennessee's own site — no API, confirmed (medium confidence on the specific block reason)

The Tennessee Department of Education's own standards hub (`tn.gov/education/districts/academic-standards/science-standards.html`) was confirmed via search to exist and host only PDF downloads, no API — consistent with Florida/Pennsylvania. Direct `curl`/WebFetch attempts against tn.gov returned **HTTP 403 Forbidden** (the state's own site appears to run bot-blocking) — this specific finding rests on a search-result snippet, not a page read directly, since the site itself could not be fetched.

## CASE Network / Standards Satchel — Tennessee IS listed, but still unfetchable directly

A search result specifically names a Tennessee page on the renamed CASE Network 2 (now "Satchel Rosetta"): `https://rosetta.commongoodlt.com/63b86793-ba9b-49e6-b02c-45e694997328`, "Tennessee Academic Standards for Science," reportedly 14 frameworks including "Academic Standards by Grade, Disciplinary Core Ideas and Component Ideas, and Crosscutting Concepts." Direct `curl` fetches of both that specific URL and the main registry succeeded (HTTP 200) but returned only a client-side-rendered Vue.js app shell with no usable data in the raw HTML — the same JavaScript-rendering wall hit in both prior states' research. The "14 frameworks" claim is therefore medium-confidence (from a search snippet), not independently verified by reading the page.

## Bottom line

Tennessee's current (2022, in-force) evolution/heredity benchmark cluster is real, complete, openly licensed (CC BY 4.0 US), and was fetched directly from a live API, cross-confirmed by two independent passes (a delegated research agent and the main session's own direct `curl` calls). `case/tennessee-2022-evolution-benchmarks.json` is built from this data.

---
*Research conducted via WebSearch/WebFetch by a delegated research agent, and via direct curl calls in the main session, both 2026-10-20.*
