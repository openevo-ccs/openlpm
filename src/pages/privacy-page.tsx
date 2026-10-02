import { Link } from 'react-router-dom'
import { OpenLpmLogo } from '@/components/openlpm-logo'

// Real feedback 2a332362 (2026-10-01): same ask as impressum-page.tsx.
// Unlike the Impressum, this is NOT a straight port of openevo.net's own
// privacy page -- that page describes a plain static site with "no
// cookies, no accounts, no login", which is simply false for OpenLPM:
// this is a real multi-tenant app with real sign-in (Supabase Auth,
// email+password or GitHub), a real Postgres database holding names,
// emails, project memberships and submitted feedback (including
// screenshots), and a real browser-stored session token. Copying the
// other page's text here would have made this LESS accurate, not more --
// so this describes OpenLPM's own actual setup instead, checked directly
// against the real code (src/lib/supabase/*, feedback-widget.tsx) rather
// than assumed. Same honest framing openevo.net's own page already uses:
// marked as a draft until an actual data protection officer or lawyer
// reviews it, not represented as finished legal advice.
export default function PrivacyPage() {
  return (
    <div className="page page-narrow" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/" className="row" style={{ gap: 8, textDecoration: 'none' }}>
          <OpenLpmLogo size={22} style={{ color: 'var(--series-a)' }} />
          <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>OpenLPM</span>
        </Link>
      </div>
      <h1>Privacy Policy</h1>
      <p className="muted">Datenschutzerklärung — what actually happens on OpenLPM.</p>

      <div className="notice notice-bad" style={{ alignItems: 'flex-start' }}>
        <div>
          <strong>Draft. Not yet reviewed by a data protection officer.</strong> This describes
          OpenLPM&apos;s actual technical setup as built, in plain terms — it has not been checked
          by the institute&apos;s Datenschutzbeauftragte(r) or a lawyer. Please have it reviewed
          before treating it as final. It replaces, for this specific service, the general{' '}
          <a href="https://www.eva.mpg.de/privacy-policy/" target="_blank" rel="noreferrer">
            eva.mpg.de privacy policy
          </a>, which covers the institute&apos;s own WordPress-based sites and does not describe
          this app&apos;s own setup.
        </div>
      </div>

      <h2>Who is responsible</h2>
      <p>
        OpenLPM is maintained by Dustin Eirdosh, Department of Comparative Cultural Psychology,
        Max Planck Institute for Evolutionary Anthropology. Contact:{' '}
        <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a>. See the{' '}
        <Link to="/impressum">Impressum</Link> for the full legal entity details.
      </p>

      <h2>Accounts and sign-in</h2>
      <p>
        Creating an account requires an email address and a password (handled by Supabase Auth,
        OpenLPM&apos;s authentication provider — your password itself is never visible to us, only
        to Supabase). You can also sign in with a GitHub account instead. Staying signed in works
        by storing a session token in your browser&apos;s own local storage. This isn&apos;t a
        tracking cookie — it identifies your session to OpenLPM only, and is cleared when you sign out.
      </p>

      <h2>What we store about you</h2>
      <p>
        Once you have an account: your name and email address, which project spaces you belong to
        and with what role, and anything you actually contribute — curriculum content, notes,
        discussion posts — inside the project spaces you join. If you use the in-app Feedback
        button, we also store the comment you write, which page you were on, a short excerpt of
        that page&apos;s visible text, a short list of pages you recently visited in that session,
        and — if you attach one — a screenshot image. All of this is held in OpenLPM&apos;s own
        database and file storage (provided by Supabase). It is never shared with any other OpenEvo app.
      </p>

      <h2>Hosting</h2>
      <p>
        The app itself (the pages you load in your browser) is a static site hosted on{' '}
        <strong>GitHub Pages</strong> (GitHub, Inc. / GitHub B.V.) — like any web server, GitHub's
        servers process your device's IP address and request details automatically, for serving
        the page and for security purposes. The actual data described above (accounts, content,
        feedback) is stored separately, by <strong>Supabase</strong> (Supabase, Inc.), the
        database and authentication provider OpenLPM runs on. See{' '}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">
          GitHub&apos;s own privacy statement
        </a>{' '}
        and{' '}
        <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
          Supabase&apos;s own privacy policy
        </a>{' '}
        for how each handles this.
      </p>

      <h2>No analytics, no third-party tracking</h2>
      <p>
        OpenLPM runs no visitor-analytics or advertising/tracking script of its own. Nothing you
        do here is recorded by any party beyond OpenLPM&apos;s own database (described above) and
        the ordinary server access logs described under Hosting.
      </p>

      <h2>Links to other sites</h2>
      <p>
        OpenLPM links out to GitHub repositories and partner institutions. Each of those operates
        under its own privacy policy — this page doesn&apos;t cover them.
      </p>

      <h2>Your rights</h2>
      <p>
        Under GDPR, you have the right to access, correct, or request deletion of personal data
        concerning you, and to object to its processing. You can delete your own contributed
        content and leave a project yourself from inside the app; for anything else — including
        deleting your account entirely — contact{' '}
        <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a>, or the
        institute&apos;s own data protection contact for matters concerning the Max Planck
        Institute for Evolutionary Anthropology more broadly.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link to="/impressum">Impressum</Link> · <Link to="/privacy">Datenschutzerklärung / Privacy Policy</Link>
      </p>
    </div>
  )
}
