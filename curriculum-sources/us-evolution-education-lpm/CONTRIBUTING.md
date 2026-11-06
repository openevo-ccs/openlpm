# Contributing to us-evolution-education-lpm

**Status:** Informative. For the authoritative rules, see
[`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

This repo has no `state/` folder -- everything lives in
`national_ccs_policy/`, since its whole purpose is content that binds every
state at once or synthesizes across several. If what you're adding is
specific to one state, it almost certainly belongs in that state's own repo
(`florida-lpm`/`pennsylvania-lpm`/`tennessee-lpm`) instead.

## Proposing a change

1. Open a pull request against `main`.
2. Run `python scripts/validate_records.py` before committing.
3. Every record must carry a `verificationStatus`, starting at
   `unverified-secondary-source` unless independently checked.

## The one rule specific to this repo: don't duplicate, cross-reference

Before adding a new `institutional-actor-record` or `policy-controversy-record`
here, check whether the same real-world organization or controversy already
has a record in `florida-lpm`/`pennsylvania-lpm`/`tennessee-lpm`. If it does,
this repo's own record should `crossRepoRefs` to theirs (and ask whether
they should add a `crossRepoRefs` back, same two-way discipline used
2026-10-20). This repo exists to be the connecting layer. Content that
already lives somewhere self-contained should stay there, cross-referenced
rather than copied.

## Adding a fourth state

When a fourth state repo is founded, check this repo's own
`national_ccs_policy/records/controversies.yaml` for whether the new
state's own central controversy belongs in
`USLP-CONTROVERSY-american-evolution-education-culture-war`'s
`crossRepoRefs` list (and vice versa, from the new state repo's own record
back to this one) -- and check whether the new state's own story involves
either of this repo's two Supreme Court mandates directly (most should, to
some degree) worth a new `institutional-mandate-record` test or
`relatedMandateIds` link in that state's own `coherence-finding-record`s.

## Rendered deliverables

Any brief, roadmap, or comparison document meant to leave this repo is a
real committed file, never a Claude Artifact.

## Questions

This is a private single-maintainer repo for now — no issue-based workflow
yet.
