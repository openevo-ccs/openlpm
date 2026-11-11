import { Link } from 'react-router-dom'
import { BASE_REPO_CONFIGS } from '@/lib/supabase/base-repo-explorer'

// The row of tabs at the top of the Base repos area. The Base Repo Explorer switches between its repos on the spot. The ConceptBase tab is the
// Concept meanings view, which is its own page, so this row is shown on that page too, with ConceptBase marked, and the other tabs link back
// into the Explorer (feedback cc19c44c, Dustin 2026-11-07).
export const CONCEPTBASE_TAB_PATH = '/dashboard/admin/concept-meanings'

export function BaseRepoTabBar() {
  return (
    <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }} role="navigation" aria-label="Base repos">
      <Link to="/dashboard/admin/explore" className="btn btn-mini">All</Link>
      {BASE_REPO_CONFIGS.map((cfg) => (
        <Link key={cfg.key} to={`/dashboard/admin/explore?tab=${cfg.key}`} className="btn btn-mini">{cfg.name}</Link>
      ))}
      <span className="btn btn-mini btn-primary" aria-current="page">ConceptBase</span>
    </div>
  )
}
