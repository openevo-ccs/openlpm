# OpenLPM ↔ OpenEvo CCS Lab: a two-way learning loop

**Status:** Design note, not yet enforced by any tooling. Describes intent and a lightweight practice, not a binding process.

## The relationship

OpenEvo's [Computational Curriculum Studies (CCS) Lab](http://openevo.eva.mpg.de) runs a mature, actively-used ecosystem of repositories (`conceptbase`, `openevo-core`, `bio-core-k12`, `interdisciplinary-k12`, `lab_manager`, and others) for developing evolution/behavior/sustainability curriculum content — with its own upper ontology, identifier scheme, cross-repo RFC process, and governance conventions refined over real use.

OpenLPM is, in effect, a generalized, freely available version of the same underlying idea: infrastructure for a research group to collaboratively build a rigorous Learning Progression Model. Where the OpenEvo CCS Lab ecosystem is deep and specific to one field, OpenLPM is meant to be shallow and general enough for *any* expert group to pick up. Both are OpenEvo projects; neither one owns the other.

That difference is exactly why a deliberate two-way learning loop is useful, rather than either project quietly drifting apart from the other's lessons.

## What flows from OpenEvo CCS Lab → OpenLPM

The CCS Lab ecosystem has already solved, under real pressure, several problems OpenLPM will eventually hit:

- **Governance that scales from one maintainer to many**, without inventing committee process before there's a committee — see `openevo-core/GOVERNANCE.md`'s seat-consolidation pattern, which `OpenLPM/GOVERNANCE.md` already borrows directly.
- **An RFC process for substantive change** (`proposals/` + PR review), reused as-is for OpenLPM.
- **Lifecycle status conventions** for evolving structured content (`proposed → accepted → stable → deprecated/retracted`) — a candidate model for how OpenLPM's own schema elements and LPM data objects should carry status once that UI is built (see `proposals/0001`, Phase 1).
- **FAIR data principles** applied rigorously to a base/graph architecture — relevant if OpenLPM ever needs to separate "core, stable schema" from "field-specific extensions" the way the CCS Lab separates Foundational Repos from Graph repos.
- **The AI ethics tiering habit itself** — OpenLPM's framework generalizes a pattern already present informally in how CCS Lab work handles AI-assisted drafting, literature synthesis, and content generation.

## What flows from OpenLPM → OpenEvo CCS Lab

The direction is easy to miss because OpenLPM is the newer, smaller project — but it matters:

- **A generality stress-test.** If a convention written for the CCS Lab's evolution-education context (a governance pattern, a schema shape, an ethics tier) can't be explained to an unrelated LPM research group without CCS-specific jargon, that's a signal the convention is more field-specific than it looks. OpenLPM's README and docs are written for exactly that outside audience — a useful check the CCS Lab's own internal docs don't get by default.
- **A second real deployment for shared patterns.** Every convention OpenLPM adopts from the CCS Lab (see above) gets used by a genuinely different group of people, in a genuinely different domain. That's a better test of whether the convention is actually reusable than any amount of internal review within the CCS Lab alone.
- **The AI Ethics Framework itself**, drafted inside OpenLPM in domain-neutral language from the start, is offered back to the CCS Lab as a candidate reference for its own AI-use practices — see `ethics/ai-ethics-framework.md`'s closing section.

## The practice (lightweight, for now)

No automation enforces this today. The practice is:

1. When OpenLPM's `GOVERNANCE.md`, `ethics/ai-ethics-framework.md`, or data model changes meaningfully, check whether the same lesson should be proposed back to the CCS Lab (via an issue or RFC in the relevant repo — most likely `lab_manager` or `openevo-core`).
2. When the CCS Lab's own governance or ontology conventions evolve (tracked in `lab_manager/docs/design-notes/`), check whether OpenLPM's simpler equivalents should be updated to match, or whether OpenLPM's constraints (single maintainer, general-purpose audience) mean it should deliberately diverge — and document why, here, if so.
3. Revisit this note itself periodically as both projects mature — see `proposals/` for how to propose a change to it.

A natural next step, not taken as part of OpenLPM's founding, would be adding a reciprocal pointer to this note from `lab_manager` itself, so the link is visible from both directions. That's a change to a different repository and needs its own review — tracked here as a known follow-up, not done automatically.
