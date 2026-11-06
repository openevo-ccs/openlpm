# RFC 0007 — Data Rights & Licensing Framework

**Status:** Proposed — the three real design forks below were decided with Dustin Eirdosh on 2026-10-23 (via `AskUserQuestion`, in the session that authored this RFC); the RFC text itself still awaits his sign-off before merging, per `GOVERNANCE.md`'s own process for a licensing change.
**Date:** 2026-10-23
**Supersedes:** Nothing directly. Resolves an open question `lab_manager/docs/design-notes/2026-10-01-openlpm-github-publication-strategy.md` §5.1 left hanging (whether CC BY-NC-SA 4.0 is right for content published under someone else's personal GitHub account). Supplies the missing licensing/provenance policy that `lab_manager/docs/design-notes/german-didactics-orientation-and-project-data-export-requirements-2026-10-11.md`'s "Requirement B" (full project export with licensing and provenance) assumes exists.
**Full design reasoning:** `lab_manager/docs/design-notes/2026-10-23-openlpm-data-rights-licensing-and-legal-ethics-framework.md` (this RFC is that document's §4, promoted).

## Motivation

OpenLPM has never had a real, written answer to: what can someone do with content stored here, how should they credit it, who's protected if a stored curriculum excerpt turns out to be wrong or outdated, and what happens to a project's own license when its content is shared with another project? The two-license split (content CC BY-NC-SA / code MIT) already exists and isn't changing. Everything else — a real citation, a per-project license choice, a liability disclaimer, a sign-up agreement, and a stated policy for government/institutional source material — does not exist today and this RFC proposes all of it together as one framework, at Dustin's request, rather than as separate piecemeal changes.

One piece of this was already solved at the mechanism level before this RFC: per-record rights tracking for third-party source documents (`access_tier` + `license_or_rights_note`, migrations 019/`066_curriculum_repository.sql`) already exists, is already enforced in the live UI, and already defaults safely to `citation-only`. This RFC turns that existing mechanism into a stated policy (§6 of the attached framework) rather than rebuilding it.

## What this RFC adds

The full policy document: [`ethics/data-rights-and-licensing-framework.md`](../ethics/data-rights-and-licensing-framework.md), added by this PR, sibling to the AI Ethics Framework. It covers:

1. Citing OpenLPM — a real citation string, baked into exports/published repos rather than left on a page.
2. A `content_license` field for a project's own original work, distinct from third-party source material's own rights.
3. A liability disclaimer — OpenLPM is not a certified or legally authoritative source.
4. The government/institutional source-material policy, with the KMK Biologie Bildungsstandards (RFC-0025) as a real worked example of the reasoning actually applied.
5. What federation does and doesn't change about a license.
6. An explicit statement that this is a strong starting draft. A lawyer hasn't reviewed it yet, and should before it's relied on once schools, districts, or funders are involved.

## Decisions, 2026-10-23 (Dustin, via `AskUserQuestion`)

Three real forks, put to Dustin directly rather than guessed at:

1. **Liability disclaimer stays lightweight.** The existing per-record rights label (chip + tooltip) plus one policy page is enough. No separate prominent banner on every government-sourced record.
2. **Citation gets built into every export automatically**, on top of living on an About/citation page — not left as something someone has to remember to copy.
3. **A new project inherits the default content license silently.** `content_license` starts `NULL` ("inherits CC BY-NC-SA 4.0") for every new project, the same safe-default shape as `is_private`. No extra step during project creation; the choice lives in Settings whenever an owner wants it.

## Not resolved by this RFC

This PR adds the policy document only. It does not yet:

- Add the `content_license` column/migration, the Settings UI, or the citation/About page (decision 2 and 3's actual implementation).
- Build the sign-up Terms of Use page (framework §4's disclaimer needs a real surface to live on beyond the policy doc itself).
- Resolve cross-instance federation's legal questions — explicitly out of scope, same as `lab_manager/docs/design-notes/openlpm-project-federation-2026-10-02.md` already left it.
- Get an actual lawyer's review (framework §8) — flagged honestly as still needed before this is relied on as real protection.

## Test plan

- [x] `data-rights-and-licensing-framework` confirmed absent from `openlpm/ethics/` and `openlpm/proposals/` before authoring (no filename collision).
- [x] RFC number `0007` claimed via `lab_manager/scripts/reserve_proposal_number.py` — a race-free ledger claim rather than a hand-picked number.
- [ ] Dustin's sign-off on the policy text itself, and his call on when to merge.
