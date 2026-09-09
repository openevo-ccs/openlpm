import { MessageSquare } from 'lucide-react'

export default function DiscussionsPage() {
  return (
    <div>
      <h1>Discussions</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Threaded, citable conversation attached to schema elements, data objects, and literature.
      </p>
      <div className="card empty">
        <MessageSquare size={32} />
        <p>No discussions yet.</p>
        <p className="muted">The discussion forum UI is still being built (RFC 0002, Phase 2).</p>
      </div>
    </div>
  )
}
