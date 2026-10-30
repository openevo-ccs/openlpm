# Lernziele: order, grade label and spelled-out preparations (migration 210)

Date: 2026-10-30. Projects: EvoMentor Thüringen and its sandbox copy. Both get the same change.

This note says what migration 210 does, what was checked, and what could not be checked. Susan Hanisch's five feedback rows of 2026-10-30 are the reason for it.

| Feedback row | What Susan said | What fixes it |
|---|---|---|
| 21d355f9 | wrong order of learning goals in this subtopic | The saved page text shows it was Kl. 9, subtopic "Pilze". The Lehrplan starts with the Pilzformen, then the Pilzzellen. Part D swaps them. The standard view now follows the curriculum order. |
| 5488cd15 | "Hormonsystem als Informationssystem" is the first goal of the topic in grade 7/8 | Part B. The Lehrplan agrees. |
| 69fd982f | wrong order for "Biologie des Menschen"; grades 7 and 8 should say 7/8 | Part B, order and label. |
| bf1cc2c6 | grade 5/6 must be in exactly the order of her CSV | Part A. |
| d0dcda68 | write out Dauerpräparat and Frischpräparat | Part C. |

Nothing is applied yet. The migration is a file in a pull request. No curriculum expert has checked the new order for Kl. 7 to 10 yet. A program matched the goals to the PDF and I read the result through. The grade 5/6 order is Susan's own CSV order.

## What the migration changes

| Part | Rows per project | Change |
|---|---|---|
| A | 174 (all accepted grade 5/6 goals) | `curriculum_sequence` = row number in Susan's CSV, 0 to 173 |
| B | 90 (all accepted Kl. 7 and Kl. 8 goals) | `grade_band` becomes `7/8`, `curriculum_sequence` = place in the Lehrplan, 0 to 89 |
| D | 5 (Kl. 9 and Kl. 10) | two goals in "Pilze" swap numbers, three in "Belege für die Evolution" move |
| C | 4 (Kl. 9 and Kl. 10) | DP and FP written out in title, description, original text and short name |

That is 273 different rows per project, 546 in all. No row is deleted and no status changes. Each UPDATE names the row id and the project, as migration 203 did.

The migration ends with a self-check. If a count is off (a grade 5/6 number missing, a goal still labelled 7 or 8, an abbreviation left), the whole migration is rolled back and nothing changes. On a database without these goals the check is skipped.

## Proof results

The generator (`scripts/generate_lernziele_order_migration.py`) parses the SQL with the PostgreSQL parser (pglast), replays every UPDATE on the live and sandbox dumps taken on 2026-10-30, and checks the result. It stops with an error when a check fails. I also damaged the SQL on purpose in three ways (two numbers swapped, a label left at 8, one text update dropped) and each time the checks failed as they should.

For both projects:

- **A.** Sorting the 174 accepted grade 5/6 goals by `curriculum_sequence` reproduces the CSV order exactly. No ties, no gaps (0 to 173). Before the change, 107 of the 174 had no number and the other 67 carried numbers from the old file.
- **B.** The 90 goals are labelled 7/8, none is left at 7 or 8, and sorting by `curriculum_sequence` gives the Lehrplan order (0 to 89, no ties, no gaps).
- **D.** Kl. 9 and Kl. 10 sorted by `curriculum_sequence` follow the Lehrplan order. No ties.
- **C.** No accepted goal outside grade 5/6 has DP, FP, Dauerpräp. or Frischpräp. left in the four text fields.
- Row count, status, type, project and branch are unchanged. Grade 5/6 texts are untouched. Only the columns named above change.

The CSV has two goal texts that appear more than once: "Experimentieren/Anwenden der experimentellen Methode" (rows 5 and 15) and "das biologische Vorbild und die technische Umsetzung vergleichen" (rows 155, 161, 166 and 171, one in each Bionik subtopic). The subtopic tells them apart.

Dry run with `supabase db push --linked --dry-run`: 210 is the only pending migration. The remote database has 001 to 206.

## Part B: the order in the Lehrplan

Source: `LP Thüringen Bio Gym 2026 Erprobungsfassung.pdf`, pages 19 to 24 (PDF pages 24 to 29). I extracted the text, matched every accepted Kl. 7 and Kl. 8 row to the goal the PDF prints, and checked the position of every subtopic heading on the page. I also looked at page 24 as an image.

### What the PDF says about 7 and 8

The PDF has one chapter "Klassenstufen 7/8". Each of its three Lernbereiche carries the line "Klassenstufe 8" and the chapter says the competences are to be developed "bis zum Abschluss der Klassenstufe 8". It never assigns a goal to Klassenstufe 7 or to Klassenstufe 8 alone. The split into 7 and 8 in our data was our own suggestion (kept in `content.empfohlene_klassenstufe`). Page 4 of the Lehrplan adds that the teacher decides the order of teaching inside a Doppelklassenstufe, so the order below is the order in which the document prints the goals.

### Order of the blocks

Topics in the PDF: Wirbellose in ihren Lebensräumen (18 goals in our data), Zellen als Lebensbausteine (14), Biologie des Menschen (58). Same order as in our data.

"Biologie des Menschen" in the PDF, with the goals per subtopic: Fortpflanzung, Entwicklung und Sexualität (7), Nervensystem (12), Verdauungssystem (8), Atmungssystem (7), Ausscheidungssystem (3), Blut und Herz-Kreislauf-System (6), Zusammenwirken der Systeme (3), Abwehrsystem (7), Fachpraktische Arbeiten (5).

"Hormonsystem als Informationssystem" is the first goal of "Biologie des Menschen". Susan is right.

### First ten goals of "Biologie des Menschen"

Before (the list sorted "Reihenfolge im Lehrplan" shows all Kl. 7 goals first):

1. Nahrungszusammensetzung erläutern
2. Enzymatische Verdauung erläutern
3. Resorption beschreiben
4. Blutzuckerregelung erläutern
5. Gesunde Ernährung: bedarfsangepasst
6. Gesunde Ernährung: Ballaststoffe
7. Essstörungen: Prävention
8. Lebensmittelkennzeichnung bewerten
9. Atmungsorgane: Bestandteile beschreiben
10. Atembewegungen beschreiben

After (order of the Lehrplan):

1. Hormonsystem als Informationssystem
2. Pubertät charakterisieren
3. Menstruationszyklus beschreiben
4. Vorgeburtliche Entwicklung beschreiben
5. Sexualität und Geschlechtsidentität erläutern
6. Schwangerschaftsverhütung beurteilen
7. STI-Prävention begründen
8. Sinneszellen adäquate Reize zuordnen
9. Sinnesorgan Bau und Funktion
10. Reiz-Reaktions-Kette: Sinneszellen

### Where the PDF differs from today's order

1. The page sorted by grade first. Because of the 7/8 split, "Biologie des Menschen" was cut in two: the Kl. 7 subtopics (Verdauung, Atmung, Ausscheidung, Blut, Fachpraktische Arbeiten) came before the Kl. 8 subtopics (Fortpflanzung, Nervensystem, Abwehr, Zusammenwirken). With one band and one order this disappears.
2. Inside the stored order there is one swap. The PDF prints "Zusammenwirken der Systeme" before "Abwehrsystem". Our file had them the other way round. This is the only place where the old numbers disagree with the PDF inside the band.
3. Wirbellose and Zellen: no difference.

### Rows I cannot place with certainty

| Row | Where I put it | Why it is uncertain |
|---|---|---|
| GY-78-ZEL-PTZ-7 "Einzeller zu Vielzeller: Grünalgen" | end of "Pflanzliche und tierische Zellen" (where the data had it) | The Lernbereich in the PDF does not list this goal. It appears only in a table on page 15 ("Evolution von Einzellern und Vielzellern (am Beispiel der Grünalgen)", Klassenstufen 7/8). The ministry change list calls it new in 2026. |
| GY-78-HUM-BHK-6 "Gesunderhaltung: Ernährung" | right after BHK-5 | The 2026 text has one bullet: "Maßnahmen zur Gesunderhaltung begründen (z. B. regelmäßige sportliche Betätigung)". The 2024 text also named "ausgewogene Ernährung". The row has no goal of its own in the 2026 PDF. |

Three rows are pieces of a larger bullet and sit at their bullet: GY-78-WIR-WTG-5 (second half of the bullet about Weichtiere, Ringelwürmer, Gliederfüßer, placed after the three), and, for Kl. 9 and 10, GY-910-GEN-WGE-7 and GY-910-OKO-OSY-1 (the opening line of a bullet, placed before its sub-bullets). The place of these three is fixed by the bullet.

One PDF goal has no row in our data: "die Bedeutung von medizinischen Vorsorgeuntersuchungen begründen (DB)" (page 22, between "Vorgeburtliche Entwicklung" and "Sexualität"). I did not add a row. The order leaves room for it.

Rows with a shortened or merged wording matched by hand and checked: GY-78-HUM-FES-5 (shortened), GY-910-GEN-HUM-1 and HUM-2 (each joins the bullet "Ursachen, Symptome ... nennen" with one sub-bullet), GY-910-OKO-FPA-2 (holds both Exkursion goals).

The order of all 90 goals, with the PDF page and the matched PDF wording, is in `scripts/data/lernziele-lehrplan-order-2026-10-30.json`.

## The 7/8 label: stored value or display only

I changed the stored value to `7/8`, the same way `5/6` is stored. It is the smaller change: the pages already handle a stored band (migrations 104 and 131 settled this for 5/6, and the Lernziele, Basiskonzepte and researcher pages already group and filter a stored `5/6`), so every screen, export and hand-in shows `7/8` without further work. A display-only mapping would have needed a new label rule in about ten places and would still have shown `7` and `8` in the researcher page, the search bar, the exports and the hand-in file.

Code changes that the stored value needs (all small):

- `deriveKlassenstufe` (prompt generator) turned `7/8` into nothing, because `Number("7/8")` is NaN. A band now counts as both grades it spans and reads "7–8", as 7 and 8 did before. This also fixes it for `5/6`.
- `coherence.ts` sorted grades with `Number(a) - Number(b)` and its `sortPair` gave different answers depending on argument order for a band value. Both now rank by the first number.
- `listTopics` (`curriculum.ts`) now sorts by grade band, then by `curriculum_sequence`. The query has no ORDER BY, so the "Standard" view showed the goals in whatever order the database returned them. This is why Susan saw a wrong order in the standard view. The "Reihenfolge im Lehrplan" sort uses the same comparison.

The two EvoMentor Thüringen projects are the only ones with goals labelled 7 or 8 that this change touches. EvoMentor Bayern has three goals labelled 8 and keeps them, since Bayern uses single grades. No coherence review mentions grade 7 or 8, so no saved review is cut off from its grade. The comparison profile of the two projects counts distinct grade labels, so it will read 4 (5/6, 7/8, 9, 10) where it read 5. Undo: set `grade_band` back from `content.empfohlene_klassenstufe`.

## Grade 9 and 10: left as two grades

Nothing in the Lehrplan PDF treats 9/10 as one band for goals. Chapter 2.2 is "Klassenstufe 9" (Stoff- und Energiewechselprozesse, Ökologie) and chapter 2.3 is "Klassenstufe 10" (Genetik, Evolution), each with its own "bis zum Abschluss der Klassenstufe 9 / 10". The general text speaks of "Klassenstufen 7/8 und 9/10" only when it describes the Basiskonzepte, and its tables there have three columns: 7/8, 9, 10. The ministry change list says the split into 9 and 10 is new in 2026. So `9` and `10` are the right labels, and I left them. Dustin decides if he wants a combined 9/10 anyway.

## Part D: order in Kl. 9 and Kl. 10

Feedback 21d355f9 turned out to be about Kl. 9, so I ran the same PDF check on Kl. 9 and Kl. 10 (92 goals). Two differences:

- Kl. 9, "Pilze": the PDF lists "Pilze in Hutpilze, Schimmelpilze und Hefepilze einteilen" before "den Bau von Pilz-Zellen ... vergleichen". Our data had them the other way round (2024 order). The two rows swap numbers.
- Kl. 10, "Belege für die Evolution": the PDF lists Fossilien, Mosaikformen, Analyse von DNA fossiler Organismen, then anatomisch-morphologische Homologien. Our data had the Homologien second. Three rows change numbers.

Only the rows that move change their number; the set of numbers stays the same. Two Kl. 9 and 10 rows have no goal of their own in the 2026 PDF and stay where they were: GY-910-PGP-ZA-7 (the carbon dioxide example under "verlustarme Lagerung", which the 2026 text dropped) and GY-910-OKO-OSY-6 ("Ökosysteme nach ausgewählten Kriterien einteilen", which the ministry change list names as new but the PDF Lernbereich does not print).

## Part C: DP and FP

I searched title, description and every string inside `content` of all rows (accepted and archived) in both projects. The only hits in goal text are these four goals in Kl. 9 and Kl. 10, identical in both projects, each in title, description, `originaltext` and `kurzbezeichnung`:

| Source id | Kl. | Text before | Text after |
|---|---|---|---|
| GY-910-PGP-FPA-1 | 9 | mikroskopieren: Laubblattquerschnitt (DP) | mikroskopieren: Laubblattquerschnitt (Dauerpräparat) |
| GY-910-OKO-FPA-1 | 9 | mikroskopieren: Laubblattquerschnitte von Lichtblatt und Schattenblatt (DP) | ... (Dauerpräparat) |
| GY-910-GEN-FPA-1 | 10 | mikroskopieren: Riesenchromosomen (DP) | mikroskopieren: Riesenchromosomen (Dauerpräparat) |
| GY-910-GEN-FPA-2 | 10 | mikroskopieren: Mitosestadien (DP oder FP) | mikroskopieren: Mitosestadien (Dauerpräparat oder Frischpräparat) |

The title and short name of each row read the same way ("Mikroskopie: Riesenchromosomen (Dauerpräparat)"). The new wording is the Lehrplan's own. The Kl. 10 goals are the two Susan named; the two Kl. 9 goals are the "other goals" she asked for.

Grade 5/6: no hit in any text field of either project, and none in Susan's CSV. The only "FP" strings in grade 5/6 rows sit inside internal ids such as `MNT56-CSV26-2.2.10-LEI-FP`. They are identifiers and stay. Kl. 7 and 8 already spell the words out. The replacement only touches DP and FP as standalone words and "Dauerpräp." and "Frischpräp." with the dot.

## What I could not verify

- I did not run the migration on a PostgreSQL server. The SQL parses with the PostgreSQL parser (pglast), the PL/pgSQL self-check parses, the replay passes and the dry run lists it as the only pending migration. A first run on the live database will show whether the self-check accepts the live data.
- I did not click through the changed screens in a browser. The build passes (`npm run build`), the six library tests pass, and I tested the changed comparison and the Klassenstufe line in isolation.
- Whether "the order in the curriculum" means the printed order of the PDF is my reading of Susan's words. The Lehrplan lets teachers choose the order of teaching.
- Whether the four goals with no counterpart in the 2026 PDF (PTZ-7, BHK-6, ZA-7, OSY-6) should stay is a curriculum question for Susan. The ministry change list names two of them as new in 2026, yet the PDF I read does not print them. The change list may come from a later version of the document.
- The missing goal about Vorsorgeuntersuchungen is not added.
- No expert has reviewed the order. The matching of 182 goals to the PDF was done by a program and read through by me. It has not been checked by a person who knows the Lehrplan.
- The screenshots of the feedback rows were not looked at. I used the page text saved with each row.

## How to rebuild

```
node scripts/dump_lernziele_with_sequence.mjs --project evomentor-thuringia > live.json
node scripts/dump_lernziele_with_sequence.mjs --project evomentor-thuringia-sandbox > sandbox.json
python scripts/read_lehrplan_order.py --pdf "<Lehrplan PDF>" --live live.json --out scripts/data/lernziele-lehrplan-order-2026-10-30.json
python scripts/generate_lernziele_order_migration.py --csv scripts/data/LP_Thueringen_Gym_5_6_MNT_susan_2026_10_30.csv \
  --order scripts/data/lernziele-lehrplan-order-2026-10-30.json --live live.json --sandbox sandbox.json \
  --out supabase/migrations/210_lernziele_order_grade_band_and_preparations.sql
```

The two dump commands need `OPENLPM_URL` and `OPENLPM_SERVICE_ROLE_KEY` and only read. The PDF is not in this repository. The order file it produces is, so the second step is only needed to re-check the order against the PDF.

After the migration is applied, these checks should show the numbers in the file:

```
SELECT p.slug, o.grade_band, count(*), min(o.curriculum_sequence), max(o.curriculum_sequence)
FROM lpm_data_objects o JOIN projects p ON p.id = o.project_id
WHERE p.slug LIKE 'evomentor-thuringia%' AND o.status = 'accepted'
GROUP BY p.slug, o.grade_band ORDER BY p.slug, o.grade_band;
```

Expected for each project: `5/6` 174 goals 0 to 173, `7/8` 90 goals 0 to 89.
