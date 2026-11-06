# india-lpm (curriculum-sources/india-lpm)

**OpenEvo CCS Lab's intelligence layer for Indian education policy** — the
source material behind OpenLPM's India/Kerala/Karnataka/Maharashtra
Curriculum Repository projects (see [`GOVERNANCE.md`](GOVERNANCE.md); not
yet a ConceptBase-governed Foundational Repo). Founded 2026-09-30 as
`india_lp`, a standalone sibling repo to `deutsche_lp`/`nys_lp`; moved here,
inside `openlpm` itself, on 2026-10-09 at Dustin's request rather than going
through the same local-folder-rename limbo (Windows file-lock issues) that
slowed down `deutsche_lp`'s and `nys_lp`'s own pending `-lpm` renames —
`deutsche_lp`/`nys_lp` are unaffected by this move and remain separate
sibling repos for now. Nothing about this repo's own content, schema, or
governance model changed in the move, only where it lives on disk and in
git history (this folder's own git history starts fresh here; the original
`india_lp` repo was never pushed to a remote, so nothing external pointed
at it). See
`docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
in `lab_manager` for the three-way design comparison this was founded
alongside, and
`docs/design-notes/thematic-vs-regional-lpm-ecosystem-scoping-2026-09-30.md`
for why India was the real first country beyond Germany and New York, ahead
of Zambia and Madagascar.

## What's actually here, and what isn't yet

**This repo's founding session deliberately scoped itself to non-text
groundwork only** — institutional-actor records (who NCERT, CBSE, and two
state textbook boards actually are, legally and institutionally) and a
licensing-landscape research pass, not curriculum content itself. That
scoping decision was explicit, not accidental: before storing any actual
Indian government curriculum-policy *text*, this ecosystem's own standing
rule (see
[`lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`](../lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md))
requires a real legal read on redistribution rights for that specific
source — non-text groundwork like this can proceed in parallel without
waiting on that.

**What exists as of founding (2026-09-30):**
- 4 institutional-actor records: the Ministry of Education, NCERT, and CBSE
  at the national level; DSERT (Karnataka) and Balbharati (Maharashtra) at
  the state level.
- 4 policy-timeline-event records, all specifically about India's
  curriculum-licensing landscape (NCERT's own asserted copyright terms,
  NCERT's 2013 NROER open-license experiment, Karnataka's confirmed-open
  KOER license, Maharashtra's 2020 fee revision) — not about curriculum
  content itself.
- A full research write-up:
  [`docs/source-notes/2026-09-30-india-curriculum-licensing-landscape-research.md`](docs/source-notes/2026-09-30-india-curriculum-licensing-landscape-research.md),
  every claim sourced, every gap flagged.
- A scoping document for what a real legal review still needs to answer:
  [`docs/strategy/2026-09-30-india-legal-review-scope.md`](docs/strategy/2026-09-30-india-legal-review-scope.md).

**What does NOT exist yet, on purpose:** any `institutional-mandate-record`
quoting actual NCERT/CBSE/state curriculum-policy text, any
`coherence-finding-record` comparing curriculum documents directly, and any
`policy-principle-record`/`policy-brief-manifest-record` outreach content.
All three would require either quoting real curriculum text (gated on the
legal review) or a level of comparative research this founding session
didn't attempt.

## Update 2026-10-02 — Karnataka given real depth; outreach drafted

Per Dustin Eirdosh's own call: Karnataka gets built out in real depth (no
legal review blocks it — KOER's CC BY-SA 4.0 license is independently
confirmed), while Maharashtra stays deliberately thin. Added: an
institutional-actor record for **IT for Change**, the NGO that was KOER's
real implementation partner (confirmed by reading KOER's own "Brief note on
KOER" page directly); a timeline event covering KOER's actual 2013-14
founding as a Class-IX-only pilot under the national RMSA Karnataka scheme,
later grown to Class 8–10; and this repo's **first coherence-finding-record**
(`state/karnataka/local_policy/records/coherence-findings.yaml`), anchoring
the Karnataka-vs-NCERT licensing contrast to one real, named chapter (Class
10 Science, "Heredity") instead of stating it only in the abstract. That
finding's own `exhaustivenessCaveat` is deliberately honest about two
limits: the NCERT-side chapter-numbering comparison rests on background
knowledge, not a fresh primary-source check this session, and KOER's own
page for this chapter is, as of today, a thin structural stub, not a
fully-authored resource — open licensing and content maturity are different
things.

Also drafted (not sent — needs Dustin's own review and hand):
[`docs/strategy/2026-10-02-india-legal-scholar-outreach-draft.md`](docs/strategy/2026-10-02-india-legal-scholar-outreach-draft.md),
a short, specific outreach note to Rahul Bajaj (co-author of the 2021 IJCL
paper this repo's own legal research already leans on), continuing the
informal-expert-read path chosen 2026-09-30 but never actually started.

This repo's first real git commit also happened today — founded 2026-09-30
but never committed until now.

## Update 2026-10-02 (second entry) — Kerala added, at a partner's request

A partner working in Kerala asked about covering the Kerala Curriculum
Framework (KCF). Real research found: SCERT Kerala (an autonomous body of
the state's own Department of General Education — a literal government
department, not a registered society like NCERT/CBSE) publishes Kerala's
textbooks under a bare copyright notice, no Creative Commons or other
reuse license found anywhere checked. Restrictive, like Maharashtra — but
without Maharashtra's fee-based licensing dispute, and with a cleaner
"government work" legal footing than NCERT's, since the rights-holder here
is a department, not a society. No Karnataka-style open platform exists in
Kerala's own ecosystem (its real free-software reputation is about school
IT infrastructure, not curriculum-text licensing).

Kerala is filed like Maharashtra as a result — real institutional facts
and page-cited structural detail, no quoted textbook text. One genuinely
distinctive finding did come out of the research, though: Kerala has a
real, on-the-record public dispute with NCERT over NCERT's 2023-2024
deletion of evolution/Darwin content from national textbooks — Kerala's
Chief Minister publicly criticized it, and SCERT directed schools to keep
teaching the removed material. Kerala's own Class 10 Biology textbook
(read directly) still carries a full evolution chapter, including a named
human-lineage diagram — exactly the kind of content NCERT removed
nationally, now anchored in this repo as a real state-vs-national
comparison rather than left as a loose news item. See
[`state/kerala/README.md`](state/kerala/README.md) and
[`state/kerala/local_policy/records/coherence-findings.yaml`](state/kerala/local_policy/records/coherence-findings.yaml).

## The real finding worth knowing before treating "India" as one case

Unlike New York (one state, one Board of Regents, one answer), India's
licensing picture is genuinely **not uniform across states** — closer to
Germany's 16-Land structure than to New York's single-jurisdiction
simplicity, though for a different underlying reason (a shared national
copyright *law* applied very differently by autonomous state bodies, not 16
separately-governed Länder each writing their own policy). Two real,
opposite data points already confirmed:

- **Karnataka's DSERT** runs KOER, hosting the state's own curriculum
  materials in full under an explicit **CC BY-SA 4.0** license — genuinely
  open, already checkable, no legal review needed to build on it.
- **Maharashtra's Balbharati** asserts copyright and charges third-party
  publishers a real, recently-increased licensing fee — restrictive, with a
  documented public objection from the Association of Publishers and
  Distributors.

And at the national level, **NCERT's own copyright status is a genuinely
open legal question**, not a settled one: NCERT is a registered society, not
literally a government department, which leaves it unclear whether the
Copyright Act 1957's "government work" provision (a fixed 60-year term,
distinct from ordinary copyright) applies to its textbooks and curriculum
frameworks by plain statutory text. See the source-notes doc's Q2 for the
full legal detail and what remains genuinely unresolved.

## Repository structure

```
national_ccs_policy/  — actors, timeline events, and (eventually) policy
                         principles at the national (NCERT/CBSE/Ministry of
                         Education) level

state/karnataka/      — Karnataka case: DSERT/KOER, a confirmed-open
                         licensing example
state/maharashtra/    — Maharashtra case: Balbharati, a confirmed-restrictive
                         licensing example
state/kerala/         — Kerala case: SCERT, a confirmed-restrictive-but-
                         uncontested licensing example, plus a real
                         evolution-content-retention finding (see below)
                         (structure mirrors deutsche_lp/land/ and
                         nys_lp/state/ -- adding more states doesn't
                         require restructuring anything)

schema/   — JSON Schemas for every record type in this repo (all 9, same
            set as deutsche_lp/nys_lp, most not yet populated)
scripts/  — validate_records.py, ported from the sibling repos
docs/     — source notes (the full licensing-landscape research) and
            strategy (the legal-review scoping doc)
```

## Sibling repos: deutsche_lp and nys_lp

This repo mirrors their architecture deliberately — same 9 record schemas,
same `verificationStatus` discipline, same lifecycle states — so all three
stay genuinely comparable. See
[`GOVERNANCE.md`](GOVERNANCE.md) for the one real structural difference this
repo adds (the `accessTier` storage-tier field, present from day one here
rather than retrofitted, and used more conservatively than in the two
older repos pending India's own legal review).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md)
— read the accessTier discipline in `CONTRIBUTING.md` before adding any
record that quotes actual Indian government curriculum text.

## Part of the CCS Lab ecosystem

- **[`deutsche_lp`](../../../deutsche_lp/)** / **[`nys_lp`](../../../nys_lp/)**
  — the sibling repos this one's schema/governance mirrors, still standalone
  repos (not folded into `openlpm`); see
  `lab_manager/docs/design-notes/2026-09-30-regional-curriculum-source-storage-tiers.md`
  for the direct three-way comparison.
- **`openlpm`** (this repo, two levels up) — `scripts/import_curriculum_repository.py`
  reads this folder directly and upserts into the live Curriculum Repository
  projects (`india-curriculum-repository` and its `karnataka`/`maharashtra`/
  `kerala` children). The app's `project_jurisdictions`/`project_subject_area_tags`
  tables already support tagging a project to India or an Indian state,
  crosswalked against the same shared grade-band/subject-area vocabulary
  (`isced-age-bands-v1`, `starter-subject-areas-v1`) deutsche_lp/nys_lp-derived
  projects use — no new mechanism needed for that part.
- **[`conceptbase`](https://github.com/openevo-ccs/conceptbase)** /
  **[`competencybase`](https://github.com/openevo-ccs/competencybase)** —
  concept and competency ids referenced loosely from any future
  policy-principle or crosswalk records.
- **[`lab_manager`](../../../lab_manager/)** — the agent/skill layer, and the
  home of the cross-cutting design note this repo was founded alongside.
