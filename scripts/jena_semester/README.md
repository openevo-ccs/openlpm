# Jena semester: synthetic class for the sandbox space

These scripts run an AI-generated class through the sandbox space `evomentor-thuringia-sandbox` and produce the same hand-in files real students will produce. All data they create is synthetic and is tagged as such. Nothing here touches the real space `evomentor-thuringia`.

Credentials are read from the main checkout's `.supabase-secrets` and `.env.local` by `lib.mjs` and are never printed.

## Order of a run

1. `node scripts/jena_semester/reset_sandbox.mjs` clears synthetic work, timelines, stars and groups. Add `--recopy` to copy the Thuringia content over again.
2. `node scripts/jena_semester/provision_cohort.mjs add` creates the 30 accounts (plus-addresses on globalesd.org, address pre-confirmed, no email sent) and makes them sandbox members.
3. `node scripts/jena_semester/export_context.mjs` writes `cache/lernziele.jsonl` and `cache/basiskonzepte.json` for the AI students to search.
4. `node scripts/jena_semester/form_groups.mjs --apply` forms 6 groups by the rule written at the top of the file and creates them; each student joins as themselves.
5. One AI helper per group writes `cache/group_decisions/Gruppe N.json` (chat log, topic, grade-band split).
6. One AI helper per student follows `student_agent_prompt.md` and writes `cache/decisions/pNN.json`.
7. `node scripts/jena_semester/validate_decisions.mjs --fix` drops anything the page could not have offered (unknown ids, ratings outside 1-4).
8. `node scripts/jena_semester/apply_decisions.mjs` writes each student's work as that student, through the app's own row-level security.
9. `npx vite preview --port 4173` serves the build, then `node scripts/jena_semester/export_handins.mjs --base http://localhost:4173/` downloads each student's Word and JSON files through the real Abgabe tab into `cache/exports/`.
10. `python lab_manager/tools/jena-cohort-analysis/analyze.py --input cache/exports --out cache/analysis` runs the analysis kit.

`ui_check.mjs` is a browser check of the student pages (route lock, the five tabs, group page, welcome page on desktop and phone). `verify_sandbox.mjs` compares the sandbox copy with the real space row for row.

## Limits to state wherever results from this are used

- The people and their behavior are invented by an AI and have not been compared with real students.
- The AI students work from files and the task text. They never see the screen, so they say nothing reliable about layout, and the page itself is checked with the browser scripts.
- The activity timeline written by `apply_decisions.mjs` is reconstructed from each student's declared steps. Every such event carries `simulated: true`.
- No subject expert has reviewed the personas, the ratings or the analysis thresholds.
