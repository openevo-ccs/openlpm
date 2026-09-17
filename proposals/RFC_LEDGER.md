# RFC Number Ledger

Append-only. Claiming a number is: (1) `git pull --ff-only` on `main`, (2) append a line below with
the next free number, (3) commit, (4) **push immediately** — before writing a single word of the
actual RFC. A rejected push means someone else claimed the same number in the same window; pull
and retry with the next number instead of resolving it by hand.

This exists because the old convention (grep the highest number in `proposals/`, add one) raced in
practice — `conceptbase` found three numbers independently double-claimed this way (0013, 0017,
0018), discovered only by scanning every local and remote branch, not just `main`, and a fourth
(0023) recurred there 2026-09-15 even after this ledger existed, because a claim was committed on a
branch and never pushed here. Seeded here 2026-09-17 (backfilled from every number found across
every local and remote branch as of that date, including the several `worktree-agent-*` and
`eva-lpm-*` branches — none collided) so `openlpm` gets the same protection before its own first
real collision, not after. See `lab_manager/scripts/reserve_proposal_number.py`, which reads/writes
this file.

**Claiming a number here does not reserve an ID block** — that is still a separate step in the RFC
itself (see `GOVERNANCE.md`'s own Identifier Block Allocation / RFC process, if any).

| Number | Claimed | Topic | Branch/location | Claimed by | Notes |
|---|---|---|---|---|---|
| 0001 | 2026 (pre-ledger) | founding-and-migration-plan | main | — | |
| 0002 | 2026 (pre-ledger) | projects-branches-portfolios-and-base-linking | main | — | |
| 0003 | 2026 (pre-ledger) | frameworks-and-versioned-standards | main | — | |
| 0004 | 2026 (pre-ledger) | portfolio-discovery-collaboration-and-commons | main | — | |
| 0005 | 2026 (pre-ledger) | multi-language-content | main | — | |
| 0006 | 2026 (pre-ledger) | commons-spaces | main | — | |
