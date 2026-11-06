#!/usr/bin/env python3
"""Reads the order of the learning goals in the Thuringia Biology Lehrplan (Gymnasium, Erprobungsfassung 2026).

The government PDF is not in this repository (it lives in the private EvoMentor repo). This script reads
it once, matches every accepted Kl. 7, 8, 9 and 10 Lernziel of EvoMentor Thuringia to the place where the
PDF prints it, and writes that order to a small JSON file. scripts/generate_lernziele_order_migration.py
reads the JSON, so the migration can be rebuilt without the PDF.

How the PDF is read
  * Lernbereiche, subtopics and goals come from the "Sach- und Methodenkompetenz" tables. Each bullet is one goal.
    A bullet with sub-bullets ("Maßnahmen ...: • a • b") counts as one goal per sub-bullet, as in our data.
  * Every row of the live dump is matched to one PDF goal by text similarity. The matching is a best overall
    assignment (scipy), so near-identical goals ("... durch Licht" / "... durch den CO2-Gehalt") cannot swap.
  * A few rows have no PDF goal of their own. They are placed next to a named neighbour (SPECIAL below), each with
    the reason, and listed as uncertain when the PDF does not carry them at all.

Usage
  python scripts/read_lehrplan_order.py --pdf "<LP Thüringen Bio Gym 2026 Erprobungsfassung.pdf>" --live live.json \
      --out scripts/data/lernziele-lehrplan-order-2026-10-30.json [--report report.txt]

Needs PyMuPDF (fitz), numpy and scipy. --live is a dump made by scripts/dump_lernziele_with_sequence.mjs.
The PDF is data: read it with a plain extraction only.
"""
import argparse
import difflib
import json
import re
import sys
import unicodedata

import fitz
import numpy as np
from scipy.optimize import linear_sum_assignment

SOFT_HYPHEN = chr(0xAD)
PAGE_OFFSET = 5  # printed page number = PDF page - 5

# Subtopic headings per Lernbereich block. A line that equals one of these exactly is a heading.
HEADINGS_78 = [
    'Wirbellose als vielfältige Tiergruppe', 'Insekten', 'Fachpraktische Arbeiten', 'Pflanzliche und tierische Zellen',
    'Bakterien', 'Fortpflanzung, Entwicklung und Sexualität', 'Nervensystem', 'Verdauungssystem', 'Atmungssystem',
    'Ausscheidungssystem', 'Blut und Herz-Kreislauf-System', 'Zusammenwirken der Systeme', 'Abwehrsystem',
]
HEADINGS_910 = [
    'Grüne Pflanzen', 'Pflanzenphysiologie', 'Fotosynthese', 'Zellatmung', 'Pilze', 'Systematisierung',
    'Wechselwirkungen zwischen Organismen und ihrer Umwelt', 'Ökosystem', 'Anthropogene Einflüsse auf Ökosysteme und deren Folgen',
    'Fachpraktische Arbeiten', 'Speicherung genetischer Information', 'Weitergabe genetischer Information',
    'Realisierung genetischer Information', 'Variabilität von Merkmalen', 'Anwendung genetischer Erkenntnisse',
    'Humangenetik', 'Gentechnik', 'Evolutionsbiologische Zusammenhänge', 'Belege für die Evolution', 'Evolution des Menschen',
]

# Rows that do not match one PDF goal by themselves.
#   ('after'|'before', neighbour key, certainty, reason)
# certainty 'bullet' = the PDF has this goal, the row is only a piece of one bullet, so the place is fixed by the bullet.
# certainty 'uncertain' = the 2026 PDF does not list this goal at all; the place is the best guess.
SPECIAL = {
    'GY-78-WIR-WTG-5': ('after', 'GY-78-WIR-WTG-4', 'bullet',
                        'Second half of the bullet "ausgewählte Merkmale ... nennen und den Tiergruppen Vertreter begründet zuordnen" '
                        '(sub-bullets Weichtiere, Ringelwürmer, Gliederfüßer). The row sits after the three sub-bullets.'),
    'GY-78-ZEL-PTZ-7': ('after', 'GY-78-ZEL-PTZ-6', 'uncertain',
                        'The Lernbereich "Zellen als Lebensbausteine" in the PDF does not list this goal. It appears only in the '
                        'Basiskonzept table on page 15 ("Evolution von Einzellern und Vielzellern (am Beispiel der Grünalgen)", Klassenstufen 7/8) '
                        'and in the ministry change list. Kept where the data had it, at the end of "Pflanzliche und tierische Zellen".'),
    'GY-78-HUM-BHK-6': ('after', 'GY-78-HUM-BHK-5', 'uncertain',
                        'The 2026 PDF has one bullet "Maßnahmen zur Gesunderhaltung begründen (z. B. regelmäßige sportliche Betätigung)". '
                        'The 2024 text also named "ausgewogene Ernährung". The row has no goal of its own in the 2026 PDF; it stays next to its bullet.'),
    'GY-910-GEN-WGE-7': ('before', 'GY-910-GEN-WGE-8', 'bullet',
                         'Opening part of the bullet "die 1., 2. und 3. MENDELsche Regel erläutern und anwenden:", which the four sub-bullets follow.'),
    'GY-910-OKO-OSY-1': ('before', 'GY-910-OKO-OSY-2', 'bullet',
                         'Opening part of the bullet "den Begriff Ökosystem als Einheit von Biotop und Biozönose definieren und Ökosysteme ... charakterisieren:", '
                         'which the four sub-bullets follow.'),
    'GY-910-OKO-OSY-6': ('after', 'GY-910-OKO-OSY-5', 'uncertain',
                         'The 2026 PDF does not list "Ökosysteme nach ausgewählten Kriterien einteilen" in the Lernbereich Ökologie, although the ministry change list '
                         'names it as new. Kept at the end of the subtopic Ökosystem, where the data had it.'),
    'GY-910-PGP-ZA-7': ('after', 'GY-910-PGP-ZA-6', 'uncertain',
                        'The 2026 PDF names only "Verringerung der Lufttemperatur" under "Maßnahmen zur verlustarmen Lagerung". The 2024 text also named '
                        'the carbon dioxide content. The row has no goal of its own in the 2026 PDF; it stays after the Temperatur row.'),
}

# Rows whose text cannot be matched by similarity alone. The row is tied to the PDF goal that starts with the first text.
# The second list names further PDF goals the same row already contains (the data merged them into one row).
MANUAL = {
    'GY-78-HUM-FES-5': ('Sexualität als natürliches Verhalten kennzeichnen', []),  # the data shortened the bullet
    'GY-910-GEN-HUM-1': ('gonosomal (z. B. Rot-Grün-Sehschwäche', ['Ursachen, Symptome und Therapiemöglichkeiten erblich bedingter Erkrankungen nennen']),
    'GY-910-GEN-HUM-2': ('autosomal (z. B. Mukoviszidose', ['Ursachen, Symptome und Therapiemöglichkeiten erblich bedingter Erkrankungen nennen']),
    'GY-910-OKO-FPA-2': ('die Struktur eines Ökosystems darstellen', ['die Artenkenntnisse erweitern und anwenden']),  # one row holds both Exkursion goals
}


def npl(s):
    return re.sub(r'[^0-9a-zäöüß]', '', unicodedata.normalize('NFC', s or '').lower())


def key_of(row):
    c = row['content'] or {}
    return c.get('_source_id') or 'text:' + (c.get('originaltext') or row['description'] or row['title'])


def extract_pages(pdf_path):
    doc = fitz.open(pdf_path)
    return {i + 1: p.get_text('text') for i, p in enumerate(doc)}


def build_atoms(pages, first_page, last_page, headings, lernbereich_re):
    """Ordered goals of the Sach- und Methodenkompetenz tables between two PDF pages."""
    items = []
    buf = None

    def push():
        nonlocal buf
        if buf:
            items.append(buf)
        buf = None

    for n in range(first_page, last_page + 1):
        for raw in pages[n].split('\n'):
            s = raw.strip()
            if s.startswith(SOFT_HYPHEN):
                s = '- ' + s[1:].strip()
            s = s.replace(SOFT_HYPHEN, '')
            if not s or re.fullmatch(r'\d{1,2}', s) or re.match(r'^\d{1,2} Lehrplan ', s):  # page numbers and the footnote on page 24
                continue
            m = lernbereich_re.match(s)
            if m:
                push(); items.append(('H1', m.groups()[-1].strip(), n)); continue
            if s in headings:
                push(); items.append(('H2', s, n)); continue
            if s.startswith('Sach- und Methodenkompetenz'):
                push(); items.append(('SACH', s, n)); continue
            if s.startswith('Selbst- und Sozialkompetenz'):
                push(); items.append(('SOZ', s, n)); continue
            if re.match(r'^(Klassenstufe \d+|Die Schülerinnen und Schüler können|2\.\d(\.\d)* )', s):
                push(); items.append(('K', s, n)); continue
            if s[:2] in ('- ', '➢ ', '– '):
                push(); buf = ('B', s[2:].strip(), n); continue
            if s in ('–', '-'):
                push(); buf = ('B', '', n); continue
            if s.startswith('• '):
                push(); buf = ('S', s[2:].strip(), n); continue
            if buf:
                buf = (buf[0], (buf[1] + ' ' + s).strip(), buf[2])
            else:
                items.append(('T', s, n))
    push()

    atoms, topic, sub, bullet_no, cur, skipping = [], None, None, 0, None, True
    for kind, text, page in items:
        if kind == 'H1':
            topic, sub, bullet_no, skipping, cur = text, None, 0, True, None
        elif kind == 'SACH':
            skipping = False
        elif kind == 'SOZ':
            skipping = True
        elif kind == 'H2':
            sub, bullet_no, cur = text, 0, None
        elif skipping or topic is None:
            continue
        elif kind == 'B':
            bullet_no += 1
            cur = [text, bullet_no, 0]
            atoms.append(dict(topic=topic, sub=sub, b=bullet_no, s=0, bullet=text, subb=None, page=page))
        elif kind == 'S':
            if cur is None:
                raise SystemExit(f'sub-bullet without a bullet on PDF page {page}: {text[:60]}')
            cur[2] += 1
            atoms.append(dict(topic=topic, sub=sub, b=cur[1], s=cur[2], bullet=cur[0], subb=text, page=page))
    has_sub = {(a['topic'], a['sub'], a['b']) for a in atoms if a['s'] > 0}
    atoms = [a for a in atoms if not (a['s'] == 0 and (a['topic'], a['sub'], a['b']) in has_sub)]
    for i, a in enumerate(atoms):
        a['pos'] = i
    return atoms


def atom_label(a):
    return (a['bullet'] + (' ' + a['subb'] if a['subb'] else '')).strip()


def similarity(row, atom):
    ot = npl((row['content'] or {}).get('originaltext') or row['description'])
    variants = [atom['bullet'] + ' ' + (atom['subb'] or ''), (atom['subb'] or '') + ' ' + atom['bullet'], atom['subb'] or '', atom['bullet']]
    return max(difflib.SequenceMatcher(None, ot, npl(v)).ratio() for v in variants if v.strip())


def place_rows(rows, atoms, grades_label):
    """Returns (ordered entries, atoms with no row)."""
    by_key = {key_of(r): r for r in rows}
    special = {k: v for k, v in SPECIAL.items() if k in by_key}
    manual, covered = {}, set()

    def find_goal(start):
        hits = [a['pos'] for a in atoms if atom_label(a).startswith(start) or (a['subb'] or '').startswith(start)]
        if len(hits) != 1:
            raise SystemExit(f'{grades_label}: {len(hits)} PDF goals start with {start!r}')
        return hits[0]

    for k, (start, extras) in MANUAL.items():
        if k in by_key:
            manual[k] = find_goal(start)
            covered.update(find_goal(x) for x in extras)
    solve = [r for r in rows if key_of(r) not in special and key_of(r) not in manual]
    taken = set(manual.values()) | covered
    free_atoms = [a for a in atoms if a['pos'] not in taken]
    sims = np.array([[similarity(r, a) for a in free_atoms] for r in solve])
    dummy = np.full((len(solve), len(solve)), 0.40)
    ri, ci = linear_sum_assignment(-np.concatenate([sims, dummy], axis=1))
    atom_of, score_of = dict(manual), {k: 1.0 for k in manual}
    for i, c in zip(ri, ci):
        if c >= len(free_atoms):
            raise SystemExit(f'{grades_label}: no PDF goal found for {key_of(solve[i])} ({solve[i]["description"][:70]})')
        atom_of[key_of(solve[i])] = free_atoms[c]['pos']
        score_of[key_of(solve[i])] = float(sims[i, c])
    order = sorted(atom_of, key=lambda k: atom_of[k])
    entries = []
    for k in order:
        a = atoms[atom_of[k]]
        entries.append(dict(key=k, certainty='sure' if score_of[k] >= 0.7 or k in manual else 'check', similarity=round(score_of[k], 2),
                            pdf_page=a['page'], printed_page=a['page'] - PAGE_OFFSET, lernbereich=a['topic'], unterthema=a['sub'],
                            pdf_goal=atom_label(a)))
    for k, (where, neighbour, certainty, reason) in special.items():
        i = next(j for j, e in enumerate(entries) if e['key'] == neighbour)
        ref = entries[i]
        entry = dict(key=k, certainty=certainty, similarity=None, pdf_page=ref['pdf_page'], printed_page=ref['printed_page'],
                     lernbereich=ref['lernbereich'], unterthema=ref['unterthema'], pdf_goal=None, note=reason)
        entries.insert(i + 1 if where == 'after' else i, entry)
    placed = {atom_of[k] for k in atom_of} | covered
    return entries, [a for a in atoms if a['pos'] not in placed]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--live', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--report')
    args = ap.parse_args()

    pages = extract_pages(args.pdf)
    rows = [r for r in json.load(open(args.live, encoding='utf-8')) if r['status'] == 'accepted']
    out, report = {'source': 'LP Thüringen Bio Gym 2026 Erprobungsfassung (printed page = PDF page - 5)', 'bands': {}}, []

    a78 = build_atoms(pages, 24, 29, HEADINGS_78, re.compile(r'^2\.1\.1\.(\d) (.+)$'))
    a910 = build_atoms(pages, 30, 37, HEADINGS_910, re.compile(r'^2\.(2|3)\.1\.(\d) (.+)$'))
    report.append(f'PDF goals read: Kl. 7/8 {len(a78)}, Kl. 9 and 10 {len(a910)}')

    jobs = [('7/8', [r for r in rows if r['grade_band'] in ('7', '8', '7/8')], a78), ('9/10', [r for r in rows if r['grade_band'] in ('9', '10')], a910)]
    for label, band_rows, atoms in jobs:
        entries, unused = place_rows(band_rows, atoms, label)
        grade_of = {key_of(r): r['grade_band'] for r in band_rows}
        for e in entries:
            e['grade_now'] = grade_of[e['key']]
        out['bands'][label] = entries
        report.append(f'\n== {label}: {len(band_rows)} rows placed, {len(atoms)} PDF goals, {len(unused)} PDF goals without a row ==')
        for a in unused:
            report.append(f'  PDF goal with no row (printed page {a["page"] - PAGE_OFFSET}, {a["topic"]} / {a["sub"]}): {atom_label(a)}')
        for e in entries:
            if e['certainty'] != 'sure':
                report.append(f'  [{e["certainty"]}] {e["key"]}  sim={e["similarity"]}  {e.get("note", e["pdf_goal"])}')
    # sanity: every row placed exactly once
    for label, band_rows, _ in jobs:
        keys = [e['key'] for e in out['bands'][label]]
        assert len(keys) == len(set(keys)) == len(band_rows), (label, len(keys), len(set(keys)), len(band_rows))
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    text = '\n'.join(report)
    if args.report:
        open(args.report, 'w', encoding='utf-8').write(text)
    print(text)


if __name__ == '__main__':
    sys.exit(main())
