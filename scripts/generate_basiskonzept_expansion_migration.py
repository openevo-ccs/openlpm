#!/usr/bin/env python3
"""Makes the migration that lengthens the explanations of rating 2 and 3 in the AI-drafted Basiskonzept links of the grade 5/6 goals.

Susan Hanisch, 2026-11-02: the drafted explanations of migration 214 are too short where the relevance is high. They should be about as long as
in her own goals (median 54 words at rating 3 and 48 at rating 2, against 21 in the drafts). The new texts were written by Claude drafting agents
from the exact goal wording, the concept definitions and eight of her own explanations as examples, then reviewed by Hermes (GWDG). They are AI
drafts that she has not reviewed.

The Hermes review found entries whose own explanation admits that the goal does not contain the concept. Those ratings are corrected: a few go
to 1 (no link), two go from 3 to 2 with a rewritten text. A correction changes the entry, the main-concept list (basiskonzepte_primaer) and the
secondary list (basiskonzepte_sekundaer) of that goal. Everything else of a goal stays as it is.

The script reads the current rows of the live space and the sandbox, checks the new texts by code (length, banned wording, every entry present),
and writes one guarded UPDATE per goal and space. An UPDATE only changes a goal whose explanations still have the exact old text, so a later human
edit is never overwritten and running the migration twice changes nothing.

Usage: python scripts/generate_basiskonzept_expansion_migration.py --expanded scripts/data/grade56_basiskonzept_expanded_2026_11_02.json
         --corrections scripts/data/grade56_basiskonzept_rating_corrections_2026_11_02.json --number 218 --out supabase/migrations/218_....sql
(needs .supabase-secrets/service-role-key.txt, read-only)
"""
import argparse
import ast
import copy
import json
import os
import re
import sys
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
U = 'https://tfynvjjxyluzorigyfsp.supabase.co/rest/v1/'
BANNED = ['passgenau', 'optimal', 'zielgerichtet', 'Ziel der Evolution', 'Evolution will', 'Evolution hat das Ziel']
LIMITS = {3: (40, 90), 2: (30, 75)}
BK_ORDER = ['bk_evolutive_entwicklung', 'bk_individuelle_entwicklung', 'bk_struktur_funktion', 'bk_steuerung_regelung',
            'bk_stoff_energie_umwandlung', 'bk_information_kommunikation']
NO_LINK = 'Das Lernziel selbst spricht dieses Basiskonzept nicht an.'


def norm(s):
    return re.sub(r'[^0-9a-zäöüß]', '', unicodedata.normalize('NFC', s or '').lower())


def get(path, key):
    out, off = [], 0
    while True:
        r = urllib.request.Request(U + path + f'&limit=1000&offset={off}', headers={'apikey': key, 'Authorization': 'Bearer ' + key})
        pg = json.load(urllib.request.urlopen(r))
        out += pg
        if len(pg) < 1000:
            return out
        off += 1000


def content_of(r):
    return r['content'] if isinstance(r['content'], dict) else ast.literal_eval(r['content'])


def jq(v):
    j = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    assert '$j$' not in j
    return f'$j${j}$j$::jsonb'


def tq(s):
    assert '$t$' not in s
    return f'$t${s}$t$'


def apply_corrections(arr, prim, sec, corr):
    """Returns the changed array and the new main/secondary lists for one goal."""
    arr = copy.deepcopy(arr)
    for e in arr:
        c = corr.get(e['basiskonzept_id'])
        if not c:
            continue
        e['relevanz_beurteilung'] = c['relevanz']
        if c['relevanz'] == 1:
            e['begruendung'] = NO_LINK
            for k in ('relevante_unterkonzepte', 'relevante_evolutionskonzepte', 'relevante_unterkonzepte_taxonomie', 'relevante_evolutionskonzepte_taxonomie', 'relevante_teilkonzepte'):
                e[k] = []
        else:
            e['begruendung'] = c['begruendung']
    rel = {e['basiskonzept_id']: e['relevanz_beurteilung'] for e in arr}
    top = max(rel.values())
    if top == 3:
        threes = [k for k in BK_ORDER if rel[k] == 3]
        prim2 = threes if len(threes) <= 2 else [k for k in BK_ORDER if k in prim and rel[k] == 3][:2]
    elif top == 2:
        kept = [k for k in BK_ORDER if k in prim and rel[k] == 2]
        prim2 = kept or [k for k in BK_ORDER if rel[k] == 2][:2]
    else:
        prim2 = []
    sec2 = [k for k in BK_ORDER if rel[k] == 2 and k not in prim2]
    return arr, prim2, sec2


ap = argparse.ArgumentParser()
ap.add_argument('--expanded', nargs='+', required=True)
ap.add_argument('--corrections', required=True)
ap.add_argument('--number', required=True)
ap.add_argument('--out', required=True)
a = ap.parse_args()
key = open(os.path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')).read().strip()

new = {}
for p in a.expanded:
    for g in json.load(open(p, encoding='utf-8')):
        new[g['id']] = g['begruendung']
corr_by_prefix = {}
for c in json.load(open(a.corrections, encoding='utf-8')):
    corr_by_prefix.setdefault(c['id8'], {})[c['bk']] = c

projects = {p['slug']: p['id'] for p in get('projects?select=id,slug&slug=in.(evomentor-thuringia,evomentor-thuringia-sandbox)', key)}
rows = {}
for slug, pid in projects.items():
    rows[slug] = [r for r in get(f'lpm_data_objects?select=id,description,content&project_id=eq.{pid}&status=eq.accepted&grade_band=eq.5/6', key)
                  if (content_of(r).get('ki_entwurf') or {}).get('feedback') == '01891c55']
live = {r['id']: r for r in rows['evomentor-thuringia']}


def corr_for(gid):
    return corr_by_prefix.get(gid[:8], {})


problems, count = [], 0
for gid, texts in new.items():
    r = live.get(gid)
    if not r:
        problems.append(f'{gid[:8]}: not a drafted live goal')
        continue
    ents = {e['basiskonzept_id']: e for e in content_of(r)['basiskonzeptbezug']}
    for bk, txt in texts.items():
        e = ents.get(bk)
        if not e or e['relevanz_beurteilung'] < 2:
            problems.append(f'{gid[:8]} {bk}: no entry with rating 2 or 3')
            continue
        c = corr_for(gid).get(bk)
        rating = c['relevanz'] if c else e['relevanz_beurteilung']
        text = (c.get('begruendung') if c and c['relevanz'] >= 2 else txt)
        if rating >= 2:
            n = len(text.split())
            lo, hi = LIMITS[rating]
            if not lo <= n <= hi:
                problems.append(f'{gid[:8]} {bk}: {n} words for rating {rating}')
            for w in BANNED:
                if w.lower() in text.lower():
                    problems.append(f'{gid[:8]} {bk}: contains {w!r}')
            if re.search(r', nicht [^.]{0,60}, sondern|nicht nur [^.]{0,80}, sondern', text):
                problems.append(f'{gid[:8]} {bk}: contrast construction')
        count += 1
for gid, r in live.items():
    for e in content_of(r)['basiskonzeptbezug']:
        if e['relevanz_beurteilung'] >= 2 and e['basiskonzept_id'] not in new.get(gid, {}):
            problems.append(f'{gid[:8]} {e["basiskonzept_id"]}: no new text')
for pre, d in corr_by_prefix.items():
    if not [g for g in live if g.startswith(pre)]:
        problems.append(f'correction for unknown goal {pre}')
if problems:
    print('\n'.join(problems))
    print(f'{len(problems)} problems, nothing written')
    sys.exit(1)

sb_by_key = {}
for r in rows['evomentor-thuringia-sandbox']:
    c = content_of(r)
    sb_by_key.setdefault((norm(c.get('originaltext') or r['description']), norm(c.get('unterthema'))), []).append(r)
stmts, rating_changes = [], 0
for slug, project_sql in (('evomentor-thuringia', f"project_id = '{projects['evomentor-thuringia']}'"),
                          ('evomentor-thuringia-sandbox', f"project_id = '{projects['evomentor-thuringia-sandbox']}'")):
    stmts.append(f'-- ===== {slug} =====')
    for gid, texts in new.items():
        lr = live[gid]
        if slug == 'evomentor-thuringia':
            r = lr
        else:
            c0 = content_of(lr)
            cand = sb_by_key.get((norm(c0.get('originaltext') or lr['description']), norm(c0.get('unterthema'))), [])
            if len(cand) != 1:
                print(f'sandbox match for {gid[:8]}: {len(cand)} candidates'); sys.exit(1)
            r = cand[0]
        c = content_of(r)
        arr = c['basiskonzeptbezug']
        idx = {e['basiskonzept_id']: i for i, e in enumerate(arr)}
        corr = corr_for(gid)
        # entries whose text changes (all of 'texts'), guarded on the old text
        guards = [f"content #>> '{{basiskonzeptbezug,{idx[bk]},begruendung}}' = {tq(arr[idx[bk]]['begruendung'])}" for bk in texts]
        if corr:
            rating_changes += len([1 for x in corr.values() if x['relevanz'] != arr[idx[x['bk']]]['relevanz_beurteilung']])
            # whole array replaced: first apply the new texts, then the corrections
            arr2 = copy.deepcopy(arr)
            for bk, txt in texts.items():
                arr2[idx[bk]]['begruendung'] = txt.strip()
            arr3, prim, sec = apply_corrections(arr2, c.get('basiskonzepte_primaer') or [], c.get('basiskonzepte_sekundaer') or [], corr)
            expr = (f"jsonb_set(jsonb_set(jsonb_set(content, '{{basiskonzeptbezug}}', {jq(arr3)}), "
                    f"'{{basiskonzepte_primaer}}', {jq(prim)}), '{{basiskonzepte_sekundaer}}', {jq(sec)})")
        else:
            expr = 'content'
            for bk, txt in texts.items():
                expr = f"jsonb_set({expr}, '{{basiskonzeptbezug,{idx[bk]},begruendung}}', to_jsonb({tq(txt.strip())}::text))"
        expr = f"jsonb_set({expr}, '{{ki_entwurf,begruendungen_erweitert}}', '\"2026-11-02\"'::jsonb)"
        stmts.append(f"UPDATE lpm_data_objects SET content = {expr}, updated_at = now() WHERE id = '{r['id']}' AND {project_sql} AND " + ' AND '.join(guards) + ';')

n_corr = sum(len(v) for v in corr_by_prefix.values())
header = f"""-- {a.number}: longer explanations for the high-relevance Basiskonzept ratings of the AI-drafted grade 5/6 goals.
--
-- Susan Hanisch, 2026-11-02: the explanations drafted by migration 214 are too short where the relevance is high; they should be about as long as
-- in her own goals (median 54 words at rating 3 and 48 at rating 2, against 21 in the drafts). {len(new)} goals, {count} explanations (ratings 2 and 3)
-- are rewritten in the live space and in the sandbox copy. The new texts are AI drafts that nobody has checked; content.ki_entwurf stays on every
-- goal and gets begruendungen_erweitert = 2026-11-02.
-- A Hermes (GWDG) review of the new texts found {n_corr} entries whose own explanation admits that the goal does not contain the concept. Those
-- ratings are corrected here (to 1, no link, or from 3 to 2 with a rewritten text), together with the main and secondary concept lists of the goal.
-- Tags, methods and everything else are untouched.
-- Each UPDATE only changes a goal whose explanations still have the exact old text, so a later human edit is never overwritten and running this
-- twice changes nothing. Generated by scripts/generate_basiskonzept_expansion_migration.py.
SET search_path = public, extensions;

"""
footer = f"""
DO $$
DECLARE done integer;
BEGIN
  SELECT count(*) INTO done FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.content -> 'ki_entwurf' ->> 'begruendungen_erweitert' = '2026-11-02';
  IF done <> {2 * len(new)} THEN
    RAISE EXCEPTION 'migration {a.number}: expected {2 * len(new)} goals with longer explanations ({len(new)} per space), found %', done;
  END IF;
END $$;
"""
open(a.out, 'w', encoding='utf-8', newline='\n').write(header + '\n'.join(stmts) + '\n' + footer)
print(f'{len(new)} goals, {count} explanations, {n_corr} corrections, 2 spaces written to {a.out}')
