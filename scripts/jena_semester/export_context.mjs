#!/usr/bin/env node
// Writes the sandbox space's curriculum as plain files the synthetic students
// (AI agents) search and read, the way a real student scrolls and searches the
// Lernziele page. One line per Lernziel in lernziele.jsonl so `grep` works.
//
//   node scripts/jena_semester/export_context.mjs
//
// Output: scripts/jena_semester/cache/lernziele.jsonl, basiskonzepte.json

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getProjectId, rest, SANDBOX_SLUG, SELF } from './lib.mjs'

const norm = (s) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '')

function labelFor(id, roots) {
  const direct = roots.find((r) => r.id === id)
  if (direct) return direct.label
  const tokens = id.replace(/^bk_/, '').split('_').filter(Boolean)
  return roots.find((r) => tokens.every((t) => norm(r.label).includes(t)))?.label ?? id
}

const projectId = await getProjectId(SANDBOX_SLUG)
const roots = await rest('GET', 'lpm_schema_elements', { qs: `select=id,label&project_id=eq.${projectId}&parent_id=is.null` })
const rows = await rest('GET', 'lpm_data_objects', {
  qs: `select=id,title,description,grade_band,content&project_id=eq.${projectId}&status=eq.accepted&limit=2000`,
})

const out = path.join(SELF, 'cache')
mkdirSync(out, { recursive: true })

const lines = rows.map((r) => {
  const c = r.content ?? {}
  const links = (c.basiskonzeptbezug ?? []).map((e) => ({
    basiskonzept_id: e.basiskonzept_id,
    basiskonzept: labelFor(e.basiskonzept_id, roots),
    relevance: e.relevanz_beurteilung,
    begruendung: e.begruendung,
  }))
  return JSON.stringify({
    id: r.id,
    grade_band: r.grade_band,
    thema: c.thema ?? null,
    unterthema: c.unterthema ?? null,
    title: r.title,
    description: r.description,
    links,
  })
})
writeFileSync(path.join(out, 'lernziele.jsonl'), lines.join('\n') + '\n', 'utf8')
writeFileSync(path.join(out, 'basiskonzepte.json'), JSON.stringify(roots.map((r) => r.label), null, 2), 'utf8')
console.log(`wrote ${lines.length} Lernziele and ${roots.length} Basiskonzepte to ${out}`)
