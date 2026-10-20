# Machine-readable curriculum-standards landscape for Pennsylvania — founding research (2026-10-20)

Mirrors the Florida machine-readable-standards research pass. Confirms the Common Standards Project API covers Pennsylvania's current science standards too, with one real difference from Florida worth flagging: the licensing metadata.

## Common Standards Project API — confirmed real, high confidence

Step 1 — jurisdiction lookup: `GET https://api.commonstandardsproject.com/api/v1/jurisdictions` → Pennsylvania entry: `"id":"5A99211C6D874994A2CFEE2AE40023DD", "title":"Pennsylvania", "type":"state"`.

Step 2 — jurisdiction detail (295 total standardSets): `GET https://api.commonstandardsproject.com/api/v1/jurisdictions/5A99211C6D874994A2CFEE2AE40023DD`. Four current (2022-) published science-related document families, plus many deprecated 2009-2012 ones:

- **D21358967 — "Science, Technology & Engineering and Environmental Literacy & Sustainability Standards (STEEL)"** — Pennsylvania's actual official rewrite (the state's own 2023 published PDF calls it "STEELS"; the API's internal title drops the trailing S). Published. Grade-banded entries K, 1, 2, 3, 4, 5, 6-8, 9-12. `sourceURL` points to the PA Department of Education's own pdesas.org hub page.
- D21302564 — "Pennsylvania Integrated Standards for Science, Environment and Ecology (Grades 6-12)" — same real 2022 content, catalogued a second time under a different subject tag.
- D21302386 — "...Science, Environment, Ecology, Technology and Engineering (K-5)" — 2022, Published.
- D21302749 — "Pennsylvania Technology and Engineering Standards (6-12)" — 2022, Published (the non-science half of STEELS).

Plus many **Deprecated** 2009-2012 sets (old PA Academic Standards for Science / Environment and Ecology / Science-Technology-Engineering, and 2007 Assessment Anchors) — PA's standards history is also captured, not just the current version.

Step 3 — fetching content: `GET https://api.commonstandardsproject.com/api/v1/standard_sets/5A99211C6D874994A2CFEE2AE40023DD_D21358967_grades-09-10-11-12` → 177 real standards, confirmed non-placeholder.

**Data-quality finding**: the parallel "Science, Environment and Ecology" cataloging (D21302564) for grades 9-12 came back with **zero standards** (empty shell) despite being marked `publicationStatus: Published`. The grades 6-8 version of that same document DID have real content (100 standards) — cross-checked against STEEL's own grades 6-8 content: different internal node IDs and a different code scheme (PA's official `3.1.6-8.X` notation in STEEL vs. a CSP-internal `LSN.68.5`-style shorthand in D21302564), but **identical benchmark wording**. This cross-match gives high confidence the STEEL content is authentic PA text, not placeholder data. **Use STEEL (D21358967) as the reliable set** — complete at every grade band checked (K, 6-8, 9-12); D21302564 has at least one empty gap.

## The benchmarks: PA's equivalent of Florida's SC.912.L.15

Discipline "3.1 Life Science" in STEEL, grades 9-12 (27 total entries; evolution/heredity-relevant strands quoted — "Inheritance of Traits," "Variation of Traits," "Evidence of Common Ancestry and Diversity," "Natural Selection," "Adaptation," PA's direct equivalent of Florida's SC.912.L.15 cluster):

- **3.1.9-12.P** (Inheritance of Traits) — "Ask questions to clarify relationships about the role of DNA and chromosomes in coding the instructions for characteristic traits passed from parents to offspring."
- **3.1.9-12.Q** (Variation of Traits) — "Make and defend a claim based on evidence that inheritable genetic variations may result from (1) new genetic combinations through meiosis, (2) viable errors occurring during replication, and/or (3) mutations caused by environmental factors."
- **3.1.9-12.R** (Variation of Traits) — "Apply concepts of statistics and probability to explain the variation and distribution of expressed traits in a population."
- **3.1.9-12.S** (Evidence of Common Ancestry and Diversity) — "Communicate scientific information that common ancestry and biological evolution are supported by multiple lines of empirical evidence."
- **3.1.9-12.T** (Natural Selection) — "Construct an explanation based on evidence that the process of evolution primarily results from four factors: (1) the potential for a species to increase in number, (2) the heritable genetic variation of individuals in a species due to mutation and sexual reproduction, (3) competition for limited resources, and (4) the proliferation of those organisms that are better able to survive and reproduce in the environment."
- **3.1.9-12.U** (Natural Selection) — "Apply concepts of statistics and probability to support explanations that organisms with an advantageous heritable trait tend to increase in proportion to organisms lacking this trait."
- **3.1.9-12.V** (Adaptation) — "Create or revise a simulation to test a solution to mitigate the adverse impacts of human activity on biodiversity."
- **3.1.9-12.W** (Adaptation) — "Construct an explanation based on evidence for how natural selection leads to adaptation of populations."
- **3.1.9-12.X** (Adaptation) — "Evaluate the evidence supporting claims that changes in environmental conditions may result in (1) increases in the number of individuals of some species, (2) the emergence of new species over time, and (3) the extinction of other species."

(Also present, less evolution-specific: 3.1.9-12.A-O cover cell biology, homeostasis, matter/energy cycling, ecosystems, group behavior.)

**Middle school (grades 6-8) equivalent** — same five strand names appear a grade-band earlier, confirming a genuine K-12 progression:

- **3.1.6-8.M** (Inheritance of Traits) — "Develop and use a model to describe why structural changes to genes (mutations) located on chromosomes may affect proteins and may result in harmful, beneficial, or neutral effects to the structure and function of the organism."
- **3.1.6-8.N** (Variation of Traits) — "Develop and use a model to describe why asexual reproduction results in offspring with identical genetic information and sexual reproduction results in offspring with genetic variation."
- **3.1.6-8.O** (Evidence of Common Ancestry and Diversity) — "Analyze and interpret data for patterns in the fossil record that document the existence, diversity, extinction, and change of life forms throughout the history of life on Earth under the assumption that natural laws operate today as in the past."
- **3.1.6-8.P** (Evidence of Common Ancestry and Diversity) — "Apply scientific ideas to construct an explanation for anatomical similarities and differences among modern organisms and between modern and fossil organisms to infer evolutionary relationships."
- **3.1.6-8.Q** (Evidence of Common Ancestry and Diversity) — "Analyze displays of pictorial data to compare patterns of similarities in anatomical structures across multiple species to identify relationships not evident in the fully formed anatomy."
- **3.1.6-8.R** (Natural Selection) — "Gather and synthesize information about the technologies that have changed the way humans influence the inheritance of desired traits in organisms."
- **3.1.6-8.S** (Natural Selection) — "Construct an explanation based on evidence that describes how genetic variations of traits in a population increase some individuals' probability of surviving and reproducing in a specific environment."
- **3.1.6-8.T** (Adaptation) — "Use mathematical representations to support explanations of how natural selection may lead to increases and decreases of specific traits in populations over time."

Confidence: HIGH that this is real, current PA text (cross-matched across two independent CSP catalogs, matches PA's known 2022/2023 STEELS rewrite naming, `sourceURL` resolves to the real PA Department of Education hub page).

## License/publication status — a real, flagged difference from Florida

Every PA standard-set document checked (STEEL and the parallel sets) returns the same license block: `"license": {"title": "", "URL": "", "rightsHolder": "D2L Corporation"}`. **This is different from Florida's explicit CC BY 3.0 US.** Here the license title and URL are both blank — no open-license statement is declared in PA's API data. "D2L Corporation" (the company behind the Brightspace platform) is listed as rightsHolder, likely reflecting who submitted this data import to Common Standards Project, not a legal claim that D2L owns Pennsylvania's standards. `publicationStatus` is "Published" (not draft/deprecated) for all four current document families — a separate, confirmed-good signal.

**Practical read**: the benchmark text itself is almost certainly safe for open educational reuse (a state's own published curriculum standard), but "CC BY 3.0 US, openly licensed" should NOT be claimed for Pennsylvania the way it was for Florida — that specific claim isn't backed by what the API actually returns. This repo's own records rely instead on the Commonwealth's own public-records posture (see the history research note's copyright-stance section: PA *can* claim copyright on its publications under 71 Pa. Stat. Ann. § 636 but these specific standards documents show no copyright notice and are offered as "a voluntary resource").

## PA's own site (pdesas.org) — no API, confirmed

Fetched `https://www.pdesas.org/Page/Viewer/ViewPage/58/?SectionPageItemId=12998` directly (the STEELS resource hub, the same URL the CSP API's `sourceURL` field points to). Confirmed: a plain document-repository page — standards, curriculum frameworks, assessment toolkits, training materials all distributed as downloadable PDF/Word/PowerPoint files. No API, no JSON feed, no developer/programmatic-access section. A general web search for a pdesas.org or PA Department of Education API turned up nothing. Confidence: HIGH that no such API exists publicly.

## CASE Network / Standards Satchel — could not directly confirm (tool limitation, not a negative finding)

`casenetwork.1edtech.org` (Satchel Rosetta) is JavaScript-rendered — the fetch tool got back an essentially empty page, same wall the Florida research hit. Secondhand, unverified: an eSchool News article and 1EdTech's own announcement describe CASE Network 2 as covering all 50 states' core-subject frameworks, and one search result stated "Pennsylvania has 20 frameworks available through the CASE Network" — not verified by loading the actual framework list. Worth a human checking `https://casenetwork.1edtech.org/` directly in a real browser, same as the open item left for Florida.

## Raw data

The agent's raw fetched JSON (jurisdiction listing, STEEL grades 9-12/6-8/K, and the cross-check catalogs) was moved to this session's scratchpad rather than left in the repo checkout; `case/` holds the OpenEvo-transformed CASE-format version actually meant to be committed.

---
*Research conducted via WebSearch/WebFetch (direct `curl`-equivalent REST calls, not browser automation) by a delegated research agent, 2026-10-20.*
