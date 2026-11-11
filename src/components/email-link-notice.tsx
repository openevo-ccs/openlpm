import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/state/session'

// What a person sees after opening the link in a confirmation or password-reset email when
// the sign-in did not happen by itself.
//
// OpenLPM signs people in with a one-time code (PKCE). The code only works in the browser that
// asked for it. Someone who registers on a laptop and opens the email on a phone confirms their
// address, then lands on the plain homepage with no message (seen 2026-11-09, launch day of the
// Jena seminar). A link that expired, or was opened once already (some mail programs open links
// before the person does), comes back with an error in the address and also showed nothing.
//
// The address is read once, when this file loads. Supabase removes the code from the address
// while it works, so reading it later would find nothing.

type Arrival = 'code' | 'error' | null

const arrival: Arrival = (() => {
  if (typeof window === 'undefined') return null
  if (new URLSearchParams(window.location.search).has('code')) return 'code'
  const hash = window.location.hash
  if (/[#&?](error_code|error)=/.test(hash)) return 'error'
  return null
})()

const JENA_WELCOME = '/willkommen/evomentor-thuringia?mode=signin'

export function EmailLinkNotice() {
  const { session, loading } = useSession()
  const [dismissed, setDismissed] = useState(false)
  const show = arrival !== null && !loading && !session && !dismissed

  useEffect(() => {
    if (!show) return
    // Take the leftover code out of the address so a reload does not show this again.
    const url = new URL(window.location.href)
    if (url.searchParams.has('code')) {
      url.searchParams.delete('code')
      window.history.replaceState(null, '', url.toString())
    }
  }, [show])

  if (!show) return null

  const close = () => setDismissed(true)

  return (
    <div
      role="alertdialog"
      aria-labelledby="email-link-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        {arrival === 'code' ? (
          <>
            <h2 id="email-link-title" style={{ marginTop: 0 }}>Der Link aus deiner E-Mail wurde geöffnet</h2>
            <p>
              <strong>Wenn du deine E-Mail-Adresse bestätigen wolltest:</strong> Das hat geklappt. Weil du den Link in einem
              anderen Browser oder auf einem anderen Gerät geöffnet hast als bei der Registrierung, musst du dich jetzt
              einmal mit deiner E-Mail-Adresse und deinem Passwort anmelden.
            </p>
            <p>
              <strong>Wenn du ein neues Passwort setzen wolltest:</strong> Dieser Link funktioniert nur in dem Browser, in dem
              du das Zurücksetzen angefordert hast. Fordere es dort noch einmal an und öffne den Link im selben Browser.
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              The link from your email was opened. If you wanted to confirm your email address, that worked. Because you opened
              the link in a different browser or on a different device than the one you registered on, sign in once with your
              email address and password. If you wanted to reset your password, the link only works in the browser where you
              asked for the reset. Ask for it again there and open the link in the same browser.
            </p>
          </>
        ) : (
          <>
            <h2 id="email-link-title" style={{ marginTop: 0 }}>Der Link aus deiner E-Mail hat nicht funktioniert</h2>
            <p>
              Er ist abgelaufen oder wurde schon einmal geöffnet. Manche Mail-Programme öffnen Links vorab, und ein Link
              gilt nur eine Stunde. Probiere zuerst, dich anzumelden: Oft ist die E-Mail-Adresse trotzdem schon bestätigt.
              Wenn die Anmeldung nicht klappt, wende dich an die Seminarleitung.
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              The link from your email did not work. It expired or was already opened once (some mail programs open links
              before you do), and a link is valid for one hour. Try signing in first: your address is often confirmed
              anyway. If signing in does not work, contact the seminar leader.
            </p>
          </>
        )}
        <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
          <Link to={JENA_WELCOME} className="btn btn-primary" onClick={close}>
            Anmelden (EvoMentor Jena)
          </Link>
          <Link to="/auth/login" className="btn" onClick={close}>
            Andere Anmeldung / Other sign-in
          </Link>
          <button type="button" className="btn btn-mini" onClick={close}>
            Schließen / Close
          </button>
        </div>
      </div>
    </div>
  )
}
