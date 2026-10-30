#!/usr/bin/env python3
"""Builds migration 210: the order, the grade label and the spelled-out preparations of the EvoMentor Thuringia Lernziele.

Susan Hanisch, feedback of 2026-10-30:
  * 21d355f9  wrong order inside a subtopic (it was the subtopic "Pilze" in Kl. 9)
  * 5488cd15 / 69fd982f  Kl. 7 and 8 are one band "7/8", with the order of the Lehrplan ("Hormonsystem als Informationssystem" first)
  * bf1cc2c6  grade 5/6 in exactly the order of her CSV
  * d0dcda68  write out Dauerpräparat and Frischpräparat

What the migration changes, for both projects (evomentor-thuringia and evomentor-thuringia-sandbox):
  A  curriculum_sequence of the 174 accepted grade 5/6 rows = row number (0-based) in Susan's CSV.
  B  the 90 accepted Kl. 7 and Kl. 8 rows get grade_band '7/8' and one continuous curriculum_sequence 0..89 in the order
     in which the Lehrplan PDF prints them.
  D  the Kl. 9 and Kl. 10 rows whose order differs from the PDF swap sequence numbers (sequence only).
  C  "DP" and "FP" in Kl. 9 and Kl. 10 goals become "Dauerpräparat" and "Frischpräparat" (title, description, originaltext, kurzbezeichnung).
Nothing is deleted and no status changes.

Inputs
  --csv     Susan's CSV (scripts/data/LP_Thueringen_Gym_5_6_MNT_susan_2026_10_30.csv)
  --order   scripts/data/lernziele-lehrplan-order-2026-10-30.json, made by scripts/read_lehrplan_order.py from the Lehrplan PDF
  --live / --sandbox  dumps made by scripts/dump_lernziele_with_sequence.mjs for each project
Output
  --out     the migration file
  --review  a text report of everything the migration does (input for docs/lernziele-order-2026-10-30.md)

After writing the SQL the script parses it with pglast, replays it on the dumps (both projects together, like one table)
and proves the result. Any failed proof stops the script with an error.
"""
import argparse
import copy
import csv
import json
import re
import sys
import unicodedata
from decimal import Decimal

import pglast
from pglast import ast, enums

MIGRATION_NO = '210'
LIVE_SLUG = 'evomentor-thuringia'
SANDBOX_SLUG = 'evomentor-thuringia-sandbox'
ABBREVIATIONS = {'DP': 'Dauerpräparat', 'FP': 'Frischpräparat'}
TEXT_FIELDS = ('title', 'description', 'originaltext', 'kurzbezeichnung')  # the last two live in content
WORD_CHARS = 'A-Za-zÄÖÜäöüß0-9'
ABBR_RE = re.compile(rf'(?<![{WORD_CHARS}])(DP|FP)(?![{WORD_CHARS}])|Dauerpräp\.|Frischpräp\.')


# ---------------------------------------------------------------- small helpers (same rules as migration 203's generator)

def norm(s):
    return re.sub(r'[^0-9a-zäöüß]', '', unicodedata.normalize('NFC', s).lower())


def clean(s):
    s = unicodedata.normalize('NFC', s).strip()
    s = re.sub(r'(?<=[a-zäöüß])-(?=[a-zäöüß])', '', s)  # closes line-wrap hyphens ("Materia-lien")
    # "Oberflächen- beschaffenheit": hyphen plus space, but not "Denk- und" / "Wild- oder"
    return re.sub(r'(?<=[a-zäöüß])- (?=(?!und\b|oder\b|bzw\b)[a-zäöüß])', '', s)


def sq(s):
    return "'" + s.replace("'", "''") + "'"


def key_of(row):
    """Same key as scripts/read_lehrplan_order.py: the source id, or the goal text for the two rows without one."""
    c = row['content'] or {}
    return c.get('_source_id') or 'text:' + (c.get('originaltext') or row['description'] or row['title'])


def num(v):
    return None if v is None else Decimal(str(v))


def num_sql(v):
    d = num(v)
    return str(int(d)) if d == d.to_integral_value() else format(d, 'f')


# ---------------------------------------------------------------- Part A: the CSV order

def read_csv(path):
    raw = list(csv.reader(open(path, encoding='utf-8-sig', newline='')))[1:]
    out, last = [], None
    for i, r in enumerate(raw):
        th, un, org, tx = r[0].strip(), r[1].strip(), r[2].strip(), r[3]
        inherited = not th
        if inherited:
            th, un, org = last
        else:
            last = (th, un, org)
        if inherited:
            if tx.startswith('die Bedeutung von Ernährung und Atmung'):
                un = 'Ernährung und Atmung'
            elif tx.startswith('die Fortpflanzung und Entwicklung beschreiben'):
                un = 'Fortpflanzung und Entwicklung'
            elif tx.startswith('Modellversuche'):
                un = 'Fachpraktische Arbeiten (Lotuseffekt)'
        out.append(dict(i=i, unter=('' if un == '(none)' else un.strip()), text=clean(tx)))
    return out


def plan_csv_order(csvr, rows, label):
    """curriculum_sequence for every accepted 5/6 row = its CSV row number. Duplicated goal texts are told apart by unterthema."""
    by_key = {}
    for c in csvr:
        by_key.setdefault((norm(c['text']), norm(c['unter'])), []).append(c['i'])
    for k, v in by_key.items():
        if len(v) > 1:
            raise SystemExit(f'CSV rows {v} have the same text and the same subtopic; cannot tell them apart')
    plan = {}
    for r in rows:
        if r['status'] != 'accepted' or r['grade_band'] != '5/6':
            continue
        k = (norm(r['description']), norm((r['content'] or {}).get('unterthema') or ''))
        hit = by_key.get(k)
        if not hit:
            raise SystemExit(f'{label}: accepted 5/6 row {r["id"]} matches no CSV row: {r["description"][:80]!r}')
        if hit[0] in plan.values():
            raise SystemExit(f'{label}: two rows match CSV row {hit[0]}')
        plan[r['id']] = hit[0]
    if sorted(plan.values()) != list(range(len(csvr))):
        raise SystemExit(f'{label}: the accepted 5/6 rows do not cover all {len(csvr)} CSV rows exactly once ({len(plan)} rows)')
    return plan


# ---------------------------------------------------------------- Parts B and D: the Lehrplan order

def plan_band_78(order, rows, label):
    keys = [e['key'] for e in order['bands']['7/8']]
    rows78 = [r for r in rows if r['status'] == 'accepted' and r['grade_band'] in ('7', '8', '7/8')]
    by_key = {key_of(r): r for r in rows78}
    if len(by_key) != len(rows78) or set(by_key) != set(keys) or len(keys) != len(set(keys)):
        raise SystemExit(f'{label}: the Kl. 7/8 rows and the order file do not list the same goals')
    return {by_key[k]['id']: i for i, k in enumerate(keys)}


def plan_band_910(order, rows, label):
    """Per grade: the PDF order gets the sequence numbers the grade's rows already have, so only moved rows change."""
    keys = [e['key'] for e in order['bands']['9/10']]
    rows910 = [r for r in rows if r['status'] == 'accepted' and r['grade_band'] in ('9', '10')]
    by_key = {key_of(r): r for r in rows910}
    if len(by_key) != len(rows910) or set(by_key) != set(keys):
        raise SystemExit(f'{label}: the Kl. 9/10 rows and the order file do not list the same goals')
    changes = {}
    for g in ('9', '10'):
        in_order = [by_key[k] for k in keys if by_key[k]['grade_band'] == g]
        slots = sorted(num(r['curriculum_sequence']) for r in in_order)
        if len(set(slots)) != len(slots) or None in slots:
            raise SystemExit(f'{label}: Kl. {g} has missing or repeated sequence numbers')
        for r, slot in zip(in_order, slots):
            if num(r['curriculum_sequence']) != slot:
                changes[r['id']] = slot
    return changes


# ---------------------------------------------------------------- Part C: spelled-out preparations

def spell_out(text):
    def sub(m):
        if m.group(1):
            return ABBREVIATIONS[m.group(1)]
        return 'Dauerpräparat' if m.group(0).startswith('Dauer') else 'Frischpräparat'
    return ABBR_RE.sub(sub, text)


def field_values(row):
    c = row['content'] or {}
    return {'title': row['title'], 'description': row['description'], 'originaltext': c.get('originaltext'), 'kurzbezeichnung': c.get('kurzbezeichnung')}


def find_abbreviations(rows):
    """Every accepted row outside grade 5/6 (its wording is Susan's CSV, verbatim) with an abbreviation in one of the four text fields: (row, {field: (old, new)})."""
    hits = []
    for r in rows:
        if r['status'] != 'accepted' or r['grade_band'] == '5/6':
            continue
        changed = {}
        for f, v in field_values(r).items():
            if isinstance(v, str) and ABBR_RE.search(v):
                changed[f] = (v, spell_out(v))
        if changed:
            hits.append((r, changed))
    return hits


# ---------------------------------------------------------------- SQL

def project_sql(slug, project_id):
    if slug == LIVE_SLUG:
        return f"'{project_id}'"
    return f"(SELECT id FROM projects WHERE slug = {sq(slug)})"


def values_update(project, sets, grades, plan):
    values = ',\n'.join(f"  ('{rid}', {num_sql(seq)})" for rid, seq in sorted(plan.items(), key=lambda kv: (num(kv[1]), kv[0])))
    grade_list = ', '.join(sq(g) for g in grades)
    return (f"UPDATE lpm_data_objects AS d\nSET {sets}, updated_at = now()\nFROM (VALUES\n{values}\n) AS v(id, seq)\n"
            f"WHERE d.id = v.id::uuid AND d.project_id = {project} AND d.grade_band IN ({grade_list});")


def text_update(project, row, changed):
    sets = []
    for f in ('title', 'description'):
        if f in changed:
            sets.append(f"{f} = {sq(changed[f][1])}")
    content = [f"{sq(f)}, {sq(changed[f][1])}::text" for f in ('originaltext', 'kurzbezeichnung') if f in changed]
    if content:
        sets.append(f"content = content || jsonb_build_object({', '.join(content)})")
    return f"UPDATE lpm_data_objects SET {', '.join(sets)}, updated_at = now() WHERE id = '{row['id']}' AND project_id = {project};"


def self_check_sql(n_csv, n_78):
    """Runs after all updates. If a number is off, the whole migration is rolled back. Skipped on a database without these projects' goals."""
    return f"""DO $$
DECLARE
  p uuid;
  n integer;
BEGIN
  FOR p IN SELECT id FROM projects WHERE slug IN ({sq(LIVE_SLUG)}, {sq(SANDBOX_SLUG)}) LOOP
    SELECT count(*) INTO n FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band IN ('5/6', '7/8', '7', '8');
    IF n = 0 THEN
      CONTINUE;
    END IF;
    IF (SELECT count(*) FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band = '5/6' AND curriculum_sequence >= 0 AND curriculum_sequence < {n_csv}) <> {n_csv}
       OR (SELECT count(DISTINCT curriculum_sequence) FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band = '5/6') <> {n_csv} THEN
      RAISE EXCEPTION '{MIGRATION_NO}: the grade 5/6 goals of project % are not numbered 0 to {n_csv - 1}', p;
    END IF;
    IF (SELECT count(*) FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band = '7/8' AND curriculum_sequence >= 0 AND curriculum_sequence < {n_78}) <> {n_78}
       OR (SELECT count(DISTINCT curriculum_sequence) FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band = '7/8') <> {n_78} THEN
      RAISE EXCEPTION '{MIGRATION_NO}: the grade 7/8 goals of project % are not numbered 0 to {n_78 - 1}', p;
    END IF;
    IF EXISTS (SELECT 1 FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band IN ('7', '8')) THEN
      RAISE EXCEPTION '{MIGRATION_NO}: project % still has goals labelled grade 7 or 8', p;
    END IF;
    IF EXISTS (SELECT 1 FROM lpm_data_objects WHERE project_id = p AND status = 'accepted' AND grade_band <> '5/6'
               AND (title ~ '\\m(DP|FP)\\M' OR description ~ '\\m(DP|FP)\\M' OR content->>'originaltext' ~ '\\m(DP|FP)\\M' OR content->>'kurzbezeichnung' ~ '\\m(DP|FP)\\M')) THEN
      RAISE EXCEPTION '{MIGRATION_NO}: project % still has the abbreviations DP or FP in a goal text', p;
    END IF;
  END LOOP;
END $$;"""


# ---------------------------------------------------------------- replay: run the SQL text on the dumps

class Replay:
    """Applies the UPDATE statements of the migration to a list of rows (both projects together, like the table)."""

    def __init__(self, rows, slug_to_project):
        self.rows = rows
        self.by_id = {r['id']: r for r in rows}
        self.slug_to_project = slug_to_project
        self.touched = {}  # row id -> set of columns changed

    # -- expression helpers
    def const(self, n):
        if isinstance(n, ast.TypeCast):
            return self.const(n.arg)
        if isinstance(n, ast.A_Const):
            v = n.val
            if isinstance(v, ast.String):
                return v.sval
            if isinstance(v, ast.Integer):
                return Decimal(v.ival)
            if isinstance(v, ast.Float):
                return Decimal(v.fval)
        raise SystemExit(f'replay: unsupported constant {n}')

    def project_of(self, n):
        if isinstance(n, ast.SubLink):
            sel = n.subselect
            return self.slug_to_project[self.const(sel.whereClause.rexpr)]
        return self.const(n)

    @staticmethod
    def column(n):
        return n.fields[-1].sval

    def predicates(self, where):
        if isinstance(where, ast.BoolExpr):
            assert where.boolop == enums.BoolExprType.AND_EXPR
            return [p for a in where.args for p in self.predicates(a)]
        return [where]

    def apply(self, stmt):
        rel = stmt.relation.relname
        if rel != 'lpm_data_objects':
            raise SystemExit(f'replay: update of {rel}')
        values = None
        if stmt.fromClause:
            sub = stmt.fromClause[0]
            values = {}
            for tup in sub.subquery.valuesLists:
                rid, seq = self.const(tup[0]), self.const(tup[1])
                if rid in values:
                    raise SystemExit(f'replay: {rid} listed twice in one VALUES list')
                values[rid] = seq
        row_pred, project_ok, grade_in, ids = [], None, None, None
        for p in self.predicates(stmt.whereClause):
            col = self.column(p.lexpr)
            if isinstance(p, ast.A_Expr) and p.kind == enums.A_Expr_Kind.AEXPR_IN:
                grade_in = {self.const(x) for x in p.rexpr}
                assert col == 'grade_band'
            elif col == 'id':
                rx = p.rexpr
                ids = set(values) if isinstance(rx, ast.TypeCast) and isinstance(rx.arg, ast.ColumnRef) else {self.const(rx)}
            elif col == 'project_id':
                project_ok = self.project_of(p.rexpr)
            else:
                raise SystemExit(f'replay: unsupported predicate on {col}')
        if ids is None or project_ok is None:
            raise SystemExit('replay: an UPDATE without row id and project in its WHERE')
        n = 0
        for rid in ids:
            r = self.by_id.get(rid)
            if r is None or r['project_id'] != project_ok:
                continue
            if grade_in is not None and r['grade_band'] not in grade_in:
                continue
            for t in stmt.targetList:
                self.set(r, t.name, t.val, values.get(rid) if values else None)
            n += 1
        return n

    def set(self, r, col, val, seq):
        def mark(c):
            self.touched.setdefault(r['id'], set()).add(c)
        if col == 'updated_at':
            return
        if col == 'curriculum_sequence':
            new = seq if isinstance(val, ast.ColumnRef) else self.const(val)
            if num(r['curriculum_sequence']) != new:
                mark(col)
            r[col] = new
        elif col in ('grade_band', 'title', 'description'):
            new = self.const(val)
            if r[col] != new:
                mark(col)
            r[col] = new
        elif col == 'content':
            assert isinstance(val, ast.A_Expr) and val.name[0].sval == '||' and isinstance(val.rexpr, ast.FuncCall)
            args = val.rexpr.args
            for i in range(0, len(args), 2):
                k, v = self.const(args[i]), self.const(args[i + 1])
                if r['content'].get(k) != v:
                    mark('content.' + k)
                r['content'][k] = v
        else:
            raise SystemExit(f'replay: SET of unexpected column {col}')


def replay_sql(sql, rows, slug_to_project):
    rows = copy.deepcopy(rows)
    rp = Replay(rows, slug_to_project)
    counts = []
    for raw in pglast.parse_sql(sql):
        st = raw.stmt
        if isinstance(st, ast.UpdateStmt):
            counts.append(rp.apply(st))
        elif isinstance(st, (ast.VariableSetStmt, ast.DoStmt)):
            pass
        else:
            raise SystemExit(f'replay: statement of type {type(st).__name__} in the migration')
    return rows, rp.touched, counts


# ---------------------------------------------------------------- the proofs

def prove(csvr, order, before_rows, after_rows, touched, slug_to_project, hits_by_project, out):
    """Raises SystemExit on any failed proof. Appends the results to `out`."""
    project_slug = {v: k for k, v in slug_to_project.items()}
    before = {r['id']: r for r in before_rows}
    csv_order = [(norm(c['text']), norm(c['unter'])) for c in csvr]
    keys78 = [e['key'] for e in order['bands']['7/8']]
    keys910 = [e['key'] for e in order['bands']['9/10']]
    problems = []
    for pid, slug in project_slug.items():
        rows = [r for r in after_rows if r['project_id'] == pid]
        acc = [r for r in rows if r['status'] == 'accepted']
        # A
        r56 = sorted((r for r in acc if r['grade_band'] == '5/6'), key=lambda r: num(r['curriculum_sequence']))
        seqs = [num(r['curriculum_sequence']) for r in r56]
        got = [(norm(r['description']), norm((r['content'] or {}).get('unterthema') or '')) for r in r56]
        ok_a = got == csv_order and seqs == [Decimal(i) for i in range(len(csvr))]
        out.append(f'[{slug}] A  grade 5/6: {len(r56)} accepted rows sorted by curriculum_sequence give the CSV order exactly, '
                   f'no ties, no gaps (0..{len(csvr) - 1}): {"PASS" if ok_a else "FAIL"}')
        if not ok_a:
            problems.append(f'{slug} A')
        # B
        r78 = sorted((r for r in acc if r['grade_band'] == '7/8'), key=lambda r: num(r['curriculum_sequence']))
        left = [r for r in acc if r['grade_band'] in ('7', '8')]
        seqs = [num(r['curriculum_sequence']) for r in r78]
        ok_b = [key_of(r) for r in r78] == keys78 and seqs == [Decimal(i) for i in range(len(keys78))] and not left
        out.append(f'[{slug}] B  grade 7/8: {len(r78)} accepted rows labelled 7/8, sorted by curriculum_sequence they follow the Lehrplan order '
                   f'(0..{len(keys78) - 1}, no ties, no gaps), none left labelled 7 or 8: {"PASS" if ok_b else "FAIL"}')
        if not ok_b:
            problems.append(f'{slug} B')
        # D
        ok_d = True
        for g in ('9', '10'):
            rg = sorted((r for r in acc if r['grade_band'] == g), key=lambda r: num(r['curriculum_sequence']))
            want = [k for k in keys910 if next(x for x in acc if key_of(x) == k)['grade_band'] == g]
            if [key_of(r) for r in rg] != want or len({num(r['curriculum_sequence']) for r in rg}) != len(rg):
                ok_d = False
        out.append(f'[{slug}] D  grade 9 and 10: rows sorted by curriculum_sequence follow the Lehrplan order, no ties: {"PASS" if ok_d else "FAIL"}')
        if not ok_d:
            problems.append(f'{slug} D')
        # C
        left_abbr = [r['id'] for r in acc if r['grade_band'] != '5/6' and any(isinstance(v, str) and ABBR_RE.search(v) for v in field_values(r).values())]
        ok_c = not left_abbr
        out.append(f'[{slug}] C  no accepted goal outside grade 5/6 still has DP, FP, Dauerpräp. or Frischpräp. in title, description, originaltext or kurzbezeichnung: '
                   f'{"PASS" if ok_c else "FAIL"}')
        if not ok_c:
            problems.append(f'{slug} C')
        # side effects
        allowed = {'curriculum_sequence', 'grade_band', 'title', 'description', 'content.originaltext', 'content.kurzbezeichnung'}
        bad = []
        for r in rows:
            b = before[r['id']]
            if r['status'] != b['status'] or r['object_type'] != b['object_type'] or r['project_id'] != b['project_id'] or r.get('branch_id') != b.get('branch_id'):
                bad.append((r['id'], 'status/type/project/branch'))
            diff_content = {k for k in set(r['content']) | set(b['content']) if r['content'].get(k) != b['content'].get(k)}
            if diff_content - {'originaltext', 'kurzbezeichnung'}:
                bad.append((r['id'], sorted(diff_content)))
            if r['grade_band'] != b['grade_band'] and not (b['grade_band'] in ('7', '8') and r['grade_band'] == '7/8'):
                bad.append((r['id'], 'grade_band'))
            if r['grade_band'] == '5/6' and (r['title'], r['description']) != (b['title'], b['description']):
                bad.append((r['id'], '5/6 text changed'))
        if len(rows) != len([x for x in before_rows if x['project_id'] == pid]):
            bad.append(('-', 'row count'))
        if any(c - allowed for c in (touched.get(r['id'], set()) for r in rows)):
            bad.append(('-', 'unexpected column touched'))
        out.append(f'[{slug}] no row deleted, no status, type, project or branch changed, grade 5/6 texts untouched, only the allowed columns changed: '
                   f'{"PASS" if not bad else "FAIL " + str(bad[:3])}')
        if bad:
            problems.append(f'{slug} side effects')
    if problems:
        raise SystemExit('PROOF FAILED: ' + '; '.join(problems) + '\n' + '\n'.join(out))


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    for name in ('csv', 'order', 'live', 'sandbox', 'out'):
        ap.add_argument('--' + name, required=True)
    ap.add_argument('--review')
    args = ap.parse_args()

    csvr = read_csv(args.csv)
    order = json.load(open(args.order, encoding='utf-8'))
    dumps = {LIVE_SLUG: json.load(open(args.live, encoding='utf-8')), SANDBOX_SLUG: json.load(open(args.sandbox, encoding='utf-8'))}
    slug_to_project = {slug: rows[0]['project_id'] for slug, rows in dumps.items()}
    all_rows = [r for rows in dumps.values() for r in rows]

    sections, review = [], []
    touched_rows = {}
    hits_by_project = {}
    for slug, rows in dumps.items():
        project = project_sql(slug, slug_to_project[slug])
        plan_a = plan_csv_order(csvr, rows, slug)
        plan_b = plan_band_78(order, rows, slug)
        plan_d = plan_band_910(order, rows, slug)
        hits = find_abbreviations(rows)
        hits_by_project[slug] = hits
        touched_rows[slug] = set(plan_a) | set(plan_b) | set(plan_d) | {r['id'] for r, _ in hits}

        sections.append(f'-- ===== {slug} =====')
        sections.append(f'-- A: grade 5/6, row number in Susan\'s CSV ({len(plan_a)} rows)')
        sections.append(values_update(project, 'curriculum_sequence = v.seq', ['5/6'], plan_a))
        sections.append(f'-- B: Kl. 7 and Kl. 8 become grade 7/8, one sequence in the order of the Lehrplan ({len(plan_b)} rows)')
        sections.append(values_update(project, "curriculum_sequence = v.seq, grade_band = '7/8'", ['7', '8', '7/8'], plan_b))
        if plan_d:
            sections.append(f'-- D: Kl. 9 and Kl. 10 rows that the Lehrplan prints in another order take the other row\'s sequence number ({len(plan_d)} rows)')
            sections.append(values_update(project, 'curriculum_sequence = v.seq', ['9', '10'], plan_d))
        sections.append(f'-- C: Dauerpräparat and Frischpräparat written out ({len(hits)} rows)')
        for r, changed in hits:
            sections.append(text_update(project, r, changed))
        sections.append('')

    sections.append('-- Self-check. If a count is off, this whole migration is rolled back and nothing changes.')
    sections.append(self_check_sql(len(csvr), len(order['bands']['7/8'])))

    header = f"""-- {MIGRATION_NO}: order, grade label and spelled-out preparations of the EvoMentor Thuringia Lernziele (both copies).
--
-- Susan Hanisch, feedback of 2026-10-30:
--  * bf1cc2c6: the grade 5/6 goals must be in exactly the order of her CSV. Since migration 203 the 5/6 texts are the CSV texts,
--    but 107 of the 174 goals have no sequence number at all and the other 67 carry numbers from the old file (the old order).
--    Every accepted 5/6 goal now gets its row number in the CSV (0 to 173).
--  * 5488cd15 and 69fd982f: Kl. 7 and Kl. 8 are one band 7/8 in the Lehrplan, in one order, and "Hormonsystem als
--    Informationssystem" is the first goal of "Biologie des Menschen". The Lehrplan PDF prints "Klassenstufe 8" over each of the
--    three Lernbereiche and says "bis zum Abschluss der Klassenstufe 8"; it never splits 7 from 8. The earlier split into 7 and 8
--    was our own suggestion (kept in content.empfohlene_klassenstufe). The page sorted by that split first, so the Kl. 7 goals of
--    "Biologie des Menschen" (Verdauung, Atmung, Ausscheidung, Blut) came before the Kl. 8 goals (Hormone, Nerven, Abwehr).
--    The 90 goals now carry grade_band '7/8', exactly like '5/6', and one sequence 0 to 89 in the order the PDF prints them.
--    Only one block moves: the PDF has "Zusammenwirken der Systeme" before "Abwehrsystem". The Lehrplan (page 4) leaves the order of
--    teaching inside a Doppelklassenstufe to the teacher, so this is the order in which the document prints the goals.
--  * 21d355f9: the order inside the Kl. 9 subtopic "Pilze" was wrong (the PDF starts with the Pilzformen, then the Pilzzellen).
--    The same check on Kl. 9 and 10 found one more swap, in "Belege für die Evolution" (Homologien come last). Those goals swap
--    sequence numbers. Nothing else in Kl. 9 and 10 changes. Their grade labels stay '9' and '10' (the PDF has separate chapters
--    for Klassenstufe 9 and Klassenstufe 10).
--  * d0dcda68: "DP" and "FP" in four Kl. 9 and Kl. 10 goals are written out as Dauerpräparat and Frischpräparat, the words the
--    Lehrplan itself uses. Grade 5/6 texts stay as in Susan's CSV.
--
-- Both copies get the same change. No row is deleted and no status changes. Each UPDATE names the row id and the project.
-- The order of the 7/8, 9 and 10 goals was read from the Lehrplan PDF by scripts/read_lehrplan_order.py
-- (result: scripts/data/lernziele-lehrplan-order-2026-10-30.json). Generated by scripts/generate_lernziele_order_migration.py.
-- To undo the label, set grade_band back from content.empfohlene_klassenstufe ('7' or '8').
SET search_path = public, extensions;

"""
    sql = header + '\n'.join(sections) + '\n'
    pglast.parse_sql(sql)  # every statement must parse
    open(args.out, 'w', encoding='utf-8', newline='\n').write(sql)

    # ---- replay and proofs
    proofs = []
    after, touched, counts = replay_sql(sql, all_rows, slug_to_project)
    prove(csvr, order, all_rows, after, touched, slug_to_project, hits_by_project, proofs)
    review.append('== proofs (SQL parsed with pglast, replayed on the live and sandbox dumps) ==')
    review += proofs

    review.append('\n== rows the migration touches, per project ==')
    for slug in dumps:
        rows = [r for r in after if r['project_id'] == slug_to_project[slug]]
        ids = {r['id'] for r in rows}
        t = {rid: cols for rid, cols in touched.items() if rid in ids and cols}
        n_changed = len(t)
        review.append(f'{slug}: {len(touched_rows[slug])} rows named in an UPDATE, {n_changed} of them end up with a different value')
    review.append(f'UPDATE statements: {len(counts)} (rows matched per statement: {counts})')

    review.append('\n== Part C: every hit of DP / FP / Dauerpräp. / Frischpräp. in accepted goals (all grades), before replacement ==')
    for slug, hits in hits_by_project.items():
        for r, changed in hits:
            for f, (old, new) in changed.items():
                review.append(f'[{slug}] Kl. {r["grade_band"]} {key_of(r)} {f}: {old!r} -> {new!r}')
    for slug, rows in dumps.items():
        in56 = [r for r in rows if r['grade_band'] == '5/6' and r['status'] == 'accepted' and any(isinstance(v, str) and ABBR_RE.search(v) for v in field_values(r).values())]
        review.append(f'[{slug}] hits in grade 5/6 text fields: {len(in56)}')

    review.append('\n== Part B: before and after for the topic "Biologie des Menschen" (first 10 goals) ==')
    rows = [r for r in dumps[LIVE_SLUG] if r['status'] == 'accepted' and r['grade_band'] in ('7', '8') and r['content'].get('thema') == 'Biologie des Menschen']
    cur = sorted(rows, key=lambda r: (int(r['grade_band']), num(r['curriculum_sequence'])))
    review.append('before (list sorted "Reihenfolge im Lehrplan": all Kl. 7 first, then Kl. 8):')
    for i, r in enumerate(cur[:10], 1):
        review.append(f'  {i}. Kl. {r["grade_band"]} {key_of(r)}  {r["title"]}')
    by_key = {key_of(r): r for r in rows}
    review.append('after (order of the Lehrplan):')
    for i, k in enumerate([e['key'] for e in order['bands']['7/8'] if e['key'] in by_key][:10], 1):
        review.append(f'  {i}. {k}  {by_key[k]["title"]}')

    review.append('\n== Part D: Kl. 9 and Kl. 10 rows whose sequence number changes ==')
    for slug, rows in dumps.items():
        plan_d = plan_band_910(order, rows, slug)
        by_id = {r['id']: r for r in rows}
        for rid, seq in sorted(plan_d.items(), key=lambda kv: num(kv[1])):
            r = by_id[rid]
            review.append(f'[{slug}] Kl. {r["grade_band"]} {key_of(r)}: {num_sql(r["curriculum_sequence"])} -> {num_sql(seq)}  {r["title"]}')

    text = '\n'.join(review)
    if args.review:
        open(args.review, 'w', encoding='utf-8').write(text)
    print(text)


if __name__ == '__main__':
    sys.exit(main())
