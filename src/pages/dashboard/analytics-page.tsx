import { BarChart3 } from 'lucide-react'
import CoherencePage from './coherence-page'

// 2026-09-13 restructure: new sidebar space for coherence and comparison
// tooling, rather than its own sidebar item per tool. Grade-band (vertical)
// and same-grade-across-strands (horizontal) coherence are both real as of
// 2026-10-02 (feedback ae39e124) -- see CoherencePage's own tabs. Cross-
// curriculum comparison is still a named next step, not built.
export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="row"><BarChart3 size={18} style={{ color: 'var(--text-muted)' }} />Analytics</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Coherence and comparison tools for this LPM.
      </p>
      <CoherencePage />
    </div>
  )
}
