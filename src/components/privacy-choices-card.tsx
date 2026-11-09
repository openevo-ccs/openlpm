import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyAiOptOut,
  getMyLatestDeletionRequest,
  requestMyDeletion,
  setMyAiOptOut,
  withdrawMyDeletionRequest,
  type DeletionRequest,
} from '@/lib/supabase/privacy-settings'

// The two privacy choices a person can make for themselves, in German and English:
// keep their data away from outside AI services, and ask for their account and data to be
// deleted. The wording matches /privacy (src/pages/privacy-page.tsx, sections 6, 9 and 10).
// Keep the three in step. Written for students and anyone else with an account.

const fmt = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

export function PrivacyChoicesCard() {
  const supabase = useMemo(() => createClient(), [])
  const [optOut, setOptOut] = useState<boolean | null>(null)
  const [request, setRequest] = useState<DeletionRequest | null | undefined>(undefined)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')

  const reloadRequest = () => getMyLatestDeletionRequest(supabase).then(setRequest)

  useEffect(() => {
    getMyAiOptOut(supabase).then(setOptOut)
    reloadRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const toggle = async (next: boolean) => {
    setBusy(true)
    setNotice(null)
    const { error } = await setMyAiOptOut(supabase, next)
    setBusy(false)
    if (error) {
      setNotice({ kind: 'bad', text: `Konnte nicht gespeichert werden / Could not save: ${error.message}` })
      return
    }
    setOptOut(next)
    setNotice({
      kind: 'ok',
      text: next
        ? 'Gespeichert. Deine Daten bleiben ab jetzt aus KI-Auswertungen heraus. / Saved. Your data stays out of AI analysis from now on.'
        : 'Gespeichert. Die KI-Verarbeitung ist wieder erlaubt. / Saved. AI processing is allowed again.',
    })
  }

  const submitRequest = async () => {
    setBusy(true)
    setNotice(null)
    const { error } = await requestMyDeletion(supabase, reason)
    setBusy(false)
    if (error) {
      setNotice({ kind: 'bad', text: `Die Anfrage konnte nicht gesendet werden / The request could not be sent: ${error.message}` })
      return
    }
    setConfirming(false)
    setReason('')
    await reloadRequest()
    setNotice({ kind: 'ok', text: 'Deine Anfrage ist eingegangen. / We received your request.' })
  }

  const withdraw = async (id: string) => {
    setBusy(true)
    const { error } = await withdrawMyDeletionRequest(supabase, id)
    setBusy(false)
    if (error) {
      setNotice({ kind: 'bad', text: `Konnte nicht zurückgezogen werden / Could not withdraw: ${error.message}` })
      return
    }
    await reloadRequest()
    setNotice({ kind: 'ok', text: 'Deine Anfrage ist zurückgezogen. / Your request is withdrawn.' })
  }

  const open = request?.status === 'open' ? request : null

  return (
    <div className="card" id="datenschutz">
      <h3 className="row"><ShieldCheck size={16} />Datenschutz / Privacy</h3>
      {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}

      <label className="row" style={{ alignItems: 'flex-start', gap: 10, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={!!optOut}
          disabled={optOut === null || busy}
          onChange={(e) => toggle(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <strong>Ich möchte nicht, dass meine Daten von externen KI-Diensten verarbeitet werden.</strong>
          <br />
          <span className="muted" style={{ fontSize: 12.5 }}>
            Deine Rückmeldungen, Arbeitseinträge, dein Aktivitätsverlauf, gespeicherte Prompts und Notizbücher werden dann
            an keinen externen KI-Dienst gesendet. Daten, die niemandem mehr zugeordnet werden können (zum Beispiel
            Zahlen und Statistiken), sind davon ausgenommen. Das Seminarteam kann deine Arbeit weiter lesen. Die
            Einstellung gilt ab jetzt und hat keinen Einfluss auf deine Note.
          </span>
        </span>
      </label>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 6, marginLeft: 30 }}>
        I do not want my data processed by outside AI services. Your feedback, work entries, activity timeline, saved
        prompts and notebooks are then never sent to an outside AI service. Data that can no longer be traced to anyone
        (for example counts and statistics) is excluded. The seminar team can still read your work. This applies from
        now on and has no effect on your grade.
      </p>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
        <h4 className="row" style={{ marginTop: 0 }}><Trash2 size={14} />Konto und Daten löschen lassen / Delete my account and data</h4>

        {request === undefined ? (
          <p className="muted">Lädt… / Loading…</p>
        ) : open ? (
          <>
            <p>
              Deine Löschanfrage vom {fmt(open.requested_at)} ist eingegangen. Wir erledigen sie bis spätestens{' '}
              <strong>{fmt(open.due_at)}</strong>.
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              Your deletion request of {fmt(open.requested_at)} was received. We will complete it by {fmt(open.due_at)} at the latest.
            </p>
            <button type="button" className="btn btn-mini" disabled={busy} onClick={() => withdraw(open.id)}>
              Anfrage zurückziehen / Withdraw request
            </button>
          </>
        ) : (
          <>
            {request && request.status !== 'withdrawn' && (
              <p className="muted" style={{ fontSize: 12.5 }}>
                Letzte Anfrage / Last request: {fmt(request.requested_at)} ({request.status === 'done' ? 'erledigt / done' : 'abgelehnt / declined'}).
              </p>
            )}
            <p>
              Du kannst beantragen, dass wir dein Konto und alle Daten löschen, die mit dir verbunden sind: Name,
              E-Mail-Adresse, Arbeitseinträge, Aktivitätsverlauf, Notizbücher, gespeicherte Prompts und angehängte
              Bildschirmfotos. Wir antworten innerhalb eines Monats. Das Löschen lässt sich nicht rückgängig machen.
              Was du bereits in Moodle abgegeben hast, liegt bei der Universität und kann von hier aus nicht gelöscht werden.
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              You can ask us to delete your account and everything tied to you: name, email address, work entries,
              activity timeline, notebooks, saved prompts and attached screenshots. We answer within one month.
              Deletion cannot be undone. Documents you already handed in on Moodle belong to the university and cannot
              be deleted from here.
            </p>
            {!confirming ? (
              <button type="button" className="btn btn-mini" disabled={busy} onClick={() => setConfirming(true)}>
                Löschung beantragen / Request deletion
              </button>
            ) : (
              <div>
                <label className="muted" style={{ fontSize: 12.5 }}>
                  Grund (freiwillig) / Reason (optional)
                  <textarea
                    value={reason}
                    maxLength={1000}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                    rows={2}
                  />
                </label>
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-primary btn-mini" disabled={busy} onClick={submitRequest}>
                    Ja, Konto und Daten löschen lassen / Yes, delete my account and data
                  </button>
                  <button type="button" className="btn btn-mini" disabled={busy} onClick={() => setConfirming(false)}>
                    Abbrechen / Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        <Link to="/privacy?lang=de">Datenschutzerklärung</Link> · <Link to="/privacy?lang=en">Privacy Policy</Link>
      </p>
    </div>
  )
}
