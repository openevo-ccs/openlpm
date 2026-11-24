# Theories of Schooling spaces

Written 24 November 2026. Status: built on a branch. No database has the migration, and nothing is deployed.

## What it is

A theory of schooling is a set of statements about what schools are for, how they work and how they could be better. A person, a community, a group, a book or a research tradition can hold one. The lab writes such a theory down as a **profile**, a JSON file with a fixed layout (the format of the Theory of Schooling Atlas on openevo.net, described in that repository in `docs/schooling-atlas-data-format.md`).

A **Theories of Schooling space** is a new kind of project space. It is a place where a person, a community or a group keeps their own theory of schooling and compares it with others. The people in the space can see the theory drawn as a diagram, read and download the profiles, and build a plain-language text about the theory to paste into a chat with an AI assistant.

In the database the kind is `projects.project_kind = 'theory-of-schooling'`, a fourth value next to `standard`, `curriculum-repository` and `curriculum-repository-custom-view`.

## What a person sees

- **Project switcher.** A third frame, "Theories of Schooling", with its own checkbox. The checkbox appears only when the person belongs to such a space, so the page stays as it was for everyone else. These spaces never appear in the human-curated or synthetic-theoretical frames. The admin list has a matching card.
- **Sidebar.** Atlas, Profiles, Prompt context, Settings. Settings holds the member list and invitations, as in every space. The space's address opens on the Atlas.
- **Atlas.** The Theory of Schooling Atlas viewer, fed with every profile of the space. A copy of the viewer lives in `public/vendor/openevo-atlas/` (the README there names the source commit).
- **Profiles.** The profiles saved in the space, with download for everyone and delete for editors. Editors can paste or upload a profile. It is checked first (right format, known domains, no repeated ids, wording not too long, reasons that point at statements that exist), and nothing is saved until they press the save button. A profile with a code that the space already holds replaces the old version. There is also a search over the statements.
- **Prompt context.** The person picks theories, domains and statements, says whether the answer will be read inside or outside the lab, and copies the text. The rules for the text come from the lab's reference code (`lab_manager`, `tools/literature-engine/tos_context.py`): domains in everyday words, record codes only in square brackets, the review state of every theory always stated, and a statement kept inside the lab shown only by its short name when the readers are outside the lab. The page builds text and sends nothing.

## Tables (migration 256)

| Table | What it holds |
|---|---|
| `tos_profiles` | One row per profile in a space: the whole profile in `data`, plus copies of the fields people filter by (`profile_id`, `title`, `holder_kind`, `visibility`, `theory_ref`, `version`, `license`, `review_status`). Unique per space and profile code. |
| `tos_elements` | One row per statement, written by the app from `data`: `element_id`, `type`, `label`, `statement`, `supers`, `subs`, `ref`, `visibility`. Can be rebuilt from `data` at any time. Tied to its profile and space together, so a statement cannot sit in another space than its profile. |

## Who can see and do what

- Members of the space (and admins) read every profile and statement of the space.
- Owners, maintainers, editors and contributors add, change and delete profiles and statements (`is_project_editor`). Viewers and reviewers read only.
- Nobody outside the space can read a row. The word "public" inside a profile says where that profile may be published. It does not open the row to anyone.
- A profile cannot be moved to another space or handed to another account after it is saved.

## AI opt-out

The profiles hold text that people wrote about their own schooling, so the rule in `CLAUDE.md` applies. A person who opted out of AI processing has their profiles left out of every text that goes to an assistant.

- The Prompt context page asks the database function `tos_profile_ids_open_to_ai(project)` which profiles may be used. The function answers with profile ids only. If the page cannot get an answer it offers nothing.
- A script that reads `tos_profiles` or `tos_elements` and shows text to an AI assistant must use `loadOptedOutUserIds` (`scripts/lib/ai-opt-out.mjs`) and leave out rows whose `created_by` is on the list. `CLAUDE.md` names the two tables.
- `created_by` points to the account that saved the profile. If that account is deleted, its profiles are deleted with it, as for other personal text. A community that wants a profile to outlast one person should have it saved by an account that stays.

## How profiles get in, and how a space gets made

- Profiles come in through the Profiles page (paste or file) or through `scripts/import_tos_profile.mjs <profile.json> <space slug> --as <e-mail> --yes`. Without `--yes` the script only checks the file and touches nothing.
- There is no button to create a space of this kind yet. An admin makes one with a single SQL statement, shown in the header of the migration. A space that already holds learning goals should not be changed to this kind, because its sidebar changes.

## Not built yet

- Comparison across spaces (two communities, or a community and a research tradition). The Atlas already compares the profiles inside one space.
- A review workflow. The review state of a profile is whatever the file says (`provenance.reviewStatus`). Nobody can change it from the page, and it does not follow the review assignments of the other parts of OpenLPM.
- Sync from the lab's base repositories (a profile that follows its TheoryBase record) and the reverse, promoting a reviewed statement to a record.
- The schooling layer for Me-Mo. The Prompt context page makes the text by hand. Me-Mo does not read these spaces.
- A page to edit a statement inside OpenLPM. Profiles are replaced as a whole.
- Public pages. Nothing in a space is published from here.

## Known limits

- The migration was checked against a small stand-in for the live schema in an in-memory PostgreSQL (permissions, constraints, the opt-out function). It has not run against the live schema or the hosted database.
- The pages have not been opened against a database. The Atlas integration was checked in a browser against the built site with a stand-in page that loads the viewer the same way, using two example profiles.
- The viewer words a lab-only or local profile as "opened from a file on your own computer". That sentence belongs to the viewer. The Atlas page adds a notice when such a profile is present.
- The viewer's `?theory=<address>` option still works if someone sends a link that carries it. It loads a file into the reader's own browser and sends nothing out.
