#!/usr/bin/env node
// Checks every synthetic student's decision file against the sandbox curriculum
// files before anything is written to the database: ids that exist, links the
// page would actually offer (suggested relevance 1 or more), ratings from 1 to
// 4, themes and Basiskonzepte from the real lists. Invalid items are reported;
// with --fix they are dropped from the file (the original is kept as .bak).
//
//   node scripts/jena_semester/validate_decisions.mjs [--fix]

import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { has, SELF } from './lib.mjs'

const cache = path.join(SELF, 'cache')
const lz = new Map()
for (const line of readFileSync(path.join(cache, 'lernziele.jsonl'), 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(line)
  lz.set(r.id, r)
}
const BK = new Set(JSON.parse(readFileSync(path.join(cache, 'basiskonzepte.json'), 'utf8')))
const THEMES = new Set(['Ökologie', 'Botanik/Pflanzen', 'Zoologie/Tiere', 'Mikrobiologie', 'Zellbiologie', 'Genetik', 'Molekularbiologie', 'Evolutionsbiologie', 'Entwicklungsbiologie', 'Verhaltensbiologie', 'Humanbiologie'])
const QUER = new Set(['Sprachbildung', 'Demokratiebildung', 'Medienbildung', 'Kulturelle Bildung', 'Berufliche und arbeitsweltliche Orientierung', 'Bildung für nachhaltige Entwicklung (BNE)', 'Gesundheitserziehung', 'Sexualerziehung'])
const BANDS = new Set(['5/6', '7/8', '9/10'])
const REFL = new Set(['tool_help', 'tool_hindrance', 'own_learning'])

const dir = path.join(cache, 'decisions')
let problems = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const file = path.join(dir, f)
  let d
  try { d = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { console.log(f, 'UNPARSEABLE', e.message); problems++; continue }
  const issues = []
  const keep = (arr, ok, why) => (arr ?? []).filter((x) => { const good = ok(x); if (!good) issues.push(why(x)); return good })

  d.starred_lernziel_ids = keep(d.starred_lernziel_ids, (id) => lz.has(id), (id) => `unknown starred id ${id}`)
  const starred = new Set(d.starred_lernziel_ids)
  d.judgments = keep(
    d.judgments,
    (j) => {
      const r = lz.get(j.lernziel_id)
      const link = r?.links.find((l) => l.basiskonzept_id === j.basiskonzept_id && l.relevance >= 1)
      const okRating = (v) => v == null || (Number.isInteger(v) && v >= 1 && v <= 4)
      return !!link && okRating(j.correctness) && okRating(j.own_knowledge) && okRating(j.didactic_relevance)
    },
    (j) => `judgment not offered by the page or bad rating: ${j.lernziel_id}|${j.basiskonzept_id}`
  )
  // A student rates links of Lernziele they starred; add a missing star rather than lose a judgment.
  for (const j of d.judgments) if (!starred.has(j.lernziel_id)) { d.starred_lernziel_ids.push(j.lernziel_id); starred.add(j.lernziel_id); issues.push(`added missing star for ${j.lernziel_id}`) }
  d.proposals = keep(d.proposals, (p) => lz.has(p.lernziel_id) && BK.has(p.basiskonzept) && String(p.description ?? '').trim(), (p) => `bad proposal ${p.lernziel_id}`)
  d.topic_basiskonzepte = keep(d.topic_basiskonzepte, (b) => BK.has(b.basiskonzept), (b) => `unknown Basiskonzept ${b.basiskonzept}`).slice(0, 3)
  d.cross_cutting = keep(d.cross_cutting, (c) => QUER.has(c.theme), (c) => `unknown theme ${c.theme}`)
  if (d.topic) d.topic.favorite_themes = keep(d.topic.favorite_themes, (t) => THEMES.has(t), (t) => `unknown favorite theme ${t}`)
  if (d.grade_bands) d.grade_bands.bands = keep(d.grade_bands.bands, (b) => BANDS.has(b), (b) => `unknown band ${b}`)
  if (d.reflections) for (const k of Object.keys(d.reflections)) if (!REFL.has(k)) { issues.push(`unknown reflection key ${k}`); delete d.reflections[k] }

  console.log(f.padEnd(10), issues.length ? `${issues.length} issue(s)` : 'ok', issues.slice(0, 4).join(' | '))
  problems += issues.length
  if (issues.length && has('fix')) {
    if (!existsSync(file + '.bak')) copyFileSync(file, file + '.bak')
    writeFileSync(file, JSON.stringify(d, null, 1), 'utf8')
  }
}
console.log(problems ? `${problems} issue(s)${has('fix') ? ' fixed' : ' (run with --fix to drop them)'}` : 'all decision files valid')
