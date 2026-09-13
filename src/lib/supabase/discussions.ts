import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

export type DiscussionTopicRow = Database['public']['Tables']['discussion_topics']['Row']
export type DiscussionPostRow = Database['public']['Tables']['discussion_posts']['Row']

export async function listTopics(supabase: Client, projectId: string): Promise<DiscussionTopicRow[]> {
  const { data } = await supabase.from('discussion_topics').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  return data ?? []
}

export async function listTopicTags(supabase: Client, topicIds: string[]): Promise<Map<string, string[]>> {
  if (topicIds.length === 0) return new Map()
  const { data } = await supabase.from('discussion_topic_tags').select('topic_id, tag').in('topic_id', topicIds)
  const map = new Map<string, string[]>()
  for (const row of data ?? []) {
    const list = map.get(row.topic_id) ?? []
    list.push(row.tag)
    map.set(row.topic_id, list)
  }
  return map
}

export interface PostWithAuthor extends DiscussionPostRow {
  author: { name: string; email: string } | null
}

export async function listPosts(supabase: Client, topicId: string): Promise<PostWithAuthor[]> {
  const { data } = await supabase
    .from('discussion_posts')
    .select('*, author:users(name, email)')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as PostWithAuthor[]
}

/** Builds a parent_id -> children[] map so the UI can render real reply threading without N nested queries. */
export function groupPostsByParent(posts: PostWithAuthor[]): Map<string | null, PostWithAuthor[]> {
  const byParent = new Map<string | null, PostWithAuthor[]>()
  for (const post of posts) {
    const key = post.parent_id
    const list = byParent.get(key) ?? []
    list.push(post)
    byParent.set(key, list)
  }
  return byParent
}
