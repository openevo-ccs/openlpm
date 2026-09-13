import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MessageSquare, Plus, Reply, X } from 'lucide-react'
import type { ProjectOutletContext } from './project-layout'
import {
  groupPostsByParent,
  listPosts,
  listTopicTags,
  listTopics,
  type DiscussionTopicRow,
  type PostWithAuthor,
} from '@/lib/supabase/discussions'

// Real thread creation/reply UI, finally built over discussion_topics/
// discussion_posts -- tables that have existed unused since migration 001
// (RFC 0002 Phase 2 was never implemented until now). Tagging uses the new
// discussion_topic_tags table (migration 020). Fixed a real, live
// cross-project read/write leak on discussion_posts (migration 022) before
// building this -- see that migration's own comment.
export default function DiscussionsPage() {
  const { project, supabase } = useOutletContext<ProjectOutletContext>()
  const [topics, setTopics] = useState<DiscussionTopicRow[] | null>(null)
  const [tagsByTopic, setTagsByTopic] = useState<Map<string, string[]>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = async () => {
    const t = await listTopics(supabase, project.id)
    setTopics(t)
    setTagsByTopic(await listTopicTags(supabase, t.map((x) => x.id)))
  }

  useEffect(() => {
    setTopics(null)
    setSelectedId(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id])

  const selected = topics?.find((t) => t.id === selectedId) ?? null

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="row"><MessageSquare size={18} style={{ color: 'var(--text-muted)' }} />Discussions</h1>
          <p className="muted" style={{ marginBottom: 12 }}>
            Open threads about this LPM, taggable with whatever's relevant to the conversation.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate((v) => !v); setSelectedId(null) }}>
          <Plus size={14} />New topic
        </button>
      </div>

      {showCreate && (
        <CreateTopicForm
          projectId={project.id}
          supabase={supabase}
          onCreated={async (id) => { setShowCreate(false); await reload(); setSelectedId(id) }}
        />
      )}

      {topics === null ? (
        <p className="muted">Loading…</p>
      ) : topics.length === 0 ? (
        <div className="card empty">
          <MessageSquare size={32} />
          <p>No discussions yet.</p>
        </div>
      ) : selected ? (
        <TopicThread topic={selected} tags={tagsByTopic.get(selected.id) ?? []} supabase={supabase} onBack={() => setSelectedId(null)} onTagsChanged={reload} />
      ) : (
        <div className="card">
          {topics.map((t) => (
            <button
              key={t.id}
              className="btn-linklike"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', borderBottom: '1px solid var(--border)' }}
              onClick={() => setSelectedId(t.id)}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{t.title}</strong>
                {t.category && <span className="chip" style={{ fontSize: 10 }}>{t.category}</span>}
              </div>
              {t.description && <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>{t.description}</p>}
              {(tagsByTopic.get(t.id) ?? []).length > 0 && (
                <div className="row" style={{ marginTop: 4, gap: 4 }}>
                  {(tagsByTopic.get(t.id) ?? []).map((tag) => <span key={tag} className="chip" style={{ fontSize: 10 }}>#{tag}</span>)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateTopicForm({
  projectId,
  supabase,
  onCreated,
}: {
  projectId: string
  supabase: ProjectOutletContext['supabase']
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: err } = await supabase
      .from('discussion_topics')
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()
    if (err || !data) { setBusy(false); setError(err?.message ?? 'Could not create the topic.'); return }

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (tagList.length > 0) {
      await supabase.from('discussion_topic_tags').insert(tagList.map((tag) => ({ topic_id: data.id, tag })))
    }
    setBusy(false)
    onCreated(data.id)
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>New topic</h3>
      {error && <div className="notice notice-bad">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 60 }} />
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>Category (optional)</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Coherence question" />
          </div>
          <div className="field">
            <label>Tags (comma-separated, optional)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. grade-9, biology" />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Start topic'}</button>
      </form>
    </div>
  )
}

function TopicThread({
  topic,
  tags,
  supabase,
  onBack,
  onTagsChanged,
}: {
  topic: DiscussionTopicRow
  tags: string[]
  supabase: ProjectOutletContext['supabase']
  onBack: () => void
  onTagsChanged: () => void
}) {
  const [posts, setPosts] = useState<PostWithAuthor[] | null>(null)
  const [newTag, setNewTag] = useState('')

  const reload = async () => setPosts(await listPosts(supabase, topic.id))

  useEffect(() => {
    setPosts(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, topic.id])

  const addTag = async () => {
    if (!newTag.trim()) return
    await supabase.from('discussion_topic_tags').insert({ topic_id: topic.id, tag: newTag.trim() })
    setNewTag('')
    onTagsChanged()
  }

  const removeTag = async (tag: string) => {
    await supabase.from('discussion_topic_tags').delete().eq('topic_id', topic.id).eq('tag', tag)
    onTagsChanged()
  }

  if (posts === null) return <p className="muted">Loading…</p>

  const byParent = groupPostsByParent(posts)

  return (
    <div className="card">
      <button className="btn-linklike row" onClick={onBack} style={{ marginBottom: 8 }}>← All topics</button>
      <h3 style={{ marginTop: 0 }}>{topic.title}</h3>
      {topic.description && <p className="muted">{topic.description}</p>}

      <div className="row" style={{ gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {tags.map((tag) => (
          <span key={tag} className="chip row" style={{ fontSize: 10, gap: 4 }}>
            #{tag}
            <button className="btn-linklike" onClick={() => removeTag(tag)}><X size={9} /></button>
          </span>
        ))}
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder="Add tag…"
          style={{ width: 100, fontSize: 11, padding: '2px 6px' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        {(byParent.get(null) ?? []).map((post) => (
          <PostThread key={post.id} post={post} byParent={byParent} topicId={topic.id} supabase={supabase} onPosted={reload} depth={0} />
        ))}
      </div>

      <ReplyForm topicId={topic.id} parentId={null} supabase={supabase} onPosted={reload} />
    </div>
  )
}

function PostThread({
  post,
  byParent,
  topicId,
  supabase,
  onPosted,
  depth,
}: {
  post: PostWithAuthor
  byParent: Map<string | null, PostWithAuthor[]>
  topicId: string
  supabase: ProjectOutletContext['supabase']
  onPosted: () => void
  depth: number
}) {
  const [replying, setReplying] = useState(false)
  const replies = byParent.get(post.id) ?? []

  return (
    <div style={{ marginLeft: depth * 20, marginTop: 8, paddingLeft: depth > 0 ? 10 : 0, borderLeft: depth > 0 ? '2px solid var(--border)' : 'none' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>{post.author?.name ?? 'Unknown'}</strong>
        <span className="muted" style={{ fontSize: 11 }}>{new Date(post.created_at).toLocaleString()}</span>
      </div>
      <p style={{ margin: '2px 0 4px' }}>{post.content}</p>
      <button className="btn-linklike row" style={{ fontSize: 12 }} onClick={() => setReplying((v) => !v)}>
        <Reply size={11} />Reply
      </button>
      {replying && (
        <ReplyForm
          topicId={topicId}
          parentId={post.id}
          supabase={supabase}
          onPosted={() => { setReplying(false); onPosted() }}
        />
      )}
      {replies.map((r) => (
        <PostThread key={r.id} post={r} byParent={byParent} topicId={topicId} supabase={supabase} onPosted={onPosted} depth={depth + 1} />
      ))}
    </div>
  )
}

function ReplyForm({
  topicId,
  parentId,
  supabase,
  onPosted,
}: {
  topicId: string
  parentId: string | null
  supabase: ProjectOutletContext['supabase']
  onPosted: () => void
}) {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('discussion_posts').insert({
      topic_id: topicId,
      parent_id: parentId,
      user_id: user?.id ?? null,
      content: content.trim(),
    })
    setContent('')
    setBusy(false)
    onPosted()
  }

  return (
    <form onSubmit={submit} className="row" style={{ marginTop: 6, gap: 6 }}>
      <input value={content} onChange={(e) => setContent(e.target.value)} placeholder={parentId ? 'Write a reply…' : 'Post to this discussion…'} style={{ flex: 1 }} />
      <button className="btn btn-mini" type="submit" disabled={busy || !content.trim()}>Post</button>
    </form>
  )
}
