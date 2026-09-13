import { BarChart3 } from 'lucide-react'
import CoherencePage from './coherence-page'

// 2026-09-13 restructure: new sidebar space for coherence and comparison
// tooling. First (and so far only) tool is the existing grade-band
// coherence audit, moved here wholesale and unchanged internally -- rather
// than its own sidebar item. Deliberately scaffolded, not rewritten: future
// tools (a horizontal/content-anchor axis, cross-project comparison) land
// as additional sections here, per Lab Manager's design note, not built yet.
export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="row"><BarChart3 size={18} style={{ color: 'var(--text-muted)' }} />Analytics</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Coherence and comparison tools for this LPM. Vertical coherence (below) is the first one —
        horizontal coherence and cross-LPM comparison land here next.
      </p>
      <CoherencePage />
    </div>
  )
}
