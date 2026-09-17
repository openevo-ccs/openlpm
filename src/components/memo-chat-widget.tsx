import { useRef, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { MessageCircle, Send, X } from 'lucide-react'

// v1 scope only -- see lab_manager/docs/design-notes/chat-with-me-mo-widget-
// for-locallpm-design-and-v1-scope.md. One call per turn (no multi-step tool
// loop yet), grounded in whatever the URL says the user is currently looking
// at -- not a live Supabase read, so "session awareness" here means "which
// project/tab is open", not "the full content of that project". No
// write-back: this widget only ever talks, it never edits LPM data.
//
// Backend is a separate local service (curriculum-agents/tools/lpm-chat-
// bridge), not part of this app -- point VITE_MEMO_CHAT_URL at it if it's
// not running on the default port.
const CHAT_BASE_URL = (import.meta.env.VITE_MEMO_CHAT_URL as string | undefined) || 'http://127.0.0.1:8793'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function currentProjectContext(pathname: string): string {
  const match = matchPath('/dashboard/:project/*', pathname)
  if (!match) return 'The user is on the project switcher or profile page -- no project is currently open.'
  const { project, '*': rest } = match.params as { project: string; '*'?: string }
  const tab = (rest || '').split('/')[0] || 'overview'
  return `Project slug: ${project}. Current tab: ${tab}.`
}

export function MemoChatWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    setError(null)

    try {
      const res = await fetch(`${CHAT_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextMessages.slice(-10),
          project_context: currentProjectContext(location.pathname),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Chat service returned ${res.status}`)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string }])
    } catch (e) {
      setError(
        e instanceof Error
          ? `Me-Mo couldn't respond: ${e.message}`
          : "Me-Mo couldn't respond -- is the local chat service running?"
      )
    } finally {
      setSending(false)
      requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }))
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="memo-chat-launcher"
        onClick={() => setOpen(true)}
        aria-label="Chat with Me-Mo"
      >
        <MessageCircle size={20} />
      </button>
    )
  }

  return (
    <div className="memo-chat-panel card">
      <div className="memo-chat-header">
        <span className="memo-chat-title">
          <MessageCircle size={16} />
          Chat with Me-Mo
        </span>
        <button type="button" className="btn btn-mini memo-chat-close" onClick={() => setOpen(false)} aria-label="Collapse chat">
          <X size={14} />
        </button>
      </div>

      <div className="memo-chat-log" ref={logRef}>
        {messages.length === 0 && (
          <p className="muted memo-chat-empty">
            Ask about a concept, get help drafting a learning goal, or ask what's already in this project.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`memo-chat-bubble memo-chat-bubble-${m.role}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="memo-chat-bubble memo-chat-bubble-assistant memo-chat-pending">Me-Mo is thinking…</div>}
      </div>

      {error && <div className="notice notice-bad memo-chat-error">{error}</div>}

      <div className="memo-chat-input-row">
        <textarea
          className="memo-chat-input"
          placeholder="Ask Me-Mo about this project…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={sending}
        />
        <button type="button" className="btn btn-primary memo-chat-send" onClick={send} disabled={sending || !input.trim()} aria-label="Send">
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
