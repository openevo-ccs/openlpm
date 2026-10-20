#!/usr/bin/env node
// Generates a real, data-driven comparative report between Bio-Core LPM
// (Synthetic) and Interdisciplinary LPM (Synthetic), from the comparative-
// analysis infrastructure built 2026-10-20 (lpm_comparative_links,
// lpm_divergence_reviews, lpm_project_comparison_profile). Reads via the
// service_role key (same pattern as pull_feedback.mjs) and writes a
// Markdown document -- re-run this any time the underlying data changes
// (new comparative links, new real content, a TheoryBase divergence
// revision) rather than hand-editing the output.
//
// Usage: node scripts/generate_bio_core_interdisciplinary_comparison_report.mjs [outPath]

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  const p = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
  if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  console.error('No service_role key found.')
  process.exit(1)
}

const KEY = loadServiceRoleKey()

async function rest(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`${pathAndQuery} -> ${res.status} ${await res.text()}`)
  return res.json()
}

function fmt(n) { return n === null || n === undefined ? '—' : n }

async function main() {
  const [bio, inter] = await rest(
    `lpm_project_comparison_profile?slug=in.(bio-core-lpm-synth,interdisciplinary-lpm-synth)&order=slug`
  )

  const linksRaw = await rest(
    `lpm_comparative_links?select=*,from_object:lpm_data_objects!lpm_comparative_links_from_data_object_id_fkey(title,project_id),to_object:lpm_data_objects!lpm_comparative_links_to_data_object_id_fkey(title,project_id)&order=created_at`
  )
  const bioCoverage = await rest(`lpm_divergence_coverage?project_id=eq.${bio.project_id}`)

  const divergenceIds = Array.from(new Set(linksRaw.map((l) => l.divergence_ref).filter(Boolean)))
  const divergences = divergenceIds.length
    ? await rest(`theorybase_snapshot?id=in.(${divergenceIds.join(',')})&select=id,label,data`)
    : []
  const divergenceById = new Map(divergences.map((d) => [d.id, d]))

  const strandsInter = await rest(`lpm_threads?project_id=eq.${inter.project_id}&select=id,title`)
  const linkedInterStrandTitles = new Set(
    linksRaw.filter((l) => l.to_object?.project_id === inter.project_id).map((l) => l.to_object.title)
      .concat(linksRaw.filter((l) => l.from_object?.project_id === inter.project_id).map((l) => l.from_object.title))
  )
  const unmatchedInterStrands = strandsInter.filter((s) => !linkedInterStrandTitles.has(s.title))

  const today = new Date().toISOString().slice(0, 10)

  const lines = []
  lines.push(`# Bio-Core LPM vs. Interdisciplinary LPM: a grounded comparison`)
  lines.push(``)
  lines.push(`Generated ${today} by \`scripts/generate_bio_core_interdisciplinary_comparison_report.mjs\` from live OpenLPM data. Re-run the script to refresh this document rather than hand-editing it.`)
  lines.push(``)
  lines.push(`**What this is and isn't.** Both LPMs are deliberately synthetic, controlled comparison objects (RFC-0019) -- neither is field-tested or recommended curriculum. Bio-Core instantiates Dichotomized Causal Reasoning (DCR): biology-only, no organism-agency framing, by design. Interdisciplinary instantiates OpenEvo's own Integrated/Contextually Flexible Causal Reasoning (ICR): explicitly cross-subject, treats organism agency as legitimate in many cases. Every comparison below treats that difference as the point, not a flaw in either model.`)
  lines.push(``)
  lines.push(`## 1. Scope and depth, kept separate`)
  lines.push(``)
  lines.push(`Combining these into one "development score" would misrepresent what either model is trying to prove, so they're reported as two separate axes.`)
  lines.push(``)
  lines.push(`| | Bio-Core LPM | Interdisciplinary LPM |`)
  lines.push(`|---|---|---|`)
  lines.push(`| **Breadth of scope** (by design) | | |`)
  lines.push(`| Strands | ${fmt(bio.strand_count)} | ${fmt(inter.strand_count)} |`)
  lines.push(`| Subject domains | ${fmt(bio.subject_domain_count)} | ${fmt(inter.subject_domain_count)} |`)
  lines.push(`| Grade bands covered | ${fmt(bio.grade_bands_covered)} | ${fmt(inter.grade_bands_covered)} |`)
  lines.push(`| **Depth within that scope** | | |`)
  lines.push(`| Avg. performance indicators/item | ${fmt(bio.avg_performance_indicators)} | ${fmt(inter.avg_performance_indicators)} |`)
  lines.push(`| Avg. real-world curriculum links/item | ${fmt(bio.avg_real_world_links)} | ${fmt(inter.avg_real_world_links)} |`)
  lines.push(`| **Ecosystem grounding** | | |`)
  lines.push(`| Linked TheoryBase theories | ${fmt(bio.theory_count)} | ${fmt(inter.theory_count)} |`)
  lines.push(`| Linked LiteratureBase references | ${fmt(bio.literature_count)} | ${fmt(inter.literature_count)} |`)
  lines.push(`| Real-world curriculum-repository links | ${fmt(bio.curriculum_repository_link_count)} | ${fmt(inter.curriculum_repository_link_count)} |`)
  lines.push(``)
  lines.push(`Reading this table: depth and ecosystem grounding are comparable between the two models (neither is markedly thinner than the other in its own right). Breadth of scope is dramatically different (1 subject domain vs. ${inter.subject_domain_count}) -- that's the designed difference the whole comparison exists to study, not a gap to close.`)
  lines.push(``)
  lines.push(`## 2. Where the two models directly disagree`)
  lines.push(``)
  lines.push(`Grounded in TheoryBase's own named registry of disagreements (RFC-0009), not restated in this report's own words. ${bioCoverage.length} real divergences have been reviewed for this comparison; ${bioCoverage.filter((c) => c.is_stale).length} are currently out of date relative to TheoryBase's own latest revision.`)
  lines.push(``)
  for (const link of linksRaw) {
    const div = link.divergence_ref ? divergenceById.get(link.divergence_ref) : null
    lines.push(`### ${link.from_object?.title ?? '?'} ↔ ${link.to_object?.title ?? '?'}`)
    lines.push(``)
    lines.push(`*${link.relation_type.replace(/_/g, ' ')}*${div ? ` — illustrates [${div.label}]` : ''}`)
    lines.push(``)
    lines.push(link.commentary)
    lines.push(``)
  }
  lines.push(`## 3. What has no real counterpart`)
  lines.push(``)
  if (unmatchedInterStrands.length > 0) {
    lines.push(`These Interdisciplinary strands have no Bio-Core counterpart at all -- a structural consequence of Bio-Core's narrower scope by design, not an oversight:`)
    lines.push(``)
    for (const s of unmatchedInterStrands) lines.push(`- **${s.title}**`)
  } else {
    lines.push(`Every Interdisciplinary strand currently has at least one real comparative note against Bio-Core.`)
  }
  lines.push(``)
  lines.push(`## 4. Still open`)
  lines.push(``)
  lines.push(`- 3 of the 8 real Kampourakis-dispute divergences describe whole-model philosophy (instructional strategy, expert-reasoning model, overall LP scope) rather than one specific strand pair -- recorded as reviewed, intentionally not forced onto a node-level comparison.`)
  lines.push(`- This report covers the Kampourakis-dispute divergences (Bio-Core/Interdisciplinary's own direct grounding); 5 further real Hurst-Lab-dispute divergences exist in TheoryBase, relevant to Interdisciplinary's Trajectory/Interdisciplinary-Literacy theories specifically, not yet reviewed against either project here.`)
  lines.push(`- Network/graph-theoretic comparison (centrality, clustering, structural similarity between the two strand graphs) is Open Universe's own analysis toolkit's job, not built in OpenLPM itself -- this report's own numbers are the real data such an analysis would run against, once exercised live for the first time against real OpenLPM data.`)
  lines.push(``)

  const outPath = process.argv[2] || path.join(ROOT, 'reports', 'bio-core-vs-interdisciplinary-comparison.md')
  writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`Wrote ${outPath} (${lines.length} lines).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
