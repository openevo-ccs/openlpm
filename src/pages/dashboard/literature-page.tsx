import { useState } from 'react'
import { Search } from 'lucide-react'

export default function LiteraturePage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div>
      <h1>Literature management</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Search, verify, and manage scientific literature</p>

      <div className="card">
        <h3>Search literature</h3>
        <p className="muted">Search OpenAlex for scientific papers</p>
        <div className="row">
          <input
            type="search"
            placeholder="Search for papers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-1)' }}
          />
          <button className="btn btn-primary">
            <Search size={14} />
            Search
          </button>
        </div>
      </div>
    </div>
  )
}
