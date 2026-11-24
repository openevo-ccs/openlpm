#!/usr/bin/env node
// Runs migrations 256 and 257 in an in-memory Postgres (pglite, WebAssembly) with small stand-ins for the parts of OpenLPM they rely on (users, projects,
// the access functions, auth.uid), then exercises the edit log of a theories-of-schooling space: placements and marks land in the profile and in
// tos_elements, the name and time come from the database, the shape rules refuse bad rows, tos_reapply_edits restores decisions on a replaced profile,
// and one edit in a profile of 1,700 statements stays fast. Row level security is not tested here, only the logic.
//
//   npm i --no-save @electric-sql/pglite@0.2.17     (once; it is not a dependency of the app)
//   node scripts/test_tos_edits_sql.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
let PGlite
try { ({ PGlite } = await import('@electric-sql/pglite')) } catch { console.error('This test needs pglite: npm i --no-save @electric-sql/pglite@0.2.17'); process.exit(2) }
const MIG = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'supabase', 'migrations') + path.sep
const db = new PGlite()
let fails = 0
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra !== '' ? ' ' + extra : '')); if (!ok) fails++ }

await db.exec(`
  CREATE SCHEMA IF NOT EXISTS extensions; CREATE SCHEMA IF NOT EXISTS auth;
  CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$ LANGUAGE sql;
  CREATE FUNCTION auth.role() RETURNS text AS $$ SELECT coalesce(nullif(current_setting('test.role', true), ''), 'authenticated') $$ LANGUAGE sql;
  CREATE TABLE users (id uuid PRIMARY KEY, email text, name text NOT NULL);
  CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, project_kind text DEFAULT 'standard');
  CREATE TABLE user_privacy_settings (user_id uuid, ai_processing_opt_out boolean DEFAULT false);
  CREATE FUNCTION is_project_member(p uuid) RETURNS boolean AS $$ SELECT true $$ LANGUAGE sql;
  CREATE FUNCTION is_project_editor(p uuid) RETURNS boolean AS $$ SELECT coalesce(current_setting('test.editor', true), 'on') = 'on' $$ LANGUAGE sql;
`)
// the real migrations
for (const f of ['256_theories_of_schooling_space.sql', '257_theories_of_schooling_edits.sql', '258_theories_of_schooling_edits_reapply_fix.sql']) {
  try { await db.exec(fs.readFileSync(MIG + f, 'utf8')); check('migration ' + f + ' runs', true) } catch (e) { check('migration ' + f + ' runs', false, String(e.message).slice(0, 400)); console.log(e); process.exit(1) }
}
// Supabase refuses an UPDATE or DELETE without a WHERE clause (pg_safeupdate). This in-memory database does not, so the migration is read for it. Migration 257 has one
// such DELETE (found by the first live test and applied that way, so it cannot be edited); migration 258 replaces that function. New migrations are read from 258 on.
for (const f of ['258_theories_of_schooling_edits_reapply_fix.sql']) {
  const text = fs.readFileSync(MIG + f, 'utf8').replace(/--[^\n]*/g, '')
  const bare = text.split(';').filter((st) => /(^|\n)\s*(UPDATE\s+\w+(\s+\w+)?\s+SET|DELETE\s+FROM)/i.test(st) && !/\bWHERE\b/i.test(st))
  check(f + ': every UPDATE and DELETE has a WHERE clause', bare.length === 0, bare.map((b) => b.trim().slice(0, 60)).join(' | '))
}
// running 257 twice must be harmless
try { await db.exec(fs.readFileSync(MIG + '257_theories_of_schooling_edits.sql', 'utf8')); check('migration 257 can run twice', true) } catch (e) { check('migration 257 can run twice', false, String(e.message).slice(0, 300)) }

const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222'
const P = '33333333-3333-3333-3333-333333333333'
await db.exec(`INSERT INTO users VALUES ('${U1}', 'd@x.org', 'Dustin Eirdosh'), ('${U2}', 's@x.org', 'Susan Hanisch'); INSERT INTO projects (id, project_kind) VALUES ('${P}', 'theory-of-schooling');`)
const machine = () => ({
  schema: 'openevo-schooling-theory-profile/1', id: 'OE-SCHOOLINGPROFILE-test-space', title: 'Test', holder: { kind: 'group', label: 'T' }, model: 'm', visibility: 'lab-only', license: 'private', version: '0.3.0',
  provenance: { extractedBy: 'llm', reviewStatus: 'ai-draft' },
  elements: ['e1', 'e2', 'e3', 'e4'].map((id, i) => ({ id, type: 'proposition', statement: 'Statement ' + id, placement: { super: i === 2 ? [] : [{ id: 'self', strength: 'firm' }], sub: [{ id: 'optimal', strength: i === 1 ? 'single' : 'firm' }] } })),
})
async function load(profile) {
  const r = await db.query(`INSERT INTO tos_profiles (project_id, profile_id, title, holder_kind, visibility, version, license, review_status, data, created_by) VALUES ($1, $2, 'Test', 'group', 'lab-only', '0.3.0', 'private', 'ai-draft', $3::jsonb, $4) ON CONFLICT (project_id, profile_id) DO UPDATE SET data = EXCLUDED.data RETURNING id`, [P, profile.id, JSON.stringify(profile), U1])
  const id = r.rows[0].id
  await db.query('DELETE FROM tos_elements WHERE profile_row_id = $1', [id])
  for (const e of profile.elements) await db.query(`INSERT INTO tos_elements (project_id, profile_row_id, element_id, type, statement, supers, subs, review_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [P, id, e.id, e.type, e.statement, (e.placement.super || []).map((x) => x.id), (e.placement.sub || []).map((x) => x.id), e.review?.status ?? null])
  return id
}
const rowId = await load(machine())
const el = async (id) => (await db.query(`SELECT e.elem FROM tos_profiles p, jsonb_array_elements(p.data->'elements') e(elem) WHERE p.id=$1 AND e.elem->>'id'=$2`, [rowId, id])).rows[0].elem
const flat = async (id) => (await db.query(`SELECT supers, subs, review_status FROM tos_elements WHERE profile_row_id=$1 AND element_id=$2`, [rowId, id])).rows[0]
const as = async (uid, role = 'authenticated') => { await db.exec(`SELECT set_config('test.uid', '${uid ?? ''}', false); SELECT set_config('test.role', '${role}', false);`) }
const ins = (el_, field, before, after, note = null, by = U1) => db.query(`INSERT INTO tos_element_edits (project_id, profile_code, element_id, field_path, before_value, after_value, note, edited_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)`,
  [P, 'OE-SCHOOLINGPROFILE-test-space', el_, field, before === undefined ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), note, by])

await as(U1)
// 1. a placement edit and a review edit
await ins('e2', 'placement', { super: [{ id: 'society', strength: 'single' }], sub: [] }, { super: [{ id: 'society', strength: 'firm' }, { id: 'cultural-evolution', strength: 'firm' }], sub: [{ id: 'optimal', strength: 'firm' }] })
await ins('e2', 'review', null, { status: 'checked', note: 'looks right' }, 'looks right')
let e2 = await el('e2'), f2 = await flat('e2')
check('placement lands in the profile data', JSON.stringify(e2.placement.super.map((x) => x.id)) === '["society","cultural-evolution"]' && e2.placement.super.every((x) => x.strength === 'firm'), JSON.stringify(e2.placement))
check('the review mark carries the name from the database and ignores the value the browser sends', e2.review?.status === 'checked' && e2.review.by === 'Dustin Eirdosh' && /^20/.test(e2.review.at) && e2.review.note === 'looks right', JSON.stringify(e2.review))
check('tos_elements follows: supers, subs and review_status', JSON.stringify(f2.supers.sort()) === '["cultural-evolution","society"]' && JSON.stringify(f2.subs) === '["optimal"]' && f2.review_status === 'checked', JSON.stringify(f2))
const order = (await db.query(`SELECT jsonb_path_query_array(data, '$.elements[*].id') AS ids FROM tos_profiles WHERE id=$1`, [rowId])).rows[0].ids
check('the order of the statements is kept', JSON.stringify(order) === '["e1","e2","e3","e4"]', JSON.stringify(order))
const norm = (o) => JSON.stringify(o, Object.keys(o).sort ? undefined : undefined)
check('other statements are untouched', (await el('e1')).placement.super[0].id === 'self' && (await el('e1')).placement.sub[0].strength === 'firm' && !(await el('e1')).review)
// 2. an editor's tampering with name and time inside the value is overwritten
await as(U2)
await ins('e3', 'review', null, { status: 'unsure', by: 'Someone Else', at: '1999-01-01T00:00:00Z' }, null, U2)
const e3 = await el('e3')
check('a name or time sent inside the mark is replaced by the database values', e3.review.by === 'Susan Hanisch' && e3.review.at.startsWith('20') && !e3.review.at.startsWith('1999'), JSON.stringify(e3.review))
// 3. taking a mark away
await as(U1)
await ins('e3', 'review', { status: 'unsure' }, null)
check('a NULL review removes the mark', (await el('e3')).review === undefined && (await flat('e3')).review_status === null)
// 4. leave one out, then the progress counts
await ins('e4', 'review', null, { status: 'excluded' })
const prog = (await db.query('SELECT * FROM tos_review_progress($1)', [P])).rows[0]
check('progress counts statements, checked and left out', Number(prog.total) === 3 && Number(prog.checked) === 1 && Number(prog.excluded) === 1 && Number(prog.unsure) === 0, JSON.stringify(prog))
// 5. the log keeps everything, including the order of the changes
const log = (await db.query(`SELECT element_id, field_path FROM tos_element_edits ORDER BY edited_at, id`)).rows
check('every change is in the log', log.length === 5, String(log.length))
// 6. the shape rules
for (const [name, field, val] of [['a review with no status', 'review', {}], ['a review with a wrong status', 'review', { status: 'maybe' }], ['a placement without lists', 'placement', { super: [] }], ['a placement that is not an object', 'placement', 'x']]) {
  let rejected = false; try { await ins('e1', field, null, val) } catch { rejected = true }
  check(name + ' is refused', rejected)
}
let badField = false; try { await db.query(`INSERT INTO tos_element_edits (project_id, profile_code, element_id, field_path, after_value) VALUES ($1,'OE-SCHOOLINGPROFILE-test-space','e1','statement','{}'::jsonb)`, [P]) } catch { badField = true }
check('a change to any other field is refused', badField)
// 7. a profile that is replaced by a new machine sort keeps the human decisions after tos_reapply_edits
await load(machine())
check('replacing the profile first loses the decisions (that is why the call exists)', !(await el('e2')).review && (await flat('e2')).review_status === null)
const n = (await db.query('SELECT tos_reapply_edits($1, $2) AS n', [P, 'OE-SCHOOLINGPROFILE-test-space'])).rows[0].n
e2 = await el('e2'); f2 = await flat('e2')
check('tos_reapply_edits restores placement and review', n === 3 && e2.placement.super.length === 2 && e2.review?.status === 'checked' && e2.review.by === 'Dustin Eirdosh' && JSON.stringify(f2.supers.sort()) === '["cultural-evolution","society"]' && f2.review_status === 'checked', 'touched ' + n + ' ' + JSON.stringify(e2.review))
check('a mark that was taken away stays away after tos_reapply_edits', (await el('e3')).review === undefined && (await flat('e3')).review_status === null)
check('a left-out statement is still left out after tos_reapply_edits', (await el('e4')).review?.status === 'excluded' && (await flat('e4')).review_status === 'excluded')
// 8. an incoming profile with its own marks keeps them where nobody edited
const withMark = machine(); withMark.elements[0].review = { status: 'checked', by: 'Imported', at: '2026-01-01T00:00:00Z' }
await load(withMark); await db.query('SELECT tos_reapply_edits($1, $2)', [P, 'OE-SCHOOLINGPROFILE-test-space'])
check('a mark that came with the new profile survives where nobody edited', (await el('e1')).review?.by === 'Imported' && (await flat('e1')).review_status === 'checked')
// 9. who may call tos_reapply_edits
await db.exec(`SELECT set_config('test.editor', 'off', false);`)
let denied = false; try { await db.query('SELECT tos_reapply_edits($1, $2)', [P, 'OE-SCHOOLINGPROFILE-test-space']) } catch { denied = true }
check('a non-editor cannot call tos_reapply_edits', denied)
await as(null, 'service_role')
let okService = true; try { await db.query('SELECT tos_reapply_edits($1, $2)', [P, 'OE-SCHOOLINGPROFILE-test-space']) } catch { okService = false }
check('the service role can', okService)
// 10. an edit for a profile that no longer exists stays in the log and breaks nothing
await db.exec(`SELECT set_config('test.editor', 'on', false);`); await as(U1)
await db.query(`INSERT INTO tos_element_edits (project_id, profile_code, element_id, field_path, after_value, edited_by) VALUES ($1,'OE-SCHOOLINGPROFILE-gone','x','review','{"status":"checked"}'::jsonb,$2)`, [P, U1])
check('an edit for a profile that is gone is only logged', true)
// 11. a profile of 1,700 statements: one edit stays fast
const big = machine(); big.id = 'OE-SCHOOLINGPROFILE-big'; big.elements = Array.from({ length: 1700 }, (_, i) => ({ id: 'b' + i, type: 'proposition', statement: 'S ' + i + ' ' + 'word '.repeat(40), placement: { super: [{ id: 'self', strength: 'firm' }], sub: [{ id: 'optimal', strength: 'firm' }] } }))
const bigRow = (await db.query(`INSERT INTO tos_profiles (project_id, profile_id, title, holder_kind, visibility, version, license, review_status, data, created_by) VALUES ($1,$2,'Big','group','lab-only','0.3.0','private','ai-draft',$3::jsonb,$4) RETURNING id`, [P, big.id, JSON.stringify(big), U1])).rows[0].id
for (const e of big.elements) await db.query(`INSERT INTO tos_elements (project_id, profile_row_id, element_id, type, statement, supers, subs) VALUES ($1,$2,$3,'proposition',$4,'{self}','{optimal}')`, [P, bigRow, e.id, e.statement])
const t0 = Date.now()
await db.query(`INSERT INTO tos_element_edits (project_id, profile_code, element_id, field_path, after_value, edited_by) VALUES ($1,$2,'b900','review','{"status":"checked"}'::jsonb,$3)`, [P, big.id, U1])
const ms = Date.now() - t0
check('one edit in a profile of 1,700 statements takes well under a second', ms < 1500, ms + ' ms (in-memory Postgres in WebAssembly, slower than the real server)')
console.log(fails ? `\n${fails} checks failed` : '\nall checks passed')
process.exit(fails ? 1 : 0)
