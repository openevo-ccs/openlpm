#!/usr/bin/env python3
"""Makes the grade 5/6 Lernziele of EvoMentor Thuringia (and its sandbox copy) match Susan's CSV.

Rule (Susan 2026-10-23 and again 2026-10-30, Dustin 2026-10-30): the only grade 5/6 learning
goals shown are the ones in the CSV, with the CSV's wording. Nothing else is shown.

  * A live row whose text already equals a CSV goal stays (wording re-set to the CSV text).
  * A live row that is the same single goal in other words is reused: it gets the CSV wording and
    keeps its Basiskonzept suggestions, favorites and links (PAIRS and CONFIRMED_FUZZY below, each
    pair read by hand on both sides).
  * Every other CSV goal becomes a new row (no Basiskonzept suggestions yet).
  * Every live 5/6 row that is no CSV goal is set to status 'archived' (hidden, and nothing is deleted), so
    judgments, favorites and links that point at it stay intact and the step can be undone.

Only change to the CSV text: line-wrap hyphens ("Materia-lien") are closed up, as in
migration 168. Typos in the CSV are left as written.

Usage:
  python scripts/generate_grade56_verbatim_csv_migration.py --csv <csv> --live <json> --sandbox <json> --out <sql> [--review <txt>]
(--live/--sandbox: output of scripts/read-project-content.mjs --format json for each project.)
"""
import argparse
import csv
import difflib
import json
import re
import unicodedata

LIVE_PROJECT = '1b121ef2-96c2-43f7-aa2b-0e07b8de114a'
SANDBOX_SLUG = 'evomentor-thuringia-sandbox'
MIGRATION_NO = '203'

# CSV row index -> start of the live row's text (same single goal, other words). Read by hand 2026-10-30.
PAIRS = {
    0: 'kriteriengeleitetes Betrachten/Beobachten und Beschreiben anwenden',
    1: 'kriteriengeleitetes Vergleichen als naturwissenschaftliche Arbeitsmethode anwenden',
    2: 'Naturmaterialien und Fachbegriffe ordnen bzw. klassifizieren',
    3: 'Sachverhalte unter Angabe korrekter Ursache-Wirkungs-Beziehungen begründen',
    4: 'Modelle zur Veranschaulichung naturwissenschaftlicher Sachverhalte nutzen',
    15: 'Die Schrittfolge des Forschenden Lernens an einem konkreten Beispiel anwenden',
    55: 'das Aufsteigen von Flüssigkeiten in engen Röhrchen beschreiben und begründen (Adhäsionskräfte',
    88: 'Zwei Vertreter einer Pflanzenfamilie (z. B. Kreuzblütengewächse) hinsichtlich ausgewählter',
    93: 'die Wirbeltierklassen und Vertreter nennen',
    94: 'den Bau verschiedener Wirbeltiere (Körpergliederung, Skelett)',
    97: 'Zusammenhang zwischen Gliedmaßenskelett und Fortbewegungsart bei Säugetieren',
    135: 'Nahrungsbestandteile und ihre Bedeutung benennen',
    140: 'abwechslungsreiche und vollwertige Ernährung begründen',
    143: 'Experimente angeleitet durchführen: Nachweis von Stärke und Fett in verschiedenen Nahrungsmitteln',
}
# Rewordings found by a similarity scorer and then confirmed by reading both sides (CSV row indexes).
CONFIRMED_FUZZY = {124, 77, 45, 61, 78, 33, 63, 5, 122, 125, 89, 34, 81, 126, 44, 60, 9, 129, 130, 150, 128, 26,
                   59, 25, 57, 102, 17, 95, 18, 151, 38, 92, 82, 37, 36}


def norm(s):
    return re.sub(r'[^0-9a-zäöüß]', '', unicodedata.normalize('NFC', s).lower())


def sq(s):
    return "'" + s.replace("'", "''") + "'"


def clean(s):
    s = unicodedata.normalize('NFC', s).strip()
    s = re.sub(r'(?<=[a-zäöüß])-(?=[a-zäöüß])', '', s)  # closes line-wrap hyphens ("Materia-lien")
    # "Oberflächen- beschaffenheit": hyphen plus space, but not "Denk- und" / "Wild- oder"
    return re.sub(r'(?<=[a-zäöüß])- (?=(?!und\b|oder\b|bzw\b)[a-zäöüß])', '', s)


def title_of(text):
    """The heading is the goal's own wording with line breaks turned into spaces (cut at a word boundary only if very long)."""
    t = ' '.join(text.split())
    if len(t) > 400:
        t = t[:400].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
    return t


ap = argparse.ArgumentParser()
for name in ('csv', 'live', 'sandbox', 'out'):
    ap.add_argument('--' + name, required=True)
ap.add_argument('--review')
args = ap.parse_args()

raw = list(csv.reader(open(args.csv, encoding='utf-8-sig', newline='')))[1:]
live = {
    'live': [r for r in json.load(open(args.live, encoding='utf-8')) if r['grade_band'] == '5/6'],
    'sandbox': [r for r in json.load(open(args.sandbox, encoding='utf-8')) if r['grade_band'] == '5/6'],
}


def ltext(r):
    return (r['content'] or {}).get('originaltext') or r['description'] or r['title']


def lname(r):
    return re.sub(r'^2\.2\.\d+\s+', '', (r['content'].get('thema') or ''))


labels = {}
for r in live['live']:
    t = r['content'].get('thema')
    if t:
        labels[re.sub(r'^2\.2\.\d+\s+', '', t)] = t


def label_of(name):
    for k, v in labels.items():
        if k.startswith(name) or name.startswith(k):
            return v
    raise SystemExit('no topic label for ' + name)


csvr, last = [], None
for i, r in enumerate(raw):
    th, un, org, tx = r[0].strip(), r[1].strip(), r[2].strip(), r[3]
    inherited = not th
    if inherited:
        th, un, org = last
    else:
        last = (th, un, org)
    name = re.sub(r'^\d+\s+', '', th)
    if inherited:
        if tx.startswith('die Bedeutung von Ernährung und Atmung'):
            un = 'Ernährung und Atmung'
        elif tx.startswith('die Fortpflanzung und Entwicklung beschreiben'):
            un = 'Fortpflanzung und Entwicklung'
        elif tx.startswith('Modellversuche'):
            un = 'Fachpraktische Arbeiten (Lotuseffekt)'
    org = {'Curriculum': 'curriculum', 'Curriculum, modified': 'curriculum_modified',
           'newly generated': 'newly_generated'}.get(org, 'curriculum')
    csvr.append(dict(i=i, name=name, thema=label_of(name), unter=('' if un == '(none)' else un.strip()),
                     origin=org, text=clean(tx), raw=tx))

# Assign CSV goals to live rows (live project first; the sandbox copy is matched by identical content).
plan = {}
used = set()
L = live['live']
ln = [norm(ltext(r)) for r in L]
for c in csvr:  # 1. same text, preferring the row in the same subtopic (several Bionik goals share a sentence)
    k = norm(c['text'])
    hits = [j for j, x in enumerate(ln) if j not in used and x == k]
    if hits:
        best = [j for j in hits if norm(L[j]['content'].get('unterthema') or '') == norm(c['unter'])] or hits
        plan[c['i']] = best[0]
        used.add(best[0])
cand = []
for c in csvr:  # 2. confirmed rewordings
    if c['i'] in plan or c['i'] not in CONFIRMED_FUZZY:
        continue
    k = norm(c['text'])
    for j, x in enumerate(ln):
        if j in used or norm(c['name'])[:12] != norm(lname(L[j]))[:12]:
            continue
        sc = difflib.SequenceMatcher(None, k, x).ratio()
        if sc >= 0.5:
            cand.append((sc, c['i'], j))
for sc, i, j in sorted(cand, reverse=True):
    if i in plan or j in used:
        continue
    plan[i] = j
    used.add(j)
for i, start in PAIRS.items():  # 3. hand-read pairs
    if i in plan:
        continue
    hits = [j for j, r in enumerate(L) if j not in used and ltext(r).startswith(start)]
    if len(hits) != 1:
        raise SystemExit(f'pair for CSV row {i}: {len(hits)} matches for {start!r}')
    plan[i] = hits[0]
    used.add(hits[0])
missing = CONFIRMED_FUZZY - set(plan)
if missing:
    raise SystemExit(f'confirmed rewordings without a partner: {sorted(missing)}')


def row_key(r):
    return (r['title'], r['description'], r['content'].get('thema'), r['content'].get('unterthema'))


sb_by_key = {}
for r in live['sandbox']:
    sb_by_key.setdefault(row_key(r), []).append(r)


def sandbox_twin(r):
    m = sb_by_key.get(row_key(r), [])
    if len(m) != 1:
        raise SystemExit(f'sandbox twin of {r["id"]}: {len(m)} candidates')
    return m[0]


def same_text(c, r):
    return norm(ltext(r)) == norm(c['text'])


sql = []


def emit(project_sql, project_id_sql, rows_of, tag):
    sql.append(f'-- ===== {tag} =====')
    for c in csvr:
        if c['i'] in plan:
            r = rows_of(L[plan[c['i']]])
            ttl = title_of(c['text'])
            extra = ", 'kurzbezeichnung', " + sq(ttl) + '::text' if 'kurzbezeichnung' in r['content'] else ''
            extra += ", 'thema', " + sq(c['thema']) + '::text'
            if c['unter']:
                extra += ", 'unterthema', " + sq(c['unter']) + "::text, 'unterthema_origin', " + sq(c['origin']) + '::text'
            sql.append(
                f"UPDATE lpm_data_objects SET description = {sq(c['text'])}, title = {sq(ttl)}, "
                f"content = content || jsonb_build_object('originaltext', {sq(c['text'])}::text{extra}), updated_at = now() "
                f"WHERE id = '{r['id']}' AND {project_sql};")
        else:
            cid = 'MNT56-CSV26B-%s-%03d' % (re.match(r'2\.2\.(\d+)', c['thema']).group(1), c['i'])
            content = {'id': cid, 'thema': c['thema'], '_source_id': cid,
                       '_source_file': 'LP_Thueringen_Gym_5_6_MNT_susan_2026_10_30.csv',
                       'originaltext': c['text'], 'unterthema_origin': c['origin']}
            if c['unter']:
                content['unterthema'] = c['unter']
            sql.append(
                'INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, schema_version, status) VALUES (\n'
                f"  {project_id_sql}, 'performance_indicator',\n"
                f"  {sq(title_of(c['text']))},\n  {sq(c['text'])},\n  '5/6', 'Biologie',\n"
                f"  {sq(json.dumps(content, ensure_ascii=False))}::jsonb,\n  'evomentor_de_lernziel_v1.2', 'accepted'\n);")
    hide = [rows_of(r)['id'] for j, r in enumerate(L) if j not in used]
    sql.append(
        "UPDATE lpm_data_objects SET status = 'archived', updated_at = now()\nWHERE " + project_sql
        + " AND grade_band = '5/6' AND status = 'accepted' AND id IN (\n  " + ',\n  '.join("'%s'" % i for i in hide) + '\n);')


emit(f"project_id = '{LIVE_PROJECT}'", f"'{LIVE_PROJECT}'", lambda r: r, 'evomentor-thuringia')
sb_id = f"(SELECT id FROM projects WHERE slug = '{SANDBOX_SLUG}')"
emit(f'project_id = {sb_id}', sb_id, sandbox_twin, SANDBOX_SLUG)

n_same = sum(1 for c in csvr if c['i'] in plan and same_text(c, L[plan[c['i']]]))
header = f"""-- {MIGRATION_NO}: grade 5/6 Lernziele of EvoMentor Thuringia and its sandbox copy now match Susan's CSV.
--
-- Susan Hanisch, feedback c2e29089 (2026-10-30), repeating her instruction of 2026-10-23: the 5/6
-- learning goals must be the ones in her CSV ("LP Thueringen Gym 5,6 MNT"). Dustin, same day:
-- anything that is not a learning goal verbatim as in the CSV must not be shown in EvoMentor.
-- Migration 168 (10/23) kept old condensed or reworded rows that looked close to a CSV line, so
-- only {n_same} of the {len(csvr)} CSV goals matched word for word.
--
--  * {len(plan)} CSV goals reuse an existing row (same text, or the same single goal in other
--    words; each pair was read by hand). The row gets the CSV wording and keeps its Basiskonzept
--    suggestions, favorites and links.
--  * {len(csvr) - len(plan)} CSV goals have no counterpart and are added as new rows. They carry no Basiskonzept
--    suggestions yet.
--  * {len(L) - len(used)} old rows are no CSV goal (many merged two or three CSV goals into one sentence). They
--    are set to status 'archived': hidden wherever students look, nothing deleted, so student
--    judgments, favorites and method links that point at them stay intact. To undo, set their
--    status back to 'accepted'.
--
-- The CSV text is used as written. Only line-wrap hyphens ("Materia-lien") are closed up, as in 168.
-- Both copies get the same change. Generated by scripts/generate_grade56_verbatim_csv_migration.py.
SET search_path = public, extensions;

"""
open(args.out, 'w', encoding='utf-8', newline='\n').write(header + '\n'.join(sql) + '\n')

summary = [f"CSV {len(csvr)} | reuse {len(plan)} (same text {n_same}) | new {len(csvr) - len(plan)} | hidden {len(L) - len(used)}"]
if args.review:
    summary.append('\n== hyphens closed ==')
    for c in csvr:
        for m in re.finditer(r'\S*(?<=[a-zäöüß])-(?=[a-zäöüß])\S*', unicodedata.normalize('NFC', c['raw'])):
            summary.append(f"[{c['i']}] {m.group(0)}")
    summary.append('\n== headings cut short (longer than 400 characters) ==')
    for c in csvr:
        if title_of(c['text']).endswith('…'):
            summary.append(f"[{c['i']}] {title_of(c['text'])[:120]}…")
    seen = {}
    for c in csvr:
        seen.setdefault((c['thema'], c['unter'], title_of(c['text'])), []).append(c['i'])
    summary.append('\n== identical headings inside one subtopic ==')
    for k, v in seen.items():
        if len(v) > 1:
            summary.append(f"{v} {k[2][:100]}")
    summary.append('\n== reused rows whose subtopic differs from the CSV ==')
    for c in csvr:
        if c['i'] in plan:
            r = L[plan[c['i']]]
            if c['unter'] and (r['content'].get('unterthema') or '') != c['unter']:
                summary.append(f"[{c['i']}] live: {r['content'].get('unterthema')!r} CSV: {c['unter']!r}")
    open(args.review, 'w', encoding='utf-8').write('\n'.join(summary))
print('\n'.join(summary))
