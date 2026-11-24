# Theory of Schooling Atlas (copy of the widget)

This folder holds a copy of the Theory of Schooling Atlas, an interactive viewer for a theory of schooling. OpenLPM loads it on the Atlas page of a Theories of Schooling space and hands it every profile of that space.

Do not edit the files here. Change the widget in its own repository and copy it over again.

## Where it comes from

- Repository: `openevo-ccs/openevo.net`, branch `tos-stories-2026-11-24` (the Domain stories pull request; the first version was pull request 15)
- Commit: `6a3819e` (24 November 2026, "Atlas: flow can count reasons instead of statements"). The earlier copy was commit `7a74bd322a2721171cdb205e1d4caf3a916204ae`.
- Data format note in that repository: `docs/schooling-atlas-data-format.md`

## What was copied

| Here | In the source repository | Changed? |
|---|---|---|
| `core/oew.js`, `core/oew.css` | `app/widgets/core/` | no, byte for byte |
| `atlas/atlas.js`, `atlas/atlas.css` | `app/widgets/atlas/` | no, byte for byte |
| `atlas/model-schooling-domains-v1.json` | `app/widgets/atlas/` | no, byte for byte |
| `atlas/schooling-theory-profile-v1.schema.json` | `app/widgets/atlas/` | no, byte for byte |
| `atlas/base-links.json` | `app/widgets/atlas/` | yes, see below |

The folder layout is the one the widget expects: the script finds its styles and its data files next to itself.

## One change: lab-only entries are left out of base-links.json

Every file in this folder is served to anyone who asks the website for it, with or without an account. `base-links.json` lists related entries for each domain, and 25 of its 93 entries are marked `lab_only` (the titles of records in private repositories). Those 25 were removed, so 68 entries remain. All other fields are unchanged. To refresh the copy, redo the same filter (keep entries where `lab_only` is not true).

Links inside a profile are not affected. A profile is stored in the database and is shown only to the members of its space.

## How OpenLPM uses it

- The page `src/pages/dashboard/tos-atlas-page.tsx` loads `core/oew.js` and `atlas/atlas.js` when it opens, and mounts `<div data-openevo-atlas data-theories="" data-private-links="show">`. An empty `data-theories` means no profile is loaded from the widget's own folder.
- For each profile of the space it sends `host.dispatchEvent(new CustomEvent('atlas:add-theory', { detail: profile }))`. The widget announces itself with `atlas:ready`.
- The widget's "Embed" button gives addresses on the widget's home site and does not apply to this copy, so the page hides it.
- The widget reads a `?theory=<https address>` option from the page address and loads that file as one more theory. OpenLPM does not use this. Someone could still send a link that carries it, which would show a stranger's file in the reader's own browser only.

## Updating

1. Copy the files again from a newer commit of the source repository.
2. Apply the base-links filter above.
3. Change the commit named in this file.
4. Open the Atlas page of a Theories of Schooling space and check that the four views still draw.
