# Four-space review: the Now items that need a person or a database write (2026-10-28)

Companion to the pull request "Now items from the four-space review". The design note is `docs/design-notes/openlpm-four-space-review-2026-10-28.md` in the lab_manager repo (branch `openlpm-four-space-review-2026-10-28`). Everything here is an AI-drafted proposal. Nothing in this file has been applied.

## 1. Migrations in this pull request (apply in order, a production database write)

| File | Item | What it changes | Read-only check on 2026-10-28 |
|---|---|---|---|
| `196_theory_provenance_for_four_spaces.sql` | N1 | Copies authorship and characterization status (and holders) from the TheoryBase mirror into the 9 theory rows of Bio-Core and Interdisciplinary, so the "third-party reconstruction" label shows | 9 rows would change |
| `197_review_view_for_four_spaces.sql` | N13 | Adds a default "Review" view for the reviewer role in each of the four spaces. Reviewers can still switch to the comparison views | 4 views would be added, no existing Review view, no existing default view |
| `198_repair_broken_characters_in_literature_rows.sql` | N8 | Copies clean titles and author lists from the literature mirror over 6 titles and 6 author lists that hold the replacement character | 0 rows left afterwards |

The live database's latest migration on 2026-10-28 was 195 (`supabase migration list --linked`). Run the list again right before applying.

## 2. Proposals that wait for Susan Hanisch (N9 and N10), not in any migration

Each line is a proposal found by a sample check and not a verified correction. Susan or a Lehrplan reader decides, and each then becomes a small migration.

| Record | Field | Now | Proposed | Why |
|---|---|---|---|---|
| `4f461a16-6fc9-4436-834d-b348b1bfb80c` (Thüringen Lehrpläne 2026) | `label` | "Over 100 new Thüringen Lehrpläne launch as Erprobungsfassungen ..." | "Over 100 new Thüringen Lehrpläne are commissioned as Erprobungsfassungen, for step-by-step introduction ..." | The source says the plans were commissioned and will be introduced step by step. The date 2026-08-01 is not on the page |
| `a138fb54-3d60-4b7a-993f-79b098605eab` (Butler Act signed) | `verificationStatus` | `primary-source-confirmed` | `secondary-source-only` | The cited page is a Wikipedia article with no date, votes or quote |
| `d5c9b6d2-f488-4f60-9153-3329dad85f55` (Butler Act 1925, statute) | `verificationStatus` | `primary-source-confirmed` (as the sample reported) | `secondary-source-only` | The source is a hobby-site copy of the text. The record's own provenance says it was cross-checked against Wikipedia |
| `841f3a3e-7d04-4458-b301-7220522ac27e` (Tennessee Teacher Protection Act) | `statementText` | "T.C.A. S49-6-1030 (Acts 2012, ch. 670, S2)" | "... ch. 670, § 1" | A code mirror says § 1. The official site refused automated access, so confirm on the Tennessee site first |
| Station `fbf317ae-a3ad-5a0e-b316-ded61c567f78` (Bio-Core 6-8, How Populations Become New Species) | `role_note` | "Students map apple maggot flies ..." | Add "These are host races: groups that can still interbreed, a possible step toward new species." | Host races are not yet species |
| `53a84431-ee70-589d-8799-99b242da6c87` (Sachsen grade 5 "Systematisation of vertebrates") | `topicTags` | `diversity_systematics, selection_adaptation, evolution` | Remove `evolution` (and likely `selection_adaptation`) | The Lehrplan calls the unit a lead-in to the idea of development. The School years page reads this tag and shows grade 5 as the first year of evolution |
| `549ec3fc-b49f-5e65-b079-ae87dd7b30c5` (Sachsen grade 5 "Reptiles of past ages", optional) | `topicTags` | `evolution, diversity_systematics` | Decide whether `evolution` stays | Same effect on the School years page |
| Bayern Biologie grade 12 units (three same-title pairs: Genetics 51 and 86 hours, Evolution 18 and 30, Behavioural ecology 15 and 24) | hours, and a missing "course track" field | Summed to 224 hours | Find out whether each pair is a basic and an advanced course. If so, store the track and show one track at a time | The School years page adds the pairs together |

## 3. Refreshing the out-of-date copies of the shared libraries (N11, a production database write)

The snapshots must be read from a checkout of each repository's `main`. The sibling checkouts of TheoryBase and CompetencyBase sit on feature branches, so I exported `origin/main` into temporary folders:

- `D:\tmp\theorybase-main-review-2026-10-28`
- `D:\tmp\competencybase-main-review-2026-10-28`

Both scripts print a dry run first and write only with `--yes`. A session of mine was blocked from running even the dry run (the harness treats the script as a shared-resource write), so these are for a terminal of yours:

```
cd D:\dev\openevo-ccs-lab\openlpm-wt-review-now-items-2026-10-28
node scripts/sync_theorybase_snapshot.mjs --theorybase-path D:\tmp\theorybase-main-review-2026-10-28
node scripts/link_base_repo_content.mjs --repo competencybase --path D:\tmp\competencybase-main-review-2026-10-28
```

Read the two dry-run summaries, then add `--yes` to each command. The review found 34 TheoryBase records and 32 CompetencyBase records missing from the snapshots.

## 4. After applying, check

- Bio-Core Theories page: DCR shows the "third-party reconstruction" label. A reviewer account opens on the Review view and the "Viewing" dropdown still lists the comparison views.
- `literature_references` has no title or author containing the character U+FFFD in the four spaces.
- Social-Core and Computational-Core are still private.
