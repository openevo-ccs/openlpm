# Machine-readable curriculum-standards landscape for Florida — founding research (2026-10-20)

Research into whether a real, existing machine-readable representation of Florida's K-12 science standards already exists, before hand-building one in `case/`. All findings are from direct page fetches or search-result excerpts on 2026-10-20 unless marked "uncertain." This document is what `case/README.md` and `GOVERNANCE.md`'s CASE-layer section summarize — read it before assuming a live CASE feed can replace this repo's hand-built files.

## 1. CPALMS — API and CASE format

**CPALMS has a "Standards in Machine-readable Format" page/API** (`cpalms.org/Standards/Standards_API.aspx`), linked from the main Standards Viewer page. Confirmed to exist as a linked resource. Its actual format (REST/XML/JSON) and auth requirements could not be confirmed — the page didn't render through automated fetch (menu-only, no body content came through). **Needs a human to open it in a real browser.**

**CPALMS and CASE/1EdTech — two signals, reconciled:**
- `site.imsglobal.org/certifications/cpalms` (1EdTech's own certification directory) states: **"CPALMS is not a member of 1EdTech"** and shows no active product certifications (tracks formal conformance certification, e.g. LTI/QTI/CASE *products*).
- A **separate, confirmed announcement** from 1EdTech (`imsglobal.org/event/florida-case-network-workshop-invitation-only`) states verbatim: *"CPALMS, the authorized publisher of Florida academic standards in digital format, is joining 1EdTech Consortium as a Contributing Member, and is publishing Florida academic standards using the Competencies & Academic Standards Exchange (CASE) standard and distributing these standards at no charge through the CASE Network."* Tied to a "Florida CASE Network Workshop (Invitation Only)" for Florida district tech/curriculum leaders, dated "Thursday, 27 February" (year not stated on the page itself; most likely Feb 2025 or Feb 2026 based on search scoping).

**Reading (not independently confirmed further):** "Contributing Member" is a membership tier, distinct from the formal product-certification status the other page tracks — both statements can be true at once. **Not confirmed:** whether Florida's CASE frameworks are actually live and browsable in the CASE Network registry today. The registry's live framework list did not render through automated fetch (`casenetwork.1edtech.org` / the newer `rosetta.commongoodlt.com` are both JS-driven apps returning only page chrome); a direct CASE REST API query returned HTTP 403. **Needs a human to open `casenetwork.1edtech.org` or `rosetta.commongoodlt.com` in a real browser and search "Florida" to settle this.**

## 2. The 1EdTech/IMS Global CASE Network — what it is, who's on it

Confirmed, well-documented: CASE Network is 1EdTech's free, public registry/distribution service for state and national academic standards in the CASE JSON format. Publicly browsable (read-only) with no login; bulk JSON/Excel download and the authenticated API require a free login. Current operator/technology partner: **Common Good Learning Tools (CGLT)**, running the "Satchel"/"Standards Satchel" platform — the registry is migrating from `casenetwork.1edtech.org` to `rosetta.commongoodlt.com` (old URLs stay live until at least June 2026, per a 1EdTech announcement).

Confirmed state participants by name: **Georgia, South Carolina, Texas, Montana** (named in the original CASE Network collaboration announcement), plus a broader "all 50 states" claim for math/ELA common-core-adjacent frameworks in "Network 2." Separately, **Standards Satchel's own site lists its state-DOE customers by name: Alabama, Arizona, Georgia, Idaho, Montana, North Carolina, Oklahoma, South Carolina, Wisconsin (dedicated hosting) and Delaware, Kentucky, Virginia (shared hosting)** — Florida is not in that list, but that list is CGLT's *paying hosted-platform* customers specifically, not necessarily every state whose standards appear in the free public CASE Network registry (CPALMS could self-host and just publish into the network, per item 1 above).

## 3. "Satchel Commons" / "Commons Case Network"

Real, not a garbled reference — it's "**Standards Satchel**" (a.k.a. "Satchel Commons" for the shared/free-tier hosting option), made by Common Good Learning Tools (CGLT), described on their own site as "the premier CASE-based Competency Management platform." Lets an agency draft, review, crosswalk, and publish standards in CASE format. Pricing tiers: dedicated server ~$24K/yr (public agencies) or ~$50K/yr (ed-tech companies); shared hosting ("Satchel Commons") ~$6K/yr; free tier limited to one user/five frameworks. **Distinct from "Satchel One/Satchel Pulse"** (the UK/US school MIS company) — no indication of a relationship. Florida/CPALMS is not named among CGLT's direct hosted customers, though per item 1, Florida may publish into the CASE Network through a different route.

## 4. "Learning Commons MCP"

Real, specific product, confirmed via its own docs/GitHub: **Learning Commons** (`learningcommons.org`, GitHub org `learning-commons-org`) runs a "**Knowledge Graph**" — a structured dataset connecting academic standards, granular "Learning Components," learning progressions, and curriculum/learning-science data — exposed via local files, a REST API, and an **MCP server** (`docs.learningcommons.org/knowledge-graph/using-knowledge-graph/mcp-server`). Almost certainly the same connector appearing as the (unauthorized, this session) "Learning Commons Knowledge Graph" MCP tool in the researcher's own Claude Code environment.

**Not confirmed:** who legally owns/runs Learning Commons (nonprofit vs. company, funders) — not stated on their own pages. State/jurisdiction coverage is not itemized anywhere readable, and **Florida is never mentioned** in either the docs site or the GitHub README. No reference to CASE or 1EdTech format — looks like an independent schema, not a CASE re-export. One concrete described capability: identifying prior/subsequent standards in a learning progression based on the Student Achievement Partners (SAP) Coherence Map for Mathematics — **math-specific**, not science.

**Bottom line:** real product, plausible connection to the MCP tool visible in this ecosystem's own session, but no confirmed Florida science-standards coverage, and it could not be tested directly (unauthorized this session — would need Dustin to approve the connector via claude.ai connector settings or `/mcp` first).

## 5. Other structured/machine-readable sources for Florida science standards

- **Common Standards Project** (`commonstandardsproject.com`, API at `api.commonstandardsproject.com`, open-source importer on GitHub under `commonstandardsproject/api`) — confirmed to carry **some** Florida standards (e.g. Computer Science 2024-, Early Learning), free API key available. Could not confirm NGSSS/B.E.S.T. *science* specifically — the browse page is JS-rendered and didn't return content to automated fetch. **The most promising lead to check by hand next** — free, real public API, standards-as-data rather than a document viewer.
- **CommonPlanner** (`commonplanner.com`, from "Common Curriculum") — confirmed to carry Florida's **2024 Environmental Science** standards specifically, with embedded JSON-LD structured data on the page and CSV/PDF export (free account required). Explicitly cites CPALMS as the source of record. Not CASE format — CommonPlanner's own schema.
- **academicbenchmarks.com** — no direct evidence of Florida coverage found either way; unconfirmed, not ruled out.
- **achievethecore.org** — has an "FL Standards Advocates" page, but that's advocacy/PD, not a structured-data export.
- **standards.google** — no results in any search; could not confirm it exists or is relevant.
- No GitHub repos, Wayback-Machine-archived structured pages, or state open-data portals surfaced with Florida NGSSS/B.E.S.T. *science* standards in CASE or any other structured schema, beyond the two leads above.

## Timely context, independent of the format question

**Florida is actively rewriting its K-12 science standards right now.** FLDOE released proposed standards (first full rewrite since 2008); multiple outlets (`cfpublic.org`, `wlrn.org`, NCSE) reported as of Oct 1 2026 that **the word "evolution" is absent from the proposed high-school life-science standards** — a sharp change from the 2008 standards, which explicitly covered natural selection and Darwin's reasoning. Climate change is also absent. Public comment open via `fldoe.org/standardsreview/` (returned HTTP 403 on automated fetch — a human would need to check this directly). Final adoption reportedly expected around December 2026, phased implementation over four years. **Whatever Florida standards file this repo builds needs versioning for "pre-2026 (evolution-inclusive)" vs. "2026 rewrite (evolution-sidelined)" — a live-moving target, not a stable one-time snapshot.** (This matches and independently corroborates the parallel history-research pass in `2026-10-20-florida-evolution-curriculum-policy-history-research.md`.)

## Bottom-line recommendation (acted on in this repo)

**Hand-build the Florida standards file from primary document text for now** (see `case/`). No lead above gives a confirmed, directly-fetchable CASE JSON export for Florida science standards that could actually be opened and verified. The two most promising live leads — CPALMS's own CASE Network participation, and Common Standards Project's API — are both real and worth a human double-checking in an actual browser (JS-rendering blocked every automated fetch attempt on both), but neither is confirmed working today for Florida *science* content specifically.

**Concrete next step for a human, ~10 minutes, before trusting this recommendation further:** open `rosetta.commongoodlt.com` or `casenetwork.1edtech.org` and search "Florida"; separately check `api.commonstandardsproject.com` (free API key) for an NGSSS/B.E.S.T. science jurisdiction match. If either turns up live Florida science data, `case/`'s hand-built files should be superseded by a real crosswalk to that feed (`curriculum-crosswalk-record.sourceSystem: case-network-conformant-publisher`) rather than kept as the system of record.

## Update, same day — Common Standards Project confirmed live via direct API calls

The research above (done by a delegated agent using WebSearch/WebFetch) could
not confirm Common Standards Project's science coverage because its browse
*page* is JS-rendered. Calling its REST API directly with plain `curl` (no
browser, no JS engine involved) worked immediately, with no authentication:

```
curl -s https://api.commonstandardsproject.com/api/v1/jurisdictions
# Florida: {"id":"80B94A122D3D4B95884660FF09CC357E","title":"Florida","type":"state"}

curl -s https://api.commonstandardsproject.com/api/v1/standard_sets/80B94A122D3D4B95884660FF09CC357E_D1000338_grades-09-10-11-12
# -> full JSON: 546 standards, document D1000338 "Science Next Generation
#    Sunshine State Standards", publicationStatus "Published", subject tag
#    "Science (2008-)" (no end year -- independently confirms the B.E.S.T.
#    rewrite never touched science), license CC BY 3.0 US
#    (rightsHolder: Desire2Learn Incorporated)
```

This returned the complete, exact text of all 15 `SC.912.L.15` benchmarks
(evolution) plus Access Points, directly — not via a secondary mirror. One
correction this produced: an earlier-reported characterization of
`SC.912.L.15`'s own statement ("the fundamental concept underlying all of
biology... supported by multiple forms of scientific evidence") does **not**
appear at that structural level in the real data — the standard's actual,
exact title/statement is simply **"Diversity and Evolution of Living
Organisms."** The longer phrasing may exist elsewhere in FLDOE's framework
preamble/rationale text (not located) as a characterization of the
standard's intent, not as the standard's own wording. `state/florida/local_policy/records/mandates.yaml`
was corrected accordingly.

This does **not** resolve the original CASE Network/CPALMS question above —
that specific feed (1EdTech's native CASE format, as opposed to Common
Standards Project's separate ASN-format data) is a different thing and
remains unconfirmed, still blocked by JS rendering. Both findings now stand
side by side: Common Standards Project is a confirmed, live, directly
fetchable source; the CASE Network/CPALMS feed is reported to exist but
still needs a human with a real browser to settle.

The full real benchmark set this unlocked is now in
`../../case/florida-ngsss-2008-evolution-benchmarks.json`, and the live
endpoint itself is recorded as `FLLP-CROSSWALK-sc912l15-common-standards-project-api`
in `../../state/florida/lp/records/crosswalk.yaml`.

---
*Research conducted via WebSearch/WebFetch by a delegated research agent, 2026-10-20; the Common Standards Project API confirmation above was done via direct `curl` calls in the main session the same day.*
