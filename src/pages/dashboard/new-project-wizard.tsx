import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUserProjects, type ProjectWithRole } from '@/lib/supabase/projects'
import { listAvailableFrameworks, listFrameworkTags, type FrameworkRow, type FrameworkTagRow } from '@/lib/supabase/frameworks'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'

// The "Start new project" flow Dustin asked for: a proper multi-step setup
// covering geography, language, subject area, grade-band framework, and
// source/rights declarations -- replacing the bare slug/name/description
// form that used to be the only way to create a project (and only ever as a
// child of whatever Space happened to be open). Reachable two ways: from
// the top-level project switcher (no fixed parent -- creates a new Project
// Space) via /dashboard/new-project, and from inside an open project (fixed
// parent -- creates a sub-project) via /dashboard/:project/new-project.
//
// Known, deliberate scope limits for this first pass (noted inline in the
// UI, not hidden): a brand-new subject area or grade-band scheme can't be
// authored *during* wizard creation, since the framework tables' own access
// rules require a real project to attach new rows to, and this project
// doesn't exist yet until the final step submits. Both are one-click-away
// afterward from the Concepts page (subject areas) or a future framework
// builder (custom grade-bands) -- this wizard picks from what already
// exists rather than half-building an authoring UI it can't actually use yet.

type Project = Database['public']['Tables']['projects']['Row']
type EpistemicStatus = Project['epistemic_status']

const COMMON_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ar', label: 'Arabic' },
]

interface JurisdictionDraft { countryCode: string; regionCode: string; label: string }
interface SourceDraft { sourceName: string; format: string; licenseNote: string; url: string }

const STEPS = ['Basics', 'Geography', 'Language', 'Subject area', 'Grade bands', 'Sources & rights', 'Review']

export default function NewProjectWizard() {
  // Two mount points: inside an open project (sub-project, parent fixed) or
  // at the top level (new Project Space, no parent -- see App.tsx routing).
  const outlet = useOutletContextSafe()
  const fixedParent = outlet?.project ?? null
  const supabase = useMemo(() => fixedParent ? outlet!.supabase : createClient(), [fixedParent, outlet])
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Basics
  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)
  const [parentProjectId, setParentProjectId] = useState<string>('')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [curation, setCuration] = useState<EpistemicStatus>('in-development')

  // Geography
  const [jurisdictions, setJurisdictions] = useState<JurisdictionDraft[]>([{ countryCode: '', regionCode: '', label: '' }])

  // Language
  const [languages, setLanguages] = useState<Set<string>>(new Set(['en']))
  const [customLanguage, setCustomLanguage] = useState('')

  // Subject area
  const [subjectFramework, setSubjectFramework] = useState<FrameworkRow | null>(null)
  const [subjectTags, setSubjectTags] = useState<FrameworkTagRow[]>([])
  const [selectedSubjectTagIds, setSelectedSubjectTagIds] = useState<Set<string>>(new Set())

  // Grade bands
  const [gradeFrameworks, setGradeFrameworks] = useState<FrameworkRow[] | null>(null)
  const [gradeChoice, setGradeChoice] = useState<string>('') // framework id, or 'custom-later'

  // Sources & rights
  const [sources, setSources] = useState<SourceDraft[]>([{ sourceName: '', format: '', licenseNote: '', url: '' }])

  useEffect(() => {
    if (!fixedParent) {
      getUserProjects(supabase).then(setMemberships)
    }
  }, [fixedParent, supabase])

  useEffect(() => {
    listAvailableFrameworks(supabase, 'subject-area').then(async (fws) => {
      const shared = fws.find((f) => f.project_id === null) ?? fws[0] ?? null
      setSubjectFramework(shared)
      if (shared) setSubjectTags(await listFrameworkTags(supabase, shared.id))
    })
    listAvailableFrameworks(supabase, 'grade-band').then((fws) => {
      setGradeFrameworks(fws)
      const shared = fws.find((f) => f.project_id === null)
      if (shared) setGradeChoice(shared.id)
    })
  }, [supabase])

  const canManageParent = (id: string) => {
    if (fixedParent) return true
    const m = memberships?.find((mm) => mm.project.id === id)
    return m ? m.role === 'owner' || m.role === 'maintainer' : false
  }

  const parentOptions = (memberships ?? []).filter((m) => m.role === 'owner' || m.role === 'maintainer')

  const toggleLanguage = (code: string) => {
    setLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const toggleSubjectTag = (id: string) => {
    setSelectedSubjectTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateJurisdiction = (i: number, patch: Partial<JurisdictionDraft>) => {
    setJurisdictions((prev) => prev.map((j, idx) => (idx === i ? { ...j, ...patch } : j)))
  }
  const updateSource = (i: number, patch: Partial<SourceDraft>) => {
    setSources((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const canProceed = () => {
    if (step === 0) return slug.trim().length > 0 && name.trim().length > 0 && (fixedParent || parentProjectId === '' || canManageParent(parentProjectId))
    return true
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const parentId = fixedParent?.id ?? (parentProjectId || null)

      // A sub-project always inherits its parent Space's real/synthetic
      // classification -- the same rule the original single-form creation
      // path already used; a brand-new top-level Space asks directly, since
      // that classification only means something once it's actually chosen.
      const epistemicStatus: EpistemicStatus = fixedParent
        ? fixedParent.epistemic_status
        : parentId
          ? (memberships?.find((m) => m.project.id === parentId)?.project.epistemic_status ?? curation)
          : curation

      const gradeFrameworkId = gradeChoice && gradeChoice !== 'custom-later' ? gradeChoice : null

      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || null,
          focus_type: jurisdictions.some((j) => j.countryCode.trim()) ? 'regional' : 'general',
          maturity: 'draft',
          epistemic_status: epistemicStatus,
          parent_project_id: parentId,
          working_languages: Array.from(languages),
          grade_framework_id: gradeFrameworkId,
          created_by: user?.id ?? null,
        })
        .select()
        .single()

      if (insertError || !project) throw insertError ?? new Error('Could not create the project.')

      const realJurisdictions = jurisdictions.filter((j) => j.countryCode.trim() && j.label.trim())
      if (realJurisdictions.length > 0) {
        await supabase.from('project_jurisdictions').insert(
          realJurisdictions.map((j) => ({
            project_id: project.id,
            country_code: j.countryCode.trim().toUpperCase(),
            region_code: j.regionCode.trim() || null,
            label: j.label.trim(),
          }))
        )
      }

      if (selectedSubjectTagIds.size > 0) {
        await supabase.from('project_subject_area_tags').insert(
          Array.from(selectedSubjectTagIds).map((tagId) => ({ project_id: project.id, framework_tag_id: tagId }))
        )
      }

      const realSources = sources.filter((s) => s.sourceName.trim())
      if (realSources.length > 0) {
        await supabase.from('project_source_declarations').insert(
          realSources.map((s) => ({
            project_id: project.id,
            source_name: s.sourceName.trim(),
            format: s.format.trim() || null,
            license_or_rights_note: s.licenseNote.trim() || null,
            url: s.url.trim() || null,
            created_by: user?.id ?? null,
          }))
        )
      }

      navigate(`/dashboard/${project.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong creating the project.')
    }
    setBusy(false)
  }

  const backHref = fixedParent ? `/dashboard/${fixedParent.slug}` : '/dashboard'

  return (
    <div className="page-narrow" style={{ maxWidth: 640 }}>
      <button className="row muted btn-linklike" style={{ marginBottom: 12 }} onClick={() => navigate(backHref)}>
        <ArrowLeft size={14} />
        {fixedParent ? `Back to ${fixedParent.name}` : 'Back to your project spaces'}
      </button>

      <h1>{fixedParent ? `New project in ${fixedParent.name}` : 'Start a new project space'}</h1>

      <div className="row" style={{ gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STEPS.map((label, i) => (
          <span key={label} className={`chip${i === step ? ' chip-good' : ''}`} style={{ fontSize: 11 }}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && <div className="notice notice-bad">{error}</div>}

      <div className="card">
        {step === 0 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Basics</h3>
            {!fixedParent && (
              <div className="field">
                <label>Nest this inside an existing project? (optional)</label>
                <select value={parentProjectId} onChange={(e) => setParentProjectId(e.target.value)}>
                  <option value="">No — this is a new, top-level project space</option>
                  {parentOptions.map((m) => (
                    <option key={m.project.id} value={m.project.id}>{m.project.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Short address</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. evomentor-france" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EvoMentor France" required />
            </div>
            <div className="field">
              <label>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this for?" />
            </div>
            {!fixedParent && !parentProjectId && (
              <div className="field">
                <label>Is this real, human-curated curriculum content, or a synthetic/theoretical construct?</label>
                <select value={curation} onChange={(e) => setCuration(e.target.value as EpistemicStatus)}>
                  <option value="in-development">Human-curated — real content, still being built</option>
                  <option value="field-validated-curriculum">Human-curated — already in real classroom use</option>
                  <option value="designed-thought-experiment">Synthetic-theoretical — a designed comparison or research construct</option>
                </select>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Geography</h3>
            <p className="muted">One or more states/regions within one or more countries — leave empty for a project with no fixed geographic scope.</p>
            {jurisdictions.map((j, i) => (
              <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                <div className="field" style={{ marginBottom: 0, width: 80 }}>
                  <label>Country code</label>
                  <input value={j.countryCode} onChange={(e) => updateJurisdiction(i, { countryCode: e.target.value })} placeholder="DE" maxLength={2} />
                </div>
                <div className="field" style={{ marginBottom: 0, width: 100 }}>
                  <label>Region code (optional)</label>
                  <input value={j.regionCode} onChange={(e) => updateJurisdiction(i, { regionCode: e.target.value })} placeholder="DE-BY" />
                </div>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>Plain-language name</label>
                  <input value={j.label} onChange={(e) => updateJurisdiction(i, { label: e.target.value })} placeholder="e.g. Bavaria, Germany" />
                </div>
                <button className="btn btn-mini" onClick={() => setJurisdictions((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 size={12} /></button>
              </div>
            ))}
            <button className="btn btn-mini" onClick={() => setJurisdictions((prev) => [...prev, { countryCode: '', regionCode: '', label: '' }])}>
              <Plus size={12} />Add another region
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Working language(s)</h3>
            <p className="muted">All languages are supported for the curriculum content itself — the OpenLPM app interface stays English for now, with an English/German toggle planned.</p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {COMMON_LANGUAGES.map((l) => (
                <label key={l.code} className="row" style={{ gap: 4 }}>
                  <input type="checkbox" checked={languages.has(l.code)} onChange={() => toggleLanguage(l.code)} />
                  {l.label}
                </label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <input value={customLanguage} onChange={(e) => setCustomLanguage(e.target.value)} placeholder="Other language code, e.g. sw, hi" style={{ width: 200 }} />
              <button
                className="btn btn-mini"
                onClick={() => { if (customLanguage.trim()) { toggleLanguage(customLanguage.trim()); setCustomLanguage('') } }}
              >
                <Plus size={12} />Add
              </button>
            </div>
            {Array.from(languages).filter((c) => !COMMON_LANGUAGES.some((l) => l.code === c)).length > 0 && (
              <p className="muted" style={{ fontSize: 12 }}>
                Also added: {Array.from(languages).filter((c) => !COMMON_LANGUAGES.some((l) => l.code === c)).join(', ')}
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Subject area(s)</h3>
            {subjectTags.length === 0 ? (
              <p className="muted">Loading…</p>
            ) : (
              <div>
                {subjectTags.map((t) => (
                  <label key={t.id} className="row" style={{ marginLeft: t.parent_tag_id ? 16 : 0, padding: '2px 0' }}>
                    <input type="checkbox" checked={selectedSubjectTagIds.has(t.id)} onChange={() => toggleSubjectTag(t.id)} />
                    {t.label}
                  </label>
                ))}
              </div>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Only {subjectFramework?.label ?? 'the starter taxonomy'}'s current entries are selectable here. Once
              your project exists, you can propose a new subject area or a crosswalk to another project's terms from
              the Concepts page.
            </p>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Grade bands / educational stage</h3>
            <p className="muted">
              Pick a pre-existing framework to compare against, or note that you'll define a custom one later.
              Grade counts differ even for the same ages (e.g. an 8-year vs. 9-year Gymnasium track) — the reference
              scale below is age-anchored for exactly that reason.
            </p>
            {gradeFrameworks === null ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="field">
                <select value={gradeChoice} onChange={(e) => setGradeChoice(e.target.value)}>
                  {gradeFrameworks.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}{f.project_id === null ? ' (ecosystem reference)' : ''}</option>
                  ))}
                  <option value="custom-later">I'll define a custom grade-band scheme after creating this project</option>
                </select>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Source(s), format(s), and rights</h3>
            <p className="muted">What curriculum policies or competency frameworks are you planning to bring in, and do you have the rights to use them?</p>
            {sources.map((s, i) => (
              <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div className="grid grid-2">
                  <div className="field">
                    <label>Source name</label>
                    <input value={s.sourceName} onChange={(e) => updateSource(i, { sourceName: e.target.value })} placeholder="e.g. Bavaria Biologie Lehrplan" />
                  </div>
                  <div className="field">
                    <label>Format</label>
                    <input value={s.format} onChange={(e) => updateSource(i, { format: e.target.value })} placeholder="e.g. PDF, CASE, SPARQL" />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Rights / license note</label>
                    <input value={s.licenseNote} onChange={(e) => updateSource(i, { licenseNote: e.target.value })} placeholder="e.g. Public domain government document" />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>URL (optional)</label>
                    <input value={s.url} onChange={(e) => updateSource(i, { url: e.target.value })} placeholder="https://…" />
                  </div>
                </div>
                <button className="btn btn-mini" onClick={() => setSources((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 size={12} />Remove</button>
              </div>
            ))}
            <button className="btn btn-mini" onClick={() => setSources((prev) => [...prev, { sourceName: '', format: '', licenseNote: '', url: '' }])}>
              <Plus size={12} />Add another source
            </button>
          </div>
        )}

        {step === 6 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Review</h3>
            <p><strong>{name || '(no name yet)'}</strong> ({slug || 'no-slug-yet'})</p>
            <p className="muted">{description || 'No description.'}</p>
            <p className="muted">Parent: {fixedParent?.name ?? parentOptions.find((m) => m.project.id === parentProjectId)?.project.name ?? 'None — a new top-level project space'}</p>
            <p className="muted">Languages: {Array.from(languages).join(', ') || 'none selected'}</p>
            <p className="muted">Regions: {jurisdictions.filter((j) => j.label.trim()).map((j) => j.label).join(', ') || 'none specified'}</p>
            <p className="muted">Subject areas: {subjectTags.filter((t) => selectedSubjectTagIds.has(t.id)).map((t) => t.label).join(', ') || 'none selected'}</p>
            <p className="muted">Grade-band framework: {gradeChoice === 'custom-later' ? 'custom, to be defined later' : gradeFrameworks?.find((f) => f.id === gradeChoice)?.label ?? 'none'}</p>
            <p className="muted">Sources: {sources.filter((s) => s.sourceName.trim()).map((s) => s.sourceName).join(', ') || 'none specified'}</p>
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <button className="btn btn-mini" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft size={12} />Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
            Next<ArrowRight size={12} />
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            <Check size={12} />{busy ? 'Creating…' : 'Create project'}
          </button>
        )}
      </div>
    </div>
  )
}

// The wizard mounts both inside a project's own routed Outlet (nested under
// ProjectLayout's <Outlet context={...}>, at /dashboard/:project/new-project)
// and at the bare /dashboard/new-project route (nested directly under
// DashboardLayout's plain <Outlet />, no context passed). useOutletContext()
// just reads the nearest ancestor Outlet's context via React context, so it
// resolves to undefined -- not a throw -- in the second case.
function useOutletContextSafe(): ProjectOutletContext | null {
  const ctx = useOutletContext<ProjectOutletContext | undefined>()
  return ctx ?? null
}
