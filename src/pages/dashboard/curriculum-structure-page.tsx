import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ChevronDown, ChevronRight, ExternalLink, Info, ListTree, Search } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  REVIEW_STATUS_LABEL,
  buildTree,
  listNodeGoalCounts,
  listStructureNodes,
  nodeLabel,
  nodeSummary,
  searchMatches,
  type Lang,
  type StructureNode,
  type TreeNode,
} from '@/lib/supabase/curriculum-structure'
import { ACCESS_TIER_LABEL } from '@/lib/supabase/curriculum-repository'

// "Why can't a state's curriculum be browsed?" (Dustin, 2026-11-01). One tree per curriculum document: edition > grade band > topic >
// subtopic or unit, in our own words with German and English labels (migration 216). Every node is an LLM synthesized draft until a person has checked
// it, and says so. Goal counts per project show only for projects the viewer belongs to. Design note:
// lab_manager/docs/design-notes/state-curriculum-overview-browse-check-translate-2026-11-02.md.

const T = {
  de: {
    title: 'Aufbau des Lehrplans',
    intro: 'Wie die Lehrpläne dieses Verzeichnisses aufgebaut sind: Ausgabe, Klassenstufe, Thema, Unterthema. Die Texte sind von uns in eigenen Worten geschrieben.',
    draft: 'LLM-erzeugter Entwurf, Prüfung ausstehend.',
    search: 'Suchen',
    searchHint: 'Wort aus Titel oder Zusammenfassung',
    language: 'Sprache',
    subject: 'Fach',
    allSubjects: 'Alle Fächer',
    empty: 'Für dieses Verzeichnis ist noch kein Aufbau angelegt.',
    emptyMore: 'Der Aufbau wird aus den amtlichen Lehrplänen erstellt und kommt je Land nach und nach dazu.',
    nothing: 'Nichts gefunden.',
    expandAll: 'Alles aufklappen',
    collapseAll: 'Alles zuklappen',
    goals: 'Lernziele',
    pages: 'Seiten im Lehrplan',
    source: 'Quelle',
    record: 'Eintrag im Verzeichnis',
    onlyOther: 'Nur auf Englisch vorhanden',
    parts: 'Teile',
    coverage: 'Enthält die Themen, zu denen EvoMentor Thüringen Lernziele hat. Weitere Themen des Lehrplans fehlen noch.',
    status: 'Stand',
  },
  en: {
    title: 'Curriculum structure',
    intro: 'How the curriculum documents in this repository are organised: edition, grade band, topic, subtopic. The texts are our own words.',
    draft: 'LLM synthesized draft, awaiting review.',
    search: 'Search',
    searchHint: 'A word from a title or summary',
    language: 'Language',
    subject: 'Subject',
    allSubjects: 'All subjects',
    empty: 'No structure has been added for this repository yet.',
    emptyMore: 'The structure is built from the official curriculum documents and is added state by state.',
    nothing: 'Nothing found.',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    goals: 'goals',
    pages: 'Pages in the curriculum',
    source: 'Source',
    record: 'Repository record',
    onlyOther: 'Only available in German',
    parts: 'parts',
    coverage: 'Covers the topics that EvoMentor Thüringen has goals for. Other topics of the curriculum are not in yet.',
    status: 'Status',
  },
} as const

const LEVEL_LABEL: Record<string, { de: string; en: string }> = {
  edition: { de: 'Ausgabe', en: 'Edition' },
  grade_band: { de: 'Klassenstufe', en: 'Grade band' },
  topic: { de: 'Thema', en: 'Topic' },
  subtopic: { de: 'Unterthema', en: 'Subtopic' },
  unit: { de: 'Einheit', en: 'Unit' },
}

const TIER_DE: Record<StructureNode['access_tier'], string> = {
  'full-text-stored': 'Volltext vorhanden',
  'excerpt-only': 'Nur kurze Auszüge',
  'summary-only': 'Nur Zusammenfassung, kein Originalwortlaut',
  'citation-only': 'Nur Quellenangabe',
}

const GERMAN_REPOSITORIES = new Set(['germany', 'saxony', 'saxony-anhalt', 'thuringia'])

function defaultLanguage(slug: string): Lang {
  const short = slug.replace('-curriculum-repository', '')
  return GERMAN_REPOSITORIES.has(short) ? 'de' : 'en'
}

export default function CurriculumStructurePage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [lang, setLang] = useState<Lang>(() => defaultLanguage(project.slug))
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [nodes, setNodes] = useState<StructureNode[] | null>(null)
  const [goalCounts, setGoalCounts] = useState<Awaited<ReturnType<typeof listNodeGoalCounts>>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const t = T[lang]

  // A custom view of a repository holds no nodes of its own and reads its parent's (same rule as the record browser).
  const isCustomView = (project as { project_kind?: string }).project_kind === 'curriculum-repository-custom-view'
  const repoProjectId = isCustomView ? ((project as { parent_project_id?: string | null }).parent_project_id ?? project.id) : project.id

  useEffect(() => {
    let alive = true
    setNodes(null)
    listStructureNodes(supabase, repoProjectId)
      .then(async (rows) => {
        const counts = await listNodeGoalCounts(supabase, rows.filter((n) => n.level !== 'edition' && n.level !== 'grade_band').map((n) => n.id))
        if (!alive) return
        setGoalCounts(counts)
        setNodes(rows)
        // editions open by default; the rest closed
        setOpen(new Set(rows.filter((n) => n.level === 'edition').map((n) => n.id)))
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => { alive = false }
  }, [supabase, repoProjectId])

  const roots = useMemo(() => (nodes ? buildTree(nodes, goalCounts) : []), [nodes, goalCounts])
  const subjects = useMemo(() => Array.from(new Set(roots.map((r) => r.node.subject).filter(Boolean) as string[])).sort(), [roots])
  const shownRoots = roots.filter((r) => !subject || r.node.subject === subject)
  const keep = useMemo(() => searchMatches(shownRoots, search), [shownRoots, search])

  const allIds = useMemo(() => (nodes ?? []).map((n) => n.id), [nodes])
  const toggle = (id: string) => setOpen((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next })

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 className="row"><ListTree size={18} style={{ color: 'var(--text-muted)' }} />{t.title}</h1>
          <p className="muted" style={{ marginBottom: 6, maxWidth: 680 }}>{t.intro}</p>
          <p style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--warn, #b7791f)' }} className="row">
            <Info size={13} />{t.draft}
          </p>
        </div>
        <div className="row" role="group" aria-label={t.language} style={{ gap: 4 }}>
          {(['de', 'en'] as Lang[]).map((l) => (
            <button key={l} className={`btn btn-mini${lang === l ? ' btn-primary' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="card" style={{ color: 'var(--danger, #c53030)' }}>{error}</div>}
      {!nodes && !error && <div className="muted">…</div>}

      {nodes && nodes.length === 0 && (
        <div className="card">
          <strong>{t.empty}</strong>
          <p className="muted" style={{ margin: '6px 0 0' }}>{t.emptyMore}</p>
        </div>
      )}

      {nodes && nodes.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="grid grid-3">
              <div className="field">
                <label>{t.search}</label>
                <div className="row" style={{ gap: 6 }}>
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchHint} />
                </div>
              </div>
              <div className="field">
                <label>{t.subject}</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">{t.allSubjects}</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field row" style={{ alignItems: 'flex-end', gap: 6 }}>
                <button className="btn btn-mini" onClick={() => setOpen(new Set(allIds))}>{t.expandAll}</button>
                <button className="btn btn-mini" onClick={() => setOpen(new Set())}>{t.collapseAll}</button>
              </div>
            </div>
          </div>

          {shownRoots.filter((r) => !keep || keep.has(r.node.id)).length === 0 && <div className="muted">{t.nothing}</div>}
          {shownRoots.filter((r) => !keep || keep.has(r.node.id)).map((r) => (
            <NodeView key={r.node.id} tree={r} lang={lang} t={t} depth={0} open={keep ? new Set(allIds) : open} onToggle={toggle} keep={keep} slug={project.slug} />
          ))}
        </>
      )}
    </div>
  )
}

function NodeView({ tree, lang, t, depth, open, onToggle, keep, slug }: {
  tree: TreeNode
  lang: Lang
  t: (typeof T)[Lang]
  depth: number
  open: Set<string>
  onToggle: (id: string) => void
  keep: Set<string> | null
  slug: string
}) {
  const { node } = tree
  const label = nodeLabel(node, lang)
  const summary = nodeSummary(node, lang)
  const kids = tree.children.filter((c) => !keep || keep.has(c.node.id))
  const isOpen = open.has(node.id)
  const hasKids = kids.length > 0
  const level = LEVEL_LABEL[node.level] ?? { de: node.level, en: node.level }
  const status = REVIEW_STATUS_LABEL[node.review_status] ?? { de: node.review_status, en: node.review_status }
  const facts = (node.facts ?? {}) as Record<string, unknown>
  const hours = typeof facts.hours === 'number' || typeof facts.hours === 'string' ? String(facts.hours) : null
  const unitNumber = typeof facts.unitNumber === 'string' || typeof facts.unitNumber === 'number' ? String(facts.unitNumber) : null
  const coverage = typeof facts.coverage === 'string' && node.level === 'edition' && node.origin.startsWith('evomentor')

  return (
    <div className={depth === 0 ? 'card' : undefined} style={{ marginLeft: depth === 0 ? 0 : 18, marginBottom: depth === 0 ? 12 : 4, borderLeft: depth > 0 ? '2px solid var(--border, #ddd)' : undefined, paddingLeft: depth > 0 ? 10 : undefined }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
        {hasKids ? (
          <button className="btn-linklike" aria-label={isOpen ? 'collapse' : 'expand'} aria-expanded={isOpen} onClick={() => onToggle(node.id)} style={{ marginTop: 2 }}>
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : <span style={{ width: 15 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span className="muted" style={{ fontSize: 11 }}>{level[lang]}</span>
            <strong style={{ fontSize: depth === 0 ? 15 : 13.5 }}>{unitNumber ? `${unitNumber} ` : ''}{label.text}</strong>
            {label.fellBack && <span className="chip" style={{ fontSize: 10 }}>{lang === 'de' ? 'EN' : 'DE'}</span>}
            {hasKids && <span className="muted" style={{ fontSize: 11.5 }}>{tree.descendants} {t.parts}</span>}
            {tree.goals.map((g) => (
              <span key={g.projectId} className="chip" style={{ fontSize: 10.5 }} title={g.projectName}>
                {g.projectName.length > 26 ? g.projectName.slice(0, 25) + '…' : g.projectName}: {g.goals} {t.goals}
              </span>
            ))}
          </div>
          {summary.text && (
            <p style={{ margin: '3px 0 0', fontSize: 13 }}>
              {summary.text}
              {summary.fellBack && <span className="muted" style={{ fontSize: 11 }}> ({t.onlyOther})</span>}
            </p>
          )}
          {coverage && <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>{t.coverage}</p>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 3, fontSize: 11.5 }}>
            {depth === 0 && <span className="chip" style={{ fontSize: 10 }} title={t.status}>{status[lang]}</span>}
            {depth === 0 && <span className="chip" style={{ fontSize: 10 }}>{lang === 'de' ? TIER_DE[node.access_tier] : ACCESS_TIER_LABEL[node.access_tier]}</span>}
            {node.school_type && depth === 0 && <span className="chip" style={{ fontSize: 10 }}>{node.school_type}</span>}
            {hours && <span className="chip" style={{ fontSize: 10 }}>{hours} h</span>}
            {node.source_pages && <span className="muted">{t.pages}: {node.source_pages.replace(/^p\. /, '')}</span>}
            {node.source_url && (
              <a href={node.source_url} target="_blank" rel="noreferrer" className="row" style={{ gap: 3 }}>
                {t.source}<ExternalLink size={11} />
              </a>
            )}
            {node.record_id && <Link to={`/dashboard/${slug}/curriculum-repository/${node.record_id}`}>{t.record}</Link>}
          </div>
        </div>
      </div>
      {hasKids && isOpen && (
        <div style={{ marginTop: 6 }}>
          {kids.map((c) => (
            <NodeView key={c.node.id} tree={c} lang={lang} t={t} depth={depth + 1} open={open} onToggle={onToggle} keep={keep} slug={slug} />
          ))}
        </div>
      )}
    </div>
  )
}
