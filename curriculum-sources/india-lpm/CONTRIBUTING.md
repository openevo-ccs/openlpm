# Contributing to india_lp

**Status:** Informative. For the authoritative rules, see
[`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

Read [`README.md`](README.md) for what belongs where, and
[`docs/strategy/2026-09-30-india-legal-review-scope.md`](docs/strategy/2026-09-30-india-legal-review-scope.md)
before adding or raising the `accessTier` on any record that quotes actual
government curriculum-policy text — this repo's founding-session default is
`citation-only` for a real, documented legal reason, not an arbitrary
caution.

## Proposing a change

1. This repo is private with a single maintainer today — open a pull
   request against `main` (no `submissions` branch).
2. Run `python scripts/validate_records.py` before committing new/changed
   records.
3. Every `local_policy`/`national_ccs_policy` record must carry a
   `verificationStatus` (see `GOVERNANCE.md`). New content sourced from a
   search-engine snippet or other secondary source starts at
   `unverified-secondary-source` — never default it to something stronger.
   New content from a directly-read primary source (an actual PDF or page
   fetched and read in full, not just summarized by search) may start at
   `primary-source-confirmed`.

## Quoting a source — the accessTier discipline

Before adding any `excerptText`/`statementText`/quoted `description` from an
actual Indian government curriculum or licensing document:

1. Set `accessTier` explicitly on that object. Default to `citation-only`
   unless one of the two exceptions below applies.
2. The two current exceptions, both already reflected in this repo's
   founding records: (a) a body's own *licensing policy document itself*
   (not curriculum content) may be quoted briefly under ordinary fair-dealing
   practice for identification/commentary purposes — the way this repo
   quotes a short phrase from NCERT's own license agreement to describe its
   terms, not to redistribute the underlying curriculum; (b) a jurisdiction
   with a confirmed, checkable open license (Karnataka's KOER, CC BY-SA 4.0)
   may be quoted more freely, citing that license directly in
   `licenseOrRightsNote`.
3. If in doubt, use `citation-only` and record the URL. A citation is never
   wrong; an over-eager excerpt might be.

## Adding a new state

1. Create `state/<state>/local_policy/records/`.
2. Check this repo's existing source-notes doc first
   (`docs/source-notes/2026-09-30-india-curriculum-licensing-landscape-research.md`)
   for whether that state's licensing posture is already documented —
   Maharashtra and Karnataka are, as concrete opposite-end examples; most
   states are not yet researched at all.
3. A new state's institutional-actor records (education board, textbook
   board) are safe non-text groundwork and don't need to wait on any legal
   review — only quoting that state's actual curriculum/document *text*
   does.

## Cross-linking to other repos

References to ConceptBase concepts, `openevo-graph` nodes, or LPM strand ids
are informal (plain string ids/paths) for now, not schema-validated
resolvable links, same convention as `deutsche_lp`/`nys_lp`.

## Questions

This is a private single-maintainer repo for now — no issue-based workflow
yet.
