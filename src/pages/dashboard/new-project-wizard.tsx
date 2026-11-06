import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUserProjects, type ProjectWithRole } from '@/lib/supabase/projects'
import { PROJECT_COLORS } from '@/lib/project-colors'
import type { ProjectOutletContext } from './project-layout'
import type { Database } from '@/lib/supabase/database.types'

// Real feedback 55779d95 (Dustin, 2026-10-10): "Not sure what happened
// here! generally lets make starting a project much easier - give it a
// name and then let's just enable the settings and dashboard within the
// project space be where the user can add / update all the other project
// meta-data." This used to be a 7-step wizard (Basics, Geography, Language,
// Subject area, Grade bands, Sources & rights, Review) -- the same session
// that reported this feedback also hit a real bug in it (a capital letter
// in the slug field triggered a swallowed error, fixed separately in
// commit 0bcab07). Collapsed down to just this one screen: a name, a short
// address, and the handful of choices (parent, curation, privacy) that
// only make sense to ask once, at creation. Geography, working language(s),
// subject area, grade-band framework, and sources & rights all moved to
// settings-page.tsx's ProjectDetailsSection, editable any time afterward --
// not just a one-shot decision a researcher has to get right up front.
//
// Reachable two ways: from the top-level project switcher (no fixed
// parent -- creates a new Project Space) via /dashboard/new-project, and
// from inside an open project (fixed parent -- creates a sub-project) via
// /dashboard/:project/new-project.

type Project = Database['public']['Tables']['projects']['Row']
type EpistemicStatus = Project['epistemic_status']

export type AccessTier = 'full-text-stored' | 'excerpt-only' | 'summary-only' | 'citation-only'

// Plain-language options for project_source_declarations.access_tier /
// standards_documents.access_tier (migration 044) -- same underlying values
// as deutsche_lp/nys_lp's accessTier schema field, added the same day, so a
// source declared here means the same thing as one recorded in either
// regional repo. Labels are written for a researcher filling out this form,
// not for someone who already knows the column name. Exported: used by
// settings-page.tsx's SourceDeclarationsSection, which is now the only
// place a source gets declared (see this file's own top comment). Kept as
// its own copy from curriculum-repository.ts's own ACCESS_TIER_OPTIONS --
// see that file's comment -- since this one's value can be '' ("not sure
// yet"), which that table's NOT NULL access_tier never allows.
export const ACCESS_TIER_OPTIONS: { value: AccessTier | ''; label: string }[] = [
  { value: '', label: "Not sure yet — decide before importing" },
  { value: 'full-text-stored', label: 'The full document — we have clear rights to keep all of it' },
  { value: 'excerpt-only', label: 'Short excerpts only — a few quoted lines at a time, never the whole document' },
  { value: 'summary-only', label: "A summary only — described in our own words, no direct quotes" },
  { value: 'citation-only', label: "Just a citation — we'll link to the original without storing any of its text" },
]

export default function NewProjectWizard() {
  // Two mount points: inside an open project (sub-project, parent fixed) or
  // at the top level (new Project Space, no parent -- see App.tsx routing).
  const outlet = useOutletContextSafe()
  const fixedParent = outlet?.project ?? null
  const supabase = useMemo(() => fixedParent ? outlet!.supabase : createClient(), [fixedParent, outlet])
  const navigate = useNavigate()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [memberships, setMemberships] = useState<ProjectWithRole[] | null>(null)
  const [parentProjectId, setParentProjectId] = useState<string>('')
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [curation, setCuration] = useState<EpistemicStatus>('in-development')
  // Only meaningful for a new top-level project space (a sub-project always
  // inherits visibility from its parent, same rule as epistemic_status just
  // below) -- migration 025. Default false: most projects should stay in
  // the browsable directory; private is an opt-in for something like
  // eva-lpm that genuinely shouldn't be visible to other OpenLPM users yet.
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    if (!fixedParent) {
      getUserProjects(supabase).then(setMemberships)
    }
  }, [fixedParent, supabase])

  const canManageParent = (id: string) => {
    if (fixedParent) return true
    const m = memberships?.find((mm) => mm.project.id === id)
    return m ? m.role === 'owner' || m.role === 'maintainer' : false
  }

  const parentOptions = (memberships ?? []).filter((m) => m.role === 'owner' || m.role === 'maintainer')

  const canSubmit = slug.trim().length > 0 && name.trim().length > 0 && (fixedParent || parentProjectId === '' || canManageParent(parentProjectId))

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

      // A sub-project always inherits its parent Space's privacy too, same
      // reasoning as epistemic_status above -- a private parent's own
      // sub-projects can't opt back into being publicly listed.
      const projectIsPrivate: boolean = fixedParent
        ? fixedParent.is_private
        : parentId
          ? (memberships?.find((m) => m.project.id === parentId)?.project.is_private ?? isPrivate)
          : isPrivate

      // Real feedback 2026-10-01 (Dustin): "lets automatically assign some
      // color to each project space... and allow users to edit that choice
      // anytime" -- the edit-anytime half already exists (Settings' own
      // Project color card); this is the missing auto-assign half. Picks
      // the first palette color none of this project's own siblings (same
      // parent, among projects this user can already see) is using yet, so
      // adjacent entries in the switcher/sidebar don't collide -- falls
      // back to a round-robin pick once the palette is exhausted, rather
      // than leaving later siblings uncolored.
      const siblingProjects = (memberships ?? [])
        .map((m) => m.project as any)
        .filter((p) => (parentId ? p.parent_project_id === parentId : !p.parent_project_id))
      const usedColors = new Set(siblingProjects.map((p) => p.color).filter(Boolean))
      const autoColor = PROJECT_COLORS.find((c) => !usedColors.has(c.key))?.key
        ?? PROJECT_COLORS[siblingProjects.length % PROJECT_COLORS.length].key

      // Geography, working language(s), subject area, grade-band framework,
      // and sources & rights are deliberately NOT asked here -- see this
      // file's own top comment. working_languages defaults to English so
      // the app has something sane to show before a researcher visits
      // Settings; everything else starts empty/unset.
      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || null,
          focus_type: 'general',
          maturity: 'draft',
          epistemic_status: epistemicStatus,
          parent_project_id: parentId,
          working_languages: ['en'],
          is_private: projectIsPrivate,
          created_by: user?.id ?? null,
          color: autoColor,
        } as any)
        .select()
        .single()

      if (insertError || !project) throw insertError ?? new Error('Could not create the project.')

      navigate(`/dashboard/${project.slug}`)
    } catch (err) {
      // Supabase's PostgrestError (e.g. a slug CHECK constraint violation) carries a real
      // .message but is a plain object, not `instanceof Error` -- that gate was silently
      // discarding the actual reason and always showing the generic fallback instead.
      const message = (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message) : null
      setError(message || 'Something went wrong creating the project.')
    }
    setBusy(false)
  }

  const backHref = fixedParent ? `/dashboard/${fixedParent.slug}` : '/dashboard'

  return (
    <div className="page-narrow" style={{ maxWidth: 560 }}>
      <button className="row muted btn-linklike" style={{ marginBottom: 12 }} onClick={() => navigate(backHref)}>
        <ArrowLeft size={14} />
        {fixedParent ? `Back to ${fixedParent.name}` : 'Back to your project spaces'}
      </button>

      <h1>{fixedParent ? `New project in ${fixedParent.name}` : 'Start a new project space'}</h1>

      {error && <div className="notice notice-bad">{error}</div>}

      <div className="card">
        {!fixedParent && (
          <div className="field">
            <label>Nest this inside an existing project? (optional)</label>
            <select value={parentProjectId} onChange={(e) => setParentProjectId(e.target.value)}>
              <option value="">No — this is a new, top-level project space</option>
              {parentOptions.map((m) => (
                <option key={m.project.id} value={m.project.id}>
                  {m.project.name}{(m.project as any).project_kind === 'curriculum-repository' ? ' (Curriculum Repository)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>Short address</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="e.g. evomentor-france"
            required
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Lowercase letters, numbers, and hyphens only — this becomes part of the project's URL.</p>
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
        {!fixedParent && !parentProjectId && (
          <div className="field">
            <label className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Make this project private
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              A private project is invisible to anyone outside it, both in the project directory
              and by name. Only people you add as members can see that it exists at all. Leave
              unchecked for a normal, browsable project space.
            </p>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
          Geography, working language(s), subject area, grade-band framework, and sources & rights
          aren't asked here — add or change any of them from this project's own Settings page
          (under "Project details") once it exists.
        </p>

        <button className="btn btn-primary" disabled={!canSubmit || busy} onClick={submit} style={{ marginTop: 8 }}>
          <Check size={12} />{busy ? 'Creating…' : 'Create project'}
        </button>
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
