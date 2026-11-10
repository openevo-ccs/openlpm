import { useEffect, useRef, useState } from 'react'
import { Lock, Mail, Trash2, UserCheck, UserX } from 'lucide-react'
import type { createClient } from '@/lib/supabase/client'
import {
  confirmEmailsByHand,
  removeAccounts,
  resendConfirmationEmails,
  sendPasswordResetEmails,
  setUsersBlocked,
  type AdminAccountStatus,
  type AdminUserRow,
} from '@/lib/supabase/admin-users'

// Select-many tools for the admin Accounts list (2026-11-10). Added after a student on launch day
// said she could not sign in and had no confirmation email: the page could not even show whether
// an account was confirmed, and every fix had to be done one account at a time in the Supabase
// dashboard.

type Client = ReturnType<typeof createClient>

export type AccountState = 'unconfirmed' | 'never-signed-in' | 'signed-in' | 'unknown'

/** Where an account stands. 'unknown' when the confirmation data is not available (migration 239 not applied). */
export function accountState(status: Map<string, AdminAccountStatus> | null, userId: string): AccountState {
  if (!status) return 'unknown'
  const s = status.get(userId)
  if (!s) return 'unknown'
  if (!s.email_confirmed_at) return 'unconfirmed'
  if (!s.last_sign_in_at) return 'never-signed-in'
  return 'signed-in'
}

export type AccountFilter = 'all' | 'unconfirmed' | 'never-signed-in' | 'blocked' | 'no-project'

export const ACCOUNT_FILTERS: { key: AccountFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Everyone', hint: 'Every account' },
  { key: 'unconfirmed', label: 'Email not confirmed', hint: 'Signed up but never clicked the confirmation link' },
  { key: 'never-signed-in', label: 'Confirmed, never signed in', hint: 'Confirmed the email but has not signed in since' },
  { key: 'blocked', label: 'Blocked', hint: 'Accounts that are locked out' },
  { key: 'no-project', label: 'Not in any project', hint: 'Accounts without a project membership' },
]

export function matchesAccountFilter(
  filter: AccountFilter,
  user: AdminUserRow,
  status: Map<string, AdminAccountStatus> | null,
  membershipCount: number,
): boolean {
  switch (filter) {
    case 'all': return true
    case 'unconfirmed': return accountState(status, user.id) === 'unconfirmed'
    case 'never-signed-in': return accountState(status, user.id) === 'never-signed-in'
    case 'blocked': return !!user.blocked_at
    case 'no-project': return membershipCount === 0
  }
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Small chips for one row: confirmation and sign-in state. */
export function AccountStateChips({ status, userId }: { status: Map<string, AdminAccountStatus> | null; userId: string }) {
  const state = accountState(status, userId)
  const s = status?.get(userId)
  if (state === 'unknown') return null
  if (state === 'unconfirmed') {
    return <span className="chip chip-draft" title={s?.confirmation_sent_at ? `Confirmation email sent ${fmtDateTime(s.confirmation_sent_at)}` : 'No confirmation email recorded'}>Email not confirmed</span>
  }
  if (state === 'never-signed-in') {
    return <span className="chip chip-draft" title={`Confirmed ${s?.email_confirmed_at ? fmtDateTime(s.email_confirmed_at) : ''}, no sign-in since`}>Never signed in</span>
  }
  return <span className="muted" style={{ fontSize: 11.5 }}>last sign-in {s?.last_sign_in_at ? fmtDateTime(s.last_sign_in_at) : ''}</span>
}

export function AccountSelectBox({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
      style={{ marginTop: 3, flexShrink: 0 }}
    />
  )
}

export function AccountToolbar({
  visible,
  everyone,
  selected,
  setSelected,
  filter,
  setFilter,
  search,
  setSearch,
  status,
  statusMissing,
  selfId,
  supabase,
  onChanged,
}: {
  /** Accounts currently listed on the page, in order. Select all applies to these. */
  visible: AdminUserRow[]
  everyone: AdminUserRow[]
  selected: Set<string>
  setSelected: (next: Set<string>) => void
  filter: AccountFilter
  setFilter: (f: AccountFilter) => void
  search: string
  setSearch: (s: string) => void
  status: Map<string, AdminAccountStatus> | null
  statusMissing: boolean
  selfId: string | undefined
  supabase: Client
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; lines: string[] } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [checkedList, setCheckedList] = useState(false)
  const [typed, setTyped] = useState('')

  const selectable = visible.filter((u) => u.id !== selfId)
  const selectedVisible = selectable.filter((u) => selected.has(u.id))
  const allSelected = selectable.length > 0 && selectedVisible.length === selectable.length
  const someSelected = selectedVisible.length > 0 && !allSelected

  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  // The selection can include accounts that a filter has since hidden. Actions always run on the
  // whole selection and the count says so, so nothing happens to someone out of sight without
  // the number showing it.
  const chosen = everyone.filter((u) => selected.has(u.id) && u.id !== selfId)
  const chosenUnconfirmed = chosen.filter((u) => accountState(status, u.id) === 'unconfirmed')

  const toggleAll = () => {
    const next = new Set(selected)
    if (allSelected) for (const u of selectable) next.delete(u.id)
    else for (const u of selectable) next.add(u.id)
    setSelected(next)
  }

  const run = async (fn: () => Promise<{ kind: 'ok' | 'bad'; lines: string[] }>) => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await fn())
    } catch (e) {
      setMessage({ kind: 'bad', lines: [e instanceof Error ? e.message : 'Something went wrong.'] })
    }
    setBusy(false)
  }

  const summarizeEmails = (results: { email: string; error?: string }[], what: string) => {
    const failed = results.filter((r) => r.error)
    const sent = results.length - failed.length
    return {
      kind: failed.length === 0 ? ('ok' as const) : ('bad' as const),
      lines: [
        `${sent} ${what} email${sent === 1 ? '' : 's'} sent.`,
        ...failed.map((r) => `${r.email}: ${r.error}`),
      ],
    }
  }

  const sendConfirmation = () => {
    // Confirmation emails only make sense for accounts that are not confirmed yet. When the
    // confirmation data is missing, send to everyone chosen and let Supabase decide.
    const targets = status ? chosenUnconfirmed : chosen
    if (targets.length === 0) {
      setMessage({ kind: 'bad', lines: ['None of the chosen accounts is waiting for confirmation. Use "Send password reset" for people who are confirmed but cannot sign in.'] })
      return
    }
    const skipped = chosen.length - targets.length
    if (!window.confirm(`Send the confirmation email again to ${targets.length} account${targets.length === 1 ? '' : 's'}?${skipped ? `\n\n${skipped} chosen account${skipped === 1 ? ' is' : 's are'} already confirmed and will be left out.` : ''}`)) return
    run(async () => {
      const res = summarizeEmails(await resendConfirmationEmails(supabase, targets.map((u) => u.email)), 'confirmation')
      if (skipped) res.lines.push(`${skipped} already confirmed, left out.`)
      return res
    })
  }

  const sendReset = () => {
    if (chosen.length === 0) return
    if (!window.confirm(`Send a "set a new password" email to ${chosen.length} account${chosen.length === 1 ? '' : 's'}?\n\nThe link also confirms their email address, so it is the quickest way back in for someone who is stuck.`)) return
    run(async () => summarizeEmails(await sendPasswordResetEmails(supabase, chosen.map((u) => u.email)), 'password-reset'))
  }

  const confirmByHand = () => {
    const targets = status ? chosenUnconfirmed : chosen
    if (targets.length === 0) {
      setMessage({ kind: 'bad', lines: ['None of the chosen accounts is waiting for confirmation.'] })
      return
    }
    if (!window.confirm(`Mark the email address of ${targets.length} account${targets.length === 1 ? '' : 's'} as confirmed?\n\nThey can then sign in with the password they chose, without clicking any link. Only do this when you know the address belongs to them.`)) return
    run(async () => {
      const { changed, error } = await confirmEmailsByHand(supabase, targets.map((u) => u.id))
      if (error) return { kind: 'bad' as const, lines: [error] }
      onChanged()
      return { kind: 'ok' as const, lines: [`${changed} account${changed === 1 ? '' : 's'} confirmed. They can sign in now.`] }
    })
  }

  const block = (blocked: boolean) => {
    if (chosen.length === 0) return
    if (!window.confirm(blocked
      ? `Block ${chosen.length} account${chosen.length === 1 ? '' : 's'} from signing in? Nothing is deleted and you can undo it.`
      : `Let ${chosen.length} account${chosen.length === 1 ? '' : 's'} sign in again?`)) return
    run(async () => {
      const { error } = await setUsersBlocked(supabase, chosen.map((u) => u.id), blocked)
      if (error) return { kind: 'bad' as const, lines: [error.message] }
      onChanged()
      return { kind: 'ok' as const, lines: [`${chosen.length} account${chosen.length === 1 ? '' : 's'} ${blocked ? 'blocked' : 'unblocked'}.`] }
    })
  }

  const closeRemove = () => {
    setRemoving(false)
    setCheckedList(false)
    setTyped('')
  }

  const doRemove = () => {
    const ids = chosen.map((u) => u.id)
    run(async () => {
      const { results, error } = await removeAccounts(supabase, ids)
      closeRemove()
      if (error) return { kind: 'bad' as const, lines: [error] }
      const removed = results.filter((r) => r.outcome === 'removed')
      const skipped = results.filter((r) => r.outcome === 'skipped')
      const byId = new Map(everyone.map((u) => [u.id, u]))
      const next = new Set(selected)
      for (const r of removed) next.delete(r.account_id)
      setSelected(next)
      onChanged()
      return {
        kind: skipped.length === 0 ? ('ok' as const) : ('bad' as const),
        lines: [
          `${removed.length} account${removed.length === 1 ? '' : 's'} removed.`,
          ...skipped.map((r) => `Left in place: ${byId.get(r.account_id)?.email ?? r.account_id}. ${r.detail}`),
        ],
      }
    })
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
          <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} aria-label="Select all listed accounts" />
          {allSelected ? 'Select none' : 'Select all'} ({selectable.length} listed)
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          aria-label="Search accounts"
          style={{ fontSize: 12.5, minWidth: 200 }}
        />
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {ACCOUNT_FILTERS.map((f) => {
          const unavailable = statusMissing && (f.key === 'unconfirmed' || f.key === 'never-signed-in')
          return (
            <button
              key={f.key}
              type="button"
              className={`btn btn-mini${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
              disabled={unavailable}
              title={unavailable ? 'Needs the database update from migration 239' : f.hint}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {statusMissing && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Email confirmation and sign-in times are not available yet. They appear once the database update (migration 239) has been applied.
        </p>
      )}

      {selected.size > 0 && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 8, position: 'sticky', top: 0, zIndex: 5 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>{chosen.length} selected</strong>
            <button className="btn btn-mini" onClick={() => setSelected(new Set())} disabled={busy}>Clear</button>
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
            <button className="btn btn-mini" onClick={sendConfirmation} disabled={busy || chosen.length === 0} title="Send the sign-up confirmation email again (only accounts that are not confirmed yet)">
              <Mail size={11} />Send confirmation email{status ? ` (${chosenUnconfirmed.length})` : ''}
            </button>
            <button className="btn btn-mini" onClick={sendReset} disabled={busy || chosen.length === 0} title="Send a link to choose a new password. The link also confirms the email address.">
              <Lock size={11} />Send password reset
            </button>
            <button className="btn btn-mini" onClick={confirmByHand} disabled={busy || chosen.length === 0 || statusMissing} title={statusMissing ? 'Needs the database update from migration 239' : 'Mark the email as confirmed without a link, for people whose email never arrives'}>
              <UserCheck size={11} />Confirm email by hand
            </button>
            <button className="btn btn-mini" onClick={() => block(true)} disabled={busy || chosen.length === 0} title="Lock these accounts out. Nothing is deleted.">
              <UserX size={11} />Block
            </button>
            <button className="btn btn-mini" onClick={() => block(false)} disabled={busy || chosen.length === 0}>
              <UserCheck size={11} />Unblock
            </button>
            <button className="btn btn-mini btn-danger" onClick={() => setRemoving(true)} disabled={busy || chosen.length === 0 || statusMissing} title={statusMissing ? 'Needs the database update from migration 239' : 'Delete these accounts for good'}>
              <Trash2 size={11} />Remove…
            </button>
          </div>
        </div>
      )}

      {removing && (
        <div className="card" style={{ borderColor: 'var(--critical)', marginBottom: 10 }}>
          <h3 className="row" style={{ color: 'var(--critical)' }}><Trash2 size={16} />Remove {chosen.length} account{chosen.length === 1 ? '' : 's'} for good?</h3>
          <p style={{ fontSize: 13, margin: '6px 0' }}>
            This cannot be undone. Each account is deleted together with everything saved under it: work entries, notebooks, memberships, favourites and groups.
            Saved prompts, discussion posts and activity-log rows are deleted too. Feedback comments stay, without the name.
          </p>
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>
            Left in place automatically, with the reason shown afterwards: admin accounts, your own account, accounts with an open deletion request and accounts with feedback screenshots.
            Use the deletion script for those.
          </p>
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', margin: '8px 0', fontSize: 12.5 }}>
            {chosen.map((u) => (
              <div key={u.id}>
                <strong>{u.name || '(no name)'}</strong> <span className="muted">{u.email}</span>
                {u.role === 'admin' && <span className="chip chip-progress" style={{ marginLeft: 6 }}>Admin, will be left in place</span>}
              </div>
            ))}
          </div>
          <label className="row" style={{ gap: 6, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={checkedList} onChange={(e) => setCheckedList(e.target.checked)} />
            I have read the list above and these are the right people.
          </label>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type REMOVE to confirm"
              aria-label="Type REMOVE to confirm"
              style={{ fontSize: 13 }}
              disabled={!checkedList}
            />
            <button className="btn btn-danger" disabled={busy || !checkedList || typed.trim() !== 'REMOVE'} onClick={doRemove}>
              {busy ? 'Removing…' : `Remove ${chosen.length} account${chosen.length === 1 ? '' : 's'} permanently`}
            </button>
            <button className="btn" disabled={busy} onClick={closeRemove}>Cancel</button>
          </div>
        </div>
      )}

      {message && (
        <div className={`notice notice-${message.kind}`} style={{ display: 'block' }} role="status">
          {message.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
