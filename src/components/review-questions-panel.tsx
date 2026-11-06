import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type Topic = Pick<Database['public']['Tables']['discussion_topics']['Row'], 'id' | 'title' | 'description' | 'category'>

/** The question itself is the first paragraph of the description. The rest is the standing note that the question is AI-drafted. */
function firstParagraph(text: string | null): string {
  return (text ?? '').split(/\n\s*\n/)[0] ?? ''
}

/**
 * Review questions that point at one part ("data_object") or one concept ("schema_element") of a space. Shows nothing when there are none,
 * so it costs spaces without an agenda nothing. Each question opens in the Discussions page, where the reply thread lives.
 */
export function ReviewQuestionsPanel({
  supabase,
  projectId,
  projectSlug,
  linkedType,
  linkedId,
}: {
  supabase: SupabaseClient<Database>
  projectId: string
  projectSlug: string
  linkedType: 'data_object' | 'schema_element'
  linkedId: string
}) {
  const [topics, setTopics] = useState<Topic[]>([])
  useEffect(() => {
    let cancelled = false
    setTopics([])
    supabase
      .from('discussion_topics')
      .select('id, title, description, category')
      .eq('project_id', projectId)
      .eq('linked_type', linkedType)
      .eq('linked_id', linkedId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setTopics(data ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [supabase, projectId, linkedType, linkedId])

  if (topics.length === 0) return null
  return (
    <section style={{ marginTop: 16 }} aria-label="Review questions">
      <h4 className="row" style={{ marginBottom: 4 }}>
        <MessageSquare size={13} />Review questions ({topics.length})
      </h4>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Drafted by AI for an expert reader. Open one to answer it or to say it is badly put.</p>
      {topics.map((t) => (
        <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <Link to={`/dashboard/${projectSlug}/discussions?topic=${t.id}`} style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</Link>
            {t.category && <span className="chip" style={{ fontSize: 10 }}>{t.category}</span>}
          </div>
          <p style={{ fontSize: 13, margin: '2px 0 0' }}>{firstParagraph(t.description)}</p>
        </div>
      ))}
    </section>
  )
}
