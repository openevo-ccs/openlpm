import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Check, Info, Sparkle, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import { listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import { getLibraryForProject, resolveOptionLists } from '@/lib/supabase/prompt-libraries'
import { listMethodsBaseByVocabulary, listMethodLernzielLinks, reviewMethodLernzielLink, type MethodsBaseRecord, type MethodLernzielLink } from '@/lib/supabase/methodsbase'
import { METHOD_ICON } from './student/student-lernziele-page'

// Dustin's 2026-10-10 ask -- EvoMentor Thuringia's didactic methods weren't
// "linked well to the Lernziele," so advance the whole chain from a real
// MethodsBase description through to a researcher view that can show, and
// help build, those links. Originally built as a tab inside Learning Goals
// (the sidebar's nav was a locked 10-item spec at the time); moved to its
// own top-level page 2026-10-11 once Dustin decided Methods and Learning
// Goals are distinct enough to deserve separate sidebar entries, now that
// Dashboard Custom Views let a project narrow its own sidebar down to just
// what it needs.
//
// Reads methodsbase_snapshot/method_vocabulary_links/method_lernziel_links
// (migrations 121-123). A link only ever shows as applying to a Lernziel
// once it's 'confirmed' -- either backfilled from real existing content,
// or an AI suggestion (scripts/suggest_method_lernziel_links.mjs) a
// project member has actually reviewed here. Nothing here auto-promotes a
// suggestion; that would repeat exactly the mistake migrations 078/079/089
// deliberately avoided (guessing at Susan's own subject-matter judgment).
export default function MethodsPage() {
  const { project, defaultBranchId, supabase } = useOutletContext<ProjectOutletContext>()

  const [methodOptions, setMethodOptions] = useState<string[]>([])
  const [methodsBaseByKey, setMethodsBaseByKey] = useState<Map<string, MethodsBaseRecord>>(new Map())
  const [links, setLinks] = useState<MethodLernzielLink[]>([])
  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null)

  useEffect(() => {
    getLibraryForProject(supabase, project).then((lib) => setMethodOptions(lib ? resolveOptionLists(lib.option_lists).methods : []))
    listMethodsBaseByVocabulary(supabase).then(setMethodsBaseByKey)
    listMethodLernzielLinks(supabase, project.id).then(setLinks)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [supabase, project.id, defaultBranchId])

  const topicById = useMemo(() => {
    const m = new Map<string, TopicListItem>()
    for (const t of topics ?? []) m.set(t.id, t)
    return m
  }, [topics])

  const linksByMethod = useMemo(() => {
    const m = new Map<string, MethodLernzielLink[]>()
    for (const l of links) {
      const arr = m.get(l.method_key) ?? []
      arr.push(l)
      m.set(l.method_key, arr)
    }
    return m
  }, [links])

  useEffect(() => {
    if (!selected && methodOptions.length > 0) setSelected(methodOptions[0])
  }, [methodOptions, selected])

  async function decide(linkId: string, decision: 'confirmed' | 'rejected') {
    if (!userId) return
    setBusyLinkId(linkId)
    await reviewMethodLernzielLink(supabase, linkId, decision, userId)
    setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, status: decision, reviewed_by: userId, reviewed_at: new Date().toISOString() } : l)))
    setBusyLinkId(null)
  }

  return (
    <div>
      <h1>Methods</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Didactic methods in this project's vocabulary, their real descriptions, and which learning
        goals each one applies to.
      </p>

      {methodOptions.length === 0 ? (
        <p className="muted">This project's prompt library has no didactic-method vocabulary set, so there's nothing to show here yet.</p>
      ) : (
        <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 240, flexShrink: 0 }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              {methodOptions.length} didactic methods in this project's vocabulary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {methodOptions.map((m) => {
                const confirmedCount = (linksByMethod.get(m) ?? []).filter((l) => l.status === 'confirmed').length
                const suggestedCount = (linksByMethod.get(m) ?? []).filter((l) => l.status === 'suggested').length
                return (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-mini${selected === m ? ' btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    onClick={() => setSelected(m)}
                  >
                    <span aria-hidden="true">{METHOD_ICON[m] ?? '•'}</span>
                    <span style={{ flex: 1 }}>{m}</span>
                    {!methodsBaseByKey.get(m) && <Info size={12} style={{ color: 'var(--text-muted)' }} />}
                    <span className="muted" style={{ fontSize: 11 }}>{confirmedCount}</span>
                    {suggestedCount > 0 && <span className="badge" style={{ fontSize: 10 }}>{suggestedCount} new</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {(() => {
            const selectedLinks = selected ? linksByMethod.get(selected) ?? [] : []
            const confirmedLinks = selectedLinks.filter((l) => l.status === 'confirmed')
            const suggestedLinks = selectedLinks.filter((l) => l.status === 'suggested')
            const methodsBase = selected ? methodsBaseByKey.get(selected) : undefined
            return (
              <div style={{ flex: 1, minWidth: 0 }}>
                {!methodsBase && (
                  <div className="notice">
                    No MethodsBase record is mapped for "{selected}" yet -- nothing to show beyond the label itself.
                  </div>
                )}
                {methodsBase && (
                  <div className="card" style={{ marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>{methodsBase.label}</h3>
                    {methodsBase.discipline && <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>{methodsBase.discipline}</p>}
                    <p>{methodsBase.description}</p>
                    {methodsBase.when_to_use && (
                      <>
                        <p style={{ fontWeight: 600, marginBottom: 2 }}>When to use it</p>
                        <p className="muted">{methodsBase.when_to_use}</p>
                      </>
                    )}
                    <p className="muted" style={{ fontSize: 11 }}>
                      Canonical description from MethodsBase ({methodsBase.id}), review status: {methodsBase.review_status ?? 'unknown'}.
                      {methodsBase.review_status === 'author-draft' && ' Not yet reviewed by anyone with Biologiedidaktik expertise -- treat it as a draft, not an authority.'}
                    </p>
                  </div>
                )}

                <h4>Lernziele this method applies to ({confirmedLinks.length})</h4>
                {confirmedLinks.length === 0 && <p className="muted">No confirmed links yet.</p>}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0' }}>
                  {confirmedLinks.map((l) => (
                    <li key={l.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <Link to={`/dashboard/${project.slug}/learning-goals/${l.lernziel_id}`}>{topicById.get(l.lernziel_id)?.title ?? l.lernziel_id}</Link>
                      {l.rationale && <p className="muted" style={{ fontSize: 12, margin: '2px 0 0 0' }}>{l.rationale}</p>}
                    </li>
                  ))}
                </ul>

                {suggestedLinks.length > 0 && (
                  <>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkle size={14} />AI-suggested, awaiting review ({suggestedLinks.length})
                    </h4>
                    <p className="muted" style={{ fontSize: 12 }}>
                      Proposed by scripts/suggest_method_lernziel_links.mjs from this method's MethodsBase description.
                      Not shown to students and not treated as a real link anywhere else in the app until a project member
                      confirms it here.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {suggestedLinks.map((l) => (
                        <li key={l.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <Link to={`/dashboard/${project.slug}/learning-goals/${l.lernziel_id}`}>{topicById.get(l.lernziel_id)?.title ?? l.lernziel_id}</Link>
                            {l.rationale && <p className="muted" style={{ fontSize: 12, margin: '2px 0 0 0' }}>{l.rationale}</p>}
                          </div>
                          <button type="button" className="btn btn-mini" disabled={busyLinkId === l.id} onClick={() => decide(l.id, 'confirmed')} title="Confirm this link">
                            <Check size={12} />
                          </button>
                          <button type="button" className="btn btn-mini" disabled={busyLinkId === l.id} onClick={() => decide(l.id, 'rejected')} title="Reject this link">
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
