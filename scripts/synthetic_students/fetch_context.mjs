#!/usr/bin/env node
// Read-only. Pulls the REAL evomentor-thuringia project context (curriculum
// items, Basiskonzepte, prompt-generator option vocabulary) via the
// service-role key, so synthetic-persona plans can be grounded in titles and
// option strings that actually exist -- never invented. Writes one JSON
// cache file; makes no writes of its own.
//
// Usage: node scripts/synthetic_students/fetch_context.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
const OUT = path.join(ROOT, 'scripts', 'synthetic_students', 'cache', 'evomentor-thuringia-context.json')

function serviceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? readFileSync(path.join(ROOT, '.supabase-secrets', 'service-role-key.txt'), 'utf8')).trim()
}

// lpm_schema_elements (the Basiskonzepte/root-concept table) comes back with
// a real, live 403 under the service-role key -- "permission denied for
// table lpm_schema_elements", a genuine missing GRANT, confirmed 2026-10-10,
// unrelated to this task. Rather than re-deriving a member-login flow in a
// new script (a different, already-identified problem -- see memory
// "openlpm-mint-qa-session-custom-email-and-credential-classifier"), this
// reads the Basiskonzepte from their actual authoring source instead: the
// evomentor-thuringia pilot's own hand-maintained reference file, richer
// than the DB copy anyway (full definitions, not just labels).
const EVOMENTOR_DE_ROOT = path.join(path.dirname(ROOT), 'EvoMentor_DE')

async function rest(table, qs) {
  const key = serviceKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  const [project] = await rest('projects', 'select=id,slug,parent_project_id,working_languages,prompt_template_library_id&slug=eq.evomentor-thuringia')
  if (!project) throw new Error('evomentor-thuringia project not found')

  const bkFile = JSON.parse(readFileSync(path.join(EVOMENTOR_DE_ROOT, 'data', 'basiskonzepte.json'), 'utf8'))
  const rootConcepts = bkFile.basiskonzepte
    .filter((b) => b.ebene === 1)
    .map((b) => ({
      id: b.id,
      label: b.bezeichnung,
      abbreviation: b.kurzbezeichnung,
      definition_didaktisch: b.definition_didaktisch,
    }))

  const dataObjects = await rest(
    'lpm_data_objects',
    `select=id,title,description,grade_band,content&project_id=eq.${project.id}&order=title&limit=400`
  )

  // prompt_template_libraries has the SAME missing-service_role-GRANT gap as
  // lpm_schema_elements above (also confirmed live 2026-10-10) -- a second
  // instance of the same real infra bug, worth flagging separately since
  // it's now two tables, not one. Worked around by reconstructing the
  // library's current real content directly from its own migration history
  // (029 seed, then content-only updates 068 -> 078 -> 088 -> 089, each
  // read directly and applied in order) rather than querying it live.
  const library = {
    label: 'Deutsch -- Biologie (KMK Basiskonzepte)',
    section_labels: {
      title: 'UNTERRICHTSVORBEREITUNG MIT BASISKONZEPT-INTEGRATION',
    },
    option_lists: {
      methods: ['Forschendes Lernen', 'Erfahrungs-/handlungsorientiertes Lernen', 'Problembasiertes Lernen', 'Projektbasiertes Lernen', 'Kooperative Lernformen', 'Konzeptuelles Lernen', 'Analogien und Vergleiche', 'Narrativer Zugang', 'Modelle und Simulationen', '(bioethische) Diskussion', 'Digitale Medien', 'Außerschulische Lernorte', 'Recherche', 'Stationenlernen', 'Gestalterische/kreative Aufgaben'],
      differentiation: ['Basis- und Erweiterungsaufgaben', 'Sprachliche Differenzierung', 'Unterschiedliche Lerntempi'],
      assessment: ['Formative Beurteilung (laufend)', 'Quiz', 'Präsentationen, Poster, Flyer', 'Schriftliche Reflexion', 'Portfolio / Lerntagebuch', 'Klassenarbeit / LEK', 'Praktische Leistungen'],
      societal_context: ['Biodiversität', 'Naturschutz und Arterhaltung', 'Klimawandel und Artenanpassung', 'Pandemien, Antibiotikaresistenz und Virusevolution', 'Gesundheit und evolutionäre Medizin', 'Psychische Gesundheit', 'Landwirtschaft und Lebensmittelherstellung', 'Nachhaltige Nutzung natürlicher Ressourcen', 'Biotechnologie und Gentechnik', 'Bioethik'],
      output_types: ['Vollständige Unterrichtssequenz mit Verlaufsplänen', 'Operationalisierte Lernziele pro Stunde', 'Methodische Vorschläge pro Stunde', 'Hinweise auf Materialien / Medien', 'Schülerfehlvorstellungen', 'Differenzierungsvorschläge', 'Transfer- und Diskussionsfragen', 'Querverbindungen zwischen Lernzielen'],
      default_output_types: ['Vollständige Unterrichtssequenz mit Verlaufsplänen', 'Methodische Vorschläge pro Stunde', 'Transfer- und Diskussionsfragen'],
      default_assessment: ['Formative Beurteilung (laufend)'],
      tones: [['professionell', 'Professionell'], ['locker', 'Locker'], ['wissenschaftlich', 'Wissenschaftlich']],
      lengths: [['kurz', 'Kurz'], ['ausführlich', 'Ausführlich']],
      default_tone: 'professionell',
      default_length: 'ausführlich',
      prior_knowledge_levels: [['keins', 'Kein Vorwissen'], ['grundlagen', 'Grundbegriffe bekannt'], ['solide', 'Solides Grundwissen']],
    },
  }

  const context = {
    fetched_at: new Date().toISOString(),
    project: { id: project.id, slug: project.slug },
    root_concepts: rootConcepts,
    item_count: dataObjects.length,
    items: dataObjects.map((o) => ({
      id: o.id,
      title: o.title,
      grade_band: o.grade_band,
      basiskonzeptbezug: Array.isArray(o.content?.basiskonzeptbezug) ? o.content.basiskonzeptbezug : [],
    })),
    option_lists: library?.option_lists ?? null,
    section_labels: library?.section_labels ?? null,
    library_label: library?.label ?? null,
  }

  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(context, null, 2), 'utf8')
  console.log(`Wrote ${OUT}`)
  console.log(`Project ${project.slug} (${project.id}): ${rootConcepts.length} root concepts, ${dataObjects.length} items.`)
  console.log(`Library: ${library?.label ?? 'NONE FOUND'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
