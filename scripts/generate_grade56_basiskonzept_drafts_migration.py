#!/usr/bin/env python3
"""Makes the migration that gives the grade 5/6 goals without Basiskonzept links their AI-drafted links and didactic strategies
(feedback 01891c55 of 2026-11-01, Susan Hanisch).

Only 45 of the 174 grade 5/6 goals carried Basiskonzept ratings and didactic strategies. For the other 129 an AI session (Claude)
drafted them from the exact goal wording, using the six Basiskonzepte, the sub-concepts that exist in the concept tree, the 15 methods
of the Lernziele filter and three goals Susan's lab already has as examples. Nobody has checked them: every drafted goal carries
content.ki_entwurf so the draft can be found, reviewed and replaced.

This script checks the drafts by code (shape, scale, labels, methods), refuses to write anything if a check fails, resolves each
sub-concept label to the id it has in each project, and writes one UPDATE per goal and project. The UPDATE only touches a goal that has no
basiskonzeptbezug yet, so existing ratings are never overwritten.

Usage: python scripts/generate_grade56_basiskonzept_drafts_migration.py --drafts d1.json d2.json ... --live <dump> --sandbox <dump>
         --live-elements <json> --sandbox-elements <json> --allowed <allowed_labels.json> --number 214 --out <sql>
(--live/--sandbox: output of scripts/read-project-content.mjs --format json. --*-elements: lpm_schema_elements rows id,label,parent_id.)
"""
import argparse
import ast
import json
import re
import sys
import unicodedata

LIVE_PROJECT = '1b121ef2-96c2-43f7-aa2b-0e07b8de114a'
SANDBOX_SLUG = 'evomentor-thuringia-sandbox'
BK_ORDER = ['bk_evolutive_entwicklung', 'bk_individuelle_entwicklung', 'bk_struktur_funktion', 'bk_steuerung_regelung',
            'bk_stoff_energie_umwandlung', 'bk_information_kommunikation']
BK_LABEL = {'bk_evolutive_entwicklung': 'Evolutive Entwicklung', 'bk_individuelle_entwicklung': 'Individuelle Entwicklung',
            'bk_struktur_funktion': 'Struktur und Funktion', 'bk_steuerung_regelung': 'Steuerung und Regelung',
            'bk_stoff_energie_umwandlung': 'Stoff- und Energieumwandlung', 'bk_information_kommunikation': 'Information und Kommunikation'}
METHODS = ['Forschendes Lernen', 'Erfahrungs-/handlungsorientiertes Lernen', 'Problembasiertes Lernen', 'Projektbasiertes Lernen',
           'Kooperative Lernformen', 'Konzeptuelles Lernen', 'Analogien und Vergleiche', 'Narrativer Zugang', 'Modelle und Simulationen',
           '(bioethische) Diskussion', 'Digitale Medien', 'Außerschulische Lernorte', 'Recherche', 'Stationenlernen',
           'Gestalterische/kreative Aufgaben']
BANNED = ['passgenau', 'optimal', 'zielgerichtet', 'Ziel der Evolution', 'Evolution will', 'Evolution hat das Ziel']


def norm(s):
    return re.sub(r'[^0-9a-zäöüß]', '', unicodedata.normalize('NFC', s or '').lower())


def sq(s):
    return "'" + s.replace("'", "''") + "'"


def content_of(r):
    return r['content'] if isinstance(r['content'], dict) else ast.literal_eval(r['content'])


def validate(d, allowed, goal_ids):
    problems = []
    seen = set()
    for g in d:
        gid = g.get('id', '?')
        tag = gid[:8]
        if gid in seen:
            problems.append(f'{tag}: id twice')
        seen.add(gid)
        if gid not in goal_ids:
            problems.append(f'{tag}: id is not a goal to draft')
        rel, beg = g.get('relevanz') or {}, g.get('begruendung') or {}
        if set(rel) != set(BK_ORDER) or set(beg) != set(BK_ORDER):
            problems.append(f'{tag}: relevanz/begruendung must have exactly the six concepts')
            continue
        for k in BK_ORDER:
            if rel[k] not in (1, 2, 3):
                problems.append(f'{tag}: {k} relevanz {rel[k]!r}')
            text = (beg[k] or '').strip()
            if not text or len(text) > 600:
                problems.append(f'{tag}: {k} begruendung empty or too long')
            if rel[k] == 1 and len(text.split()) > 30:
                problems.append(f'{tag}: {k} rating 1 but a long begruendung')
        # Primary concepts: the ones rated 3. A goal whose top rating is 2 names one or two of those as primary, as Susan's lab's own goals do.
        top = max(rel.values())
        prim = set(g.get('primaer') or [])
        if top == 3:
            ok = prim == {k for k in BK_ORDER if rel[k] == 3} and len(prim) <= 2
        elif top == 2:
            ok = 1 <= len(prim) <= 2 and all(rel.get(k) == 2 for k in prim)
        else:
            ok = not prim
        if not ok:
            problems.append(f'{tag}: primaer {sorted(prim)} does not fit the ratings')
        for k, labels in (g.get('tags') or {}).items():
            if k not in BK_ORDER or rel.get(k, 1) < 2:
                problems.append(f'{tag}: tags for {k} without relevanz 2 or 3')
                continue
            if len(labels) > 3:
                problems.append(f'{tag}: more than 3 tags for {k}')
            for lab in labels:
                if lab not in allowed[k]:
                    problems.append(f'{tag}: tag {lab!r} is not an allowed label of {k}')
        m = g.get('methoden') or []
        names = [x.get('methode') for x in m]
        if len(m) != 3 or len(set(names)) != 3 or any(n not in METHODS for n in names):
            problems.append(f'{tag}: methoden must be three distinct names from the list: {names}')
        for x in m:
            if not (x.get('beschreibung') or '').strip():
                problems.append(f'{tag}: empty method description')
        if not (g.get('kontext') or '').strip():
            problems.append(f'{tag}: empty kontext')
        blob = json.dumps(g, ensure_ascii=False)
        for w in BANNED:
            if w.lower() in blob.lower():
                problems.append(f'{tag}: contains {w!r}')
    for gid in goal_ids - seen:
        problems.append(f'{gid[:8]}: no draft')
    return problems


def tag_ids(elements):
    byid = {e['id']: e for e in elements}
    out = {}
    for e in elements:
        if not e['parent_id']:
            continue
        r = e
        while r['parent_id']:
            r = byid[r['parent_id']]
        out.setdefault((r['label'], e['label']), []).append(e['id'])
    return out


def build_content(g, ids_for_project):
    entries = []
    for k in BK_ORDER:
        labels = (g.get('tags') or {}).get(k, [])
        taxo = []
        for lab in labels:
            found = ids_for_project.get((BK_LABEL[k], lab)) or [None]
            taxo.append({'value': lab, 'taxonomyElementId': found[0]})
        evo = k == 'bk_evolutive_entwicklung'
        entries.append({
            'begruendung': g['begruendung'][k].strip(), 'basiskonzept_id': k, 'relevanz_beurteilung': g['relevanz'][k],
            'relevante_teilkonzepte': [],
            'relevante_unterkonzepte': [] if evo else labels,
            'relevante_evolutionskonzepte': labels if evo else [],
            'relevante_unterkonzepte_taxonomie': [] if evo else taxo,
            'relevante_evolutionskonzepte_taxonomie': taxo if evo else [],
        })
    return {
        'basiskonzeptbezug': entries,
        'basiskonzepte_primaer': [k for k in BK_ORDER if k in g['primaer']],
        'basiskonzepte_sekundaer': [k for k in BK_ORDER if g['relevanz'][k] == 2 and k not in g['primaer']],
        'didaktische_strategien': {
            'top3_methoden': [{'rang': i + 1, 'favorit': False, 'methode': m['methode'], 'beschreibung': m['beschreibung'].strip()} for i, m in enumerate(g['methoden'])],
            'bezug_zum_lehrplan_kontext': g['kontext'].strip(),
            'moegliche_fehlvorstellungen': (g.get('fehlvorstellung') or None),
            'evolutionsdidaktischer_impuls': (g.get('evolutionsimpuls') or None),
        },
        'ki_entwurf': {'stand': '2026-11-01', 'hinweis': 'KI-Entwurf (Claude), fachlich nicht geprüft', 'feedback': '01891c55'},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--drafts', nargs='+', required=True)
    for n in ('live', 'sandbox', 'live-elements', 'sandbox-elements', 'allowed', 'number', 'out'):
        ap.add_argument('--' + n, required=True)
    a = ap.parse_args()

    allowed = json.load(open(a.allowed, encoding='utf-8'))
    drafts = []
    for p in a.drafts:
        drafts += json.load(open(p, encoding='utf-8'))
    live_rows = [r for r in json.load(open(a.live, encoding='utf-8')) if r['grade_band'] == '5/6' and r['status'] == 'accepted' and not content_of(r).get('basiskonzeptbezug')]
    goal_ids = {r['id'] for r in live_rows}
    problems = validate(drafts, allowed, goal_ids)
    if problems:
        print('\n'.join(problems))
        print(f'{len(problems)} problems, nothing written')
        sys.exit(1)

    sb_rows = [r for r in json.load(open(a.sandbox, encoding='utf-8')) if r['grade_band'] == '5/6' and r['status'] == 'accepted' and not content_of(r).get('basiskonzeptbezug')]
    key = lambda r: (norm(content_of(r).get('originaltext') or r['description']), norm(content_of(r).get('unterthema')))
    sb_by_key = {}
    for r in sb_rows:
        sb_by_key.setdefault(key(r), []).append(r['id'])
    if any(len(v) != 1 for v in sb_by_key.values()) or len(sb_by_key) != len(live_rows):
        print('sandbox goals do not match the live goals one to one'); sys.exit(1)
    live_ids = tag_ids(json.load(open(a.live_elements, encoding='utf-8')))
    sb_ids = tag_ids(json.load(open(a.sandbox_elements, encoding='utf-8')))

    by_id = {g['id']: g for g in drafts}
    stmts, unresolved = [], 0
    for label, rows, ids_map, project_sql in (
            ('evomentor-thuringia', live_rows, live_ids, f"project_id = '{LIVE_PROJECT}'"),
            (SANDBOX_SLUG, None, sb_ids, f"project_id = (SELECT id FROM projects WHERE slug = '{SANDBOX_SLUG}')")):
        stmts.append(f'-- ===== {label} =====')
        for r in live_rows:
            g = by_id[r['id']]
            row_id = r['id'] if rows is not None else sb_by_key[key(r)][0]
            c = build_content(g, ids_map)
            unresolved += sum(1 for e in c['basiskonzeptbezug'] for t in e['relevante_unterkonzepte_taxonomie'] + e['relevante_evolutionskonzepte_taxonomie'] if t['taxonomyElementId'] is None)
            j = json.dumps(c, ensure_ascii=False, separators=(',', ':'))
            assert '$j$' not in j
            stmts.append(f"UPDATE lpm_data_objects SET content = content || $j${j}$j$::jsonb, updated_at = now() "
                         f"WHERE id = '{row_id}' AND {project_sql} AND NOT (content ? 'basiskonzeptbezug');")
    n = len(live_rows)
    header = f"""-- {a.number}: AI-drafted Basiskonzept links and didactic strategies for the {n} grade 5/6 goals that have none.
--
-- Susan Hanisch, feedback 01891c55 (2026-11-01): only 45 of the 174 grade 5/6 goals had Basiskonzept ratings and didactic strategies.
-- This gives the other {n} a draft of both, in the live space and in the sandbox copy. The drafts were written by an AI session
-- (Claude) from the exact goal wording, the six Basiskonzepte with their sub-concepts and the 15 methods of the Lernziele filter.
-- NO EXPERT HAS CHECKED THEM. Every drafted goal carries content.ki_entwurf, so a reviewer can find them, correct them or remove the field.
--
-- Only a goal without basiskonzeptbezug is touched, so the 45 existing goals and any later human edit are safe, and running this twice
-- changes nothing. Wording, titles, order and subtopics are not touched. Generated by
-- scripts/generate_grade56_basiskonzept_drafts_migration.py. Each UPDATE names the goal row and the space.
SET search_path = public, extensions;

"""
    footer = f"""
DO $$
DECLARE drafted integer;
BEGIN
  SELECT count(*) INTO drafted FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', '{SANDBOX_SLUG}'))
    AND o.grade_band = '5/6' AND o.status = 'accepted' AND o.content ? 'ki_entwurf' AND o.content -> 'ki_entwurf' ->> 'feedback' = '01891c55';
  IF drafted <> {2 * n} THEN
    RAISE EXCEPTION 'migration {a.number}: expected {2 * n} drafted goals ({n} per space), found %', drafted;
  END IF;
END $$;
"""
    open(a.out, 'w', encoding='utf-8', newline='\n').write(header + '\n'.join(stmts) + '\n' + footer)
    print(f'{n} goals x 2 projects written; tags without an id in the concept tree: {unresolved}')


if __name__ == '__main__':
    main()
