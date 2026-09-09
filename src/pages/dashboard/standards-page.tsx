import { useOutletContext } from 'react-router-dom'
import { Info, Database } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'

// Preview of RFC 0003 (proposals/0003-frameworks-and-versioned-standards.md,
// status: Proposed). Used to render two files staged directly from real
// source material (a hand-authored Basiskonzepte taxonomy CSV; a 2024->2026
// Thuringia Lehrplan diff, including unreleased 2026 Erprobungsfassung text)
// as static repo JSON -- fine while this repo was private, not once it went
// public for GitHub Pages (2026-09-09): a static import ships in the client
// bundle regardless of the /dashboard auth gate, so it was real curriculum
// content sitting in the open. Removed the same day it was noticed. Real
// content now waits for a Supabase-backed home (RLS-gated, same as every
// other project-scoped table) -- see openlpm-data-architecture memory --
// rather than ever landing back in this repo as files.

export default function StandardsPage() {
  useOutletContext<ProjectOutletContext>()

  return (
    <div>
      <h1>Standards &amp; frameworks</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Cross-cutting conceptual frameworks and versioned curriculum standards, with real version comparison.
      </p>

      <div className="notice">
        <Info size={14} />
        RFC 0003 (frameworks/versioned-standards data model) is proposed but not yet built.
      </div>

      <div className="card empty">
        <Database size={32} />
        <p>This preview previously rendered real staged content directly from repo files.</p>
        <p className="muted">
          Moved out of this public repo on 2026-09-09 — real curriculum content only lives in
          Supabase now, gated the same way every other project-scoped table is. This page comes
          back once RFC 0003&apos;s tables exist and the content is re-staged there.
        </p>
      </div>
    </div>
  )
}
