#!/usr/bin/env python3
"""Looks a phrase up in a Lehrplan PDF: which page, which grade band (Klassenstufe), which section, with the surrounding lines.

Why: a session has to be able to confirm for itself whether a learning goal is part of a curriculum edition, instead of asking the expert
(Dustin, 2026-11-02). The PDF text comes from pdftotext (poppler). The grade band of a page is the last heading
"Klassenstufe(n) N" / "Einführungsphase" / "Qualifikationsphase" seen on or before that page.

Usage:
  python scripts/lehrplan_pdf_lookup.py --pdf "<path to PDF>" "phrase one" "phrase two" [--printed-offset 5] [--context 3]
  python scripts/lehrplan_pdf_lookup.py --pdf ... --goals-file goals.json     (list of {"id":..., "text":...}: best match per goal)
A phrase is matched case-insensitively on its words; a match needs all words of the phrase on one line or within two neighbouring lines.
--goals-file prints the best fuzzy match per goal (difflib ratio over single lines and line pairs) so wording that differs a little still finds
its place. The output is evidence for a person or a session to read; it does not decide anything.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import tempfile
import unicodedata

HEAD = re.compile(r'(Klassenstufen? \d+(?:/\d+)?|Einführungsphase|Qualifikationsphase)')


def norm(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s).lower().replace('­', '')).strip()


def load(pdf):
    out = os.path.join(tempfile.gettempdir(), 'lehrplan_lookup_' + re.sub(r'\W+', '_', os.path.basename(pdf)) + '.txt')
    if not os.path.isfile(out) or os.path.getmtime(out) < os.path.getmtime(pdf):
        subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', pdf, out], check=True)
    pages = open(out, encoding='utf-8', errors='replace').read().split('\f')
    band, bands = '?', []
    for pg in pages:
        h = HEAD.findall(pg)
        if h:
            band = h[0] if len(h) == 1 else ' / '.join(dict.fromkeys(h))
        bands.append(band)
    return pages, bands


def lines_of(pages):
    for i, pg in enumerate(pages):
        ls = [l.rstrip() for l in pg.split('\n')]
        for j, l in enumerate(ls):
            if l.strip():
                yield i, j, ls, l


def phrase_hits(pages, bands, phrase, offset, ctx):
    words = [w for w in norm(phrase).split() if len(w) > 2]
    hits = []
    for i, j, ls, l in lines_of(pages):
        window = norm(' '.join(ls[j:j + 3]))
        if all(w in window for w in words) and all(w in norm(' '.join(ls[max(0, j - 1):j + 3])) for w in words[:1]):
            hits.append((i, j, ls))
    seen, out = set(), []
    for i, j, ls in hits:
        if (i, j // 3) in seen:
            continue
        seen.add((i, j // 3))
        out.append({'pdf_page': i + 1, 'printed_page': i + 1 - offset, 'band': bands[i], 'context': [l.strip() for l in ls[max(0, j - ctx):j + ctx + 2] if l.strip()]})
    return out


def best_match(pages, bands, text, offset):
    target = norm(text)
    best = (0, None)
    for i, j, ls, l in lines_of(pages):
        for span in (1, 2, 3):
            cand = norm(' '.join(ls[j:j + span]))
            r = difflib.SequenceMatcher(None, target, cand).ratio()
            if r > best[0]:
                best = (r, (i, j, ls, span))
    if not best[1]:
        return None
    i, j, ls, span = best[1]
    return {'similarity': round(best[0], 2), 'pdf_page': i + 1, 'printed_page': i + 1 - offset, 'band': bands[i], 'matched_lines': [l.strip() for l in ls[j:j + span]]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('phrases', nargs='*')
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--printed-offset', type=int, default=5, help='PDF page minus printed page (Thüringen 2026 Erprobungsfassung: 5)')
    ap.add_argument('--context', type=int, default=3)
    ap.add_argument('--goals-file')
    a = ap.parse_args()
    pages, bands = load(a.pdf)
    if a.goals_file:
        for g in json.load(open(a.goals_file, encoding='utf-8')):
            print(json.dumps({'id': g['id'], 'text': g['text'][:90], 'best': best_match(pages, bands, g['text'], a.printed_offset)}, ensure_ascii=False))
        return
    for ph in a.phrases:
        hits = phrase_hits(pages, bands, ph, a.printed_offset, a.context)
        print(f'## "{ph}": {len(hits)} place(s)')
        for h in hits[:6]:
            print(f"  PDF page {h['pdf_page']} (printed {h['printed_page']}), {h['band']}")
            for l in h['context']:
                print('     ', l)


if __name__ == '__main__':
    main()
