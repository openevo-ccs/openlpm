# CLAUDE.md

Short, repo-level notes for any Claude session in this repo. Dustin's global `~/.claude/CLAUDE.md` (desktop only) holds the longer communication rules; this file exists so a fresh clone or a cloud session still gets the essentials.

## Shared design elements have design notes

Some parts of OpenLPM appear on many screens and have to look and behave the same everywhere: graphs, the six concept colors (`--map-1..6`), timelines. Their design notes live in the sibling `lab_manager` repo. Before changing any screen that uses one of them, read the registry and then the element's note:

- Registry: `../lab_manager/docs/design-notes/openlpm-platform-design-standards-registry.md`
- Graph standard, rollout tracker (which of the 8 graph screens are converted) and how to change the standard: `../lab_manager/docs/design-notes/openlpm-graph-visualization-standards-proposal-2026-10-25.md`

Rules:

- Build on the shared code: graphs use `src/lib/graph-standards.ts` and `src/components/graph-controls.tsx`, colors come from the `--map-N` tokens in `src/globals.css`. No one-off graph styling or private palettes.
- Decisions recorded in a note are settled. Ask Dustin before changing one.
- After editing the palette, run `node scripts/check_palette_colorblind.mjs`. It must exit 0.
- Update the note's tracker and the registry row in the same piece of work as the change.
- A screen that needs something the kit cannot do gets the kit extended, so the next screen benefits too.

## Before you open a pull request

- Run `npm ci` first, then `npm run build`. A build in a worktree that shares an older `node_modules` fails on missing packages (`papaparse`, `exceljs`, `docx`) and looks like a broken build when it is a stale install.
- Run the library tests: `npm run test:comparison`, `npm run test:review-state`, `npm run test:dashboard-views`, `npm run test:time`.
- Warning and draft text uses `--warning-text`, never `--warning`. The bright amber is 1.75 to 1 on the light page.
- A status that says "accepted" does not say a person has reviewed the item. The review state chip (`src/components/review-state-chip.tsx`, rule in `src/lib/review-state.ts`) says that, and follows the recorded reviews.
- The suggestion hit rate quoted on the Curate drawer is measured by `node scripts/eval_suggestions.mjs`. Re-run it when the corpus changes and update `drawerSuggestionsHint` in `src/pages/dashboard/comparison/strings.ts`.
- Migrations: check the live list with `supabase migration list --linked` right before choosing a number. A branch can push a migration to the live database before it merges.
