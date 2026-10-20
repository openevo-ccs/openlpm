import { useMemo, useState } from 'react'
import { Check, Copy, Download, FileText } from 'lucide-react'
import { useCurriculumConnectionsData } from './use-curriculum-connections-data'
import { STRINGS } from './curriculum-connections-strings'

// The "Report" / "Bericht" page -- new 2026-10-20, real feedback: "abilities
// to generate reports based on key words." Deterministic and client-side on
// purpose (filters the data already loaded by useCurriculumConnectionsData
// rather than calling out to a model) -- reliable, instant, no extra
// dependency, and the underlying data is already small enough that this
// covers the real need without the added complexity an AI-generated
// narrative would bring. A model-written summary is a reasonable later
// step if a filtered export like this one turns out not to be enough.
function matches(haystack: string | null | undefined, needle: string) {
  return !!haystack && haystack.toLowerCase().includes(needle)
}

export default function CurriculumReportPage() {
  const { project, config, topics, linksByObject, comparativeLinks } = useCurriculumConnectionsData()
  const t = STRINGS[config?.language ?? 'en']
  const [keyword, setKeyword] = useState('')
  const [copied, setCopied] = useState(false)

  const needle = keyword.trim().toLowerCase()

  const matchedTopics = useMemo(() => {
    if (!topics) return []
    if (!needle) return topics
    return topics.filter((tp) => {
      if (matches(tp.title, needle) || matches(tp.description, needle)) return true
      const links = linksByObject[tp.id] ?? []
      return links.some((l) => matches(l.record.title, needle) || matches(l.rationale, needle))
    })
  }, [topics, linksByObject, needle])

  const matchedComparisons = useMemo(() => {
    if (!comparativeLinks) return []
    if (!needle) return comparativeLinks
    return comparativeLinks.filter((l) => matches(l.from_title, needle) || matches(l.to_title, needle) || matches(l.commentary, needle))
  }, [comparativeLinks, needle])

  const reportText = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10)
    const lines: string[] = []
    lines.push(`# ${project.name} — ${t.reportTitle}`)
    lines.push('')
    lines.push(t.reportGeneratedOn(date))
    if (needle) lines.push(`${t.reportKeywordLabel}: "${keyword.trim()}"`)
    lines.push('')
    lines.push(`## ${t.reportSectionTopics(matchedTopics.length)}`)
    for (const tp of matchedTopics) {
      lines.push('')
      lines.push(`### ${tp.title}`)
      if (tp.description) lines.push(tp.description)
      const links = linksByObject[tp.id] ?? []
      for (const l of links) {
        lines.push(`- ${l.record.title}${l.rationale ? ` — ${l.rationale}` : ''}`)
      }
    }
    lines.push('')
    lines.push(`## ${t.reportSectionComparisons(matchedComparisons.length)}`)
    for (const l of matchedComparisons) {
      lines.push('')
      lines.push(`### ${l.from_title} ↔ ${l.to_title}`)
      lines.push(`_${l.relation_type.replace(/_/g, ' ')}_`)
      lines.push('')
      lines.push(l.commentary)
    }
    return lines.join('\n')
  }, [project.name, t, needle, keyword, matchedTopics, matchedComparisons, linksByObject])

  const download = () => {
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.slug}-report${needle ? `-${keyword.trim().replace(/\s+/g, '-')}` : ''}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access can fail silently in some browser contexts; the
      // download button is the reliable fallback.
    }
  }

  if (!config) return <p className="muted">Unknown view configuration.</p>

  return (
    <div>
      <h1 className="row"><FileText size={18} style={{ color: 'var(--text-muted)' }} />{t.reportTitle}</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 680 }}>{t.reportHelp}</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t.reportKeywordLabel}</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t.reportKeywordPlaceholder} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={download}><Download size={13} />{t.reportDownload}</button>
          <button className="btn" onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t.reportCopied : t.reportCopy}
          </button>
        </div>
      </div>

      {needle && matchedTopics.length === 0 && matchedComparisons.length === 0 ? (
        <p className="muted">{t.reportNoMatches}</p>
      ) : (
        <div className="card">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, margin: 0, maxHeight: 520, overflowY: 'auto' }}>
            {reportText}
          </pre>
        </div>
      )}
    </div>
  )
}
