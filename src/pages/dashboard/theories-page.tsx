import { Info, Lightbulb } from 'lucide-react'

// New sidebar space, 2026-09-13 restructure. Find/select/create theories,
// link them to literature (theoretical clarification and/or empirical
// support), and link them to concepts, learning goals, and strands with
// labeled relations. Schema (theories, theory_literature_links,
// theory_relations -- see migration 020_theories_strands_discussions.sql)
// is written but not yet applied to the live database, so this stays an
// honest placeholder rather than querying tables that don't exist yet --
// same pattern this repo already uses for Discussions and the old Standards
// page while their own schema was pending.
export default function TheoriesPage() {
  return (
    <div>
      <h1 className="row"><Lightbulb size={18} style={{ color: 'var(--text-muted)' }} />Theories</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Find and select, or create and curate, the theories informing this LPM's content — each
        linkable to literature for theoretical clarification or empirical support, and to
        concepts, learning goals, and strands with labeled relations.
      </p>

      <div className="notice">
        <Info size={14} />
        Schema is written but not yet live on the database. This page comes alive once that
        migration is applied.
      </div>

      <div className="card empty">
        <Lightbulb size={32} />
        <p>No theories yet.</p>
      </div>
    </div>
  )
}
