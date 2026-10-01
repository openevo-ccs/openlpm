// Hands a generated prompt straight to Me-Mo instead of making someone copy
// and paste it by hand. Reuses the exact mechanism Me-Mo's own Android widget
// already uses to resume a conversation started elsewhere: mint a
// "widget-<uuid>" session id, record the first message under it via Me-Mo's
// own /api/orchestrate, then open Me-Mo at "#continue=<id>" so its own page
// picks the conversation up (me-mo/android_app/me-mo-app/js/app.js's
// continueFromWidget(), me-mo/android_app/server/session_log.py's
// WIDGET_ID_RE). No change to Me-Mo's own code is needed -- this sends the
// same request shape its widget already sends.
//
// Real, current constraint, not a bug: Me-Mo's chat API has no public
// address today. It only answers on Dustin's private Tailscale network
// (home-server.tail806c34.ts.net:8010, confirmed in Me-Mo's own
// android_app/me-mo-widget-app/.../core/Server.java). Anyone not on that
// network gets a clear, honest failure here, not a silent one or a fake
// success.
const MEMO_BASE_URL = (import.meta.env.VITE_MEMO_BASE_URL as string | undefined) || 'https://home-server.tail806c34.ts.net:8010'

const RESPONSE_TIMEOUT_MS = 60_000

export type MemoBridgeError = { kind: 'unreachable' | 'timeout' | 'server_error' | 'popup_blocked'; status?: number }

// Opens the destination tab synchronously, before any network call --
// browsers only allow window.open() without silently blocking it as a
// pop-up when it happens in the same tick as the click. Call this first,
// directly from the button's onClick, then pass the handle it returns into
// sendPromptToMeMo() below once Me-Mo's reply is actually ready to show.
// (Deliberately not using 'noopener'/'noreferrer': both make window.open()
// return null, which would leave nothing to navigate later. Me-Mo is a
// lab-owned destination, not an arbitrary third-party link.)
export function openMeMoTab(): Window | null {
  return window.open('about:blank', '_blank')
}

export async function sendPromptToMeMo(promptText: string, target: Window): Promise<void> {
  const widgetId = `widget-${crypto.randomUUID()}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${MEMO_BASE_URL}/api/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: widgetId, messages: [{ role: 'user', content: promptText }], voice: false }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timeout)
    target.close()
    const err: MemoBridgeError = { kind: (e as Error).name === 'AbortError' ? 'timeout' : 'unreachable' }
    throw err
  }
  clearTimeout(timeout)

  if (!res.ok) {
    target.close()
    const err: MemoBridgeError = { kind: 'server_error', status: res.status }
    throw err
  }

  // Read the response to completion before navigating the tab: Me-Mo only
  // finishes recording this turn once its own generation loop ends
  // (server.py's run_orchestration), and /api/continue needs that done --
  // otherwise the tab can open to an empty or half-written conversation.
  await res.text()
  target.location.href = `${MEMO_BASE_URL}/#continue=${widgetId}`
}
