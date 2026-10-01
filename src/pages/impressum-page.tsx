import { Link } from 'react-router-dom'
import { OpenLpmLogo } from '@/components/openlpm-logo'

// Real feedback 2a332362 (2026-10-01): "we also need an impressum and
// a data privacy page to make this all legal and GDPR compliant." This
// is NOT new legal content invented for OpenLPM -- it's the same real,
// already-published legal notice at openevo.net/app/impressum.html,
// which itself mirrors the authoritative one at eva.mpg.de/imprint (the
// same legal entity, same responsible institute, stands behind both
// sites). Only the "content responsible for this site" line changes to
// name OpenLPM specifically instead of openevo.net.
export default function ImpressumPage() {
  return (
    <div className="page page-narrow" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/" className="row" style={{ gap: 8, textDecoration: 'none' }}>
          <OpenLpmLogo size={22} style={{ color: 'var(--series-a)' }} />
          <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>OpenLPM</span>
        </Link>
      </div>
      <h1>Impressum</h1>
      <p className="muted">Legal notice, per German law (§5 TMG / Digitale-Dienste-Gesetz).</p>

      <p className="muted" style={{ fontSize: 13 }}>
        This page mirrors the legal notice already published for OpenEvo's work at{' '}
        <a href="http://openevo.eva.mpg.de" target="_blank" rel="noreferrer">openevo.eva.mpg.de</a>,
        itself part of the Max Planck Institute for Evolutionary Anthropology&apos;s site. The
        German original at{' '}
        <a href="https://www.eva.mpg.de/imprint/" target="_blank" rel="noreferrer">eva.mpg.de/imprint</a>{' '}
        is the legally authoritative version; this page is provided for convenience on OpenLPM.
      </p>

      <h2>Service provider</h2>
      <p>
        This service is provided by the <strong>Department of Comparative Cultural Psychology</strong>{' '}
        at the <strong>Max Planck Institute for Evolutionary Anthropology</strong>, part of the
        registered association <strong>Max Planck Society for the Advancement of Science e.V.</strong>
      </p>
      <p>
        Max-Planck-Gesellschaft zur Förderung der Wissenschaften e.V.<br />
        Hofgartenstrasse 8<br />
        D-80539 Munich, Germany<br />
        Phone: +49 (0) 89 - 2108 0<br />
        Internet: <a href="https://www.mpg.de" target="_blank" rel="noreferrer">www.mpg.de</a>
      </p>

      <h2>Register of societies and associations</h2>
      <p>
        The Max Planck Society is registered in the Official Register of Societies and
        Associations at Berlin-Charlottenburg Local Court under register number VR 13378 B.
      </p>

      <h2>Representatives</h2>
      <p>
        The Max Planck Society is legally represented by its Board of Directors, represented by
        the President of the Society, Prof. Dr. Patrick Cramer, and by Secretary General
        Dr. Simone Schwanitz.
      </p>

      <h2>Value added tax identification number</h2>
      <p>DE 129517720</p>

      <h2>Institute address</h2>
      <p>
        Max Planck Institute for Evolutionary Anthropology<br />
        Deutscher Platz 6<br />
        04103 Leipzig, Germany<br />
        Phone: +49 (341) 3550-0<br />
        Fax: +49 (341) 3550-119<br />
        E-mail: <a href="mailto:info@eva.mpg.de">info@eva.mpg.de</a>
      </p>

      <h2>Content responsible for OpenLPM</h2>
      <p>
        Dustin Eirdosh<br />
        Department of Comparative Cultural Psychology<br />
        Max Planck Institute for Evolutionary Anthropology<br />
        E-mail: <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a>
      </p>

      <h2>Legal structure</h2>
      <p>
        The Max Planck Society is a non-profit research organization, organized as a registered
        association. Its institutes, including this one, are largely autonomous in organization
        and research but generally have no separate legal capacity of their own.
      </p>

      <h2>Liability for content</h2>
      <p>
        As the provider of this content, the Max Planck Society is responsible for it under
        general legal provisions. Every effort is made to keep information accurate and current,
        but errors cannot be fully ruled out; no liability is assumed for the relevance, accuracy,
        completeness, or quality of the information provided, except where intent or gross
        negligence is proven.
      </p>

      <h2>Copyright</h2>
      <p>
        Layout and other original content on this site are protected by copyright. &copy;
        Max-Planck-Gesellschaft zur Förderung der Wissenschaften e.V., Munich, and the Department
        of Comparative Cultural Psychology, unless otherwise noted.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link to="/impressum">Impressum</Link> · <Link to="/privacy">Datenschutzerklärung / Privacy Policy</Link>
      </p>
    </div>
  )
}
