import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OpenLpmLogo } from '@/components/openlpm-logo'

// Full privacy statement in German and English (rewritten 2026-11-09 for the Uni Jena
// EvoMentor seminar, after students asked to be able to keep their data away from outside AI
// services). It describes the setup as built, checked against the code and the database
// migrations: accounts (Supabase Auth, emails sent through the lab's Google Workspace mailbox
// noreply@openevo.net), the student-work tables (migration 192), feedback (migration 026),
// the opt-out table (migration 238) and the project's data region (eu-central-1, Frankfurt).
//
// Reviewed and approved by Dustin Eirdosh on 2026-11-09. Keep both language versions in step:
// a change to one is a change to the other.
//
// The page opens in German for browsers set to German, in English otherwise. A link can force
// one: /privacy?lang=de or /privacy?lang=en.

type Lang = 'de' | 'en'

const LAST_UPDATED = { de: '9. November 2026', en: '9 November 2026' }

function initialLanguage(param: string | null): Lang {
  if (param === 'de' || param === 'en') return param
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')) return 'de'
  return 'en'
}

export default function PrivacyPage() {
  const [searchParams] = useSearchParams()
  const [lang, setLang] = useState<Lang>(() => initialLanguage(searchParams.get('lang')))

  return (
    <div className="page page-narrow" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 16 }} className="row">
        <Link to="/" className="row" style={{ gap: 8, textDecoration: 'none' }}>
          <OpenLpmLogo size={22} style={{ color: 'var(--series-a)' }} />
          <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>OpenLPM</span>
        </Link>
        <span style={{ marginLeft: 'auto' }} className="row">
          <button
            type="button"
            className={`btn btn-mini${lang === 'de' ? ' btn-primary' : ''}`}
            aria-pressed={lang === 'de'}
            onClick={() => setLang('de')}
          >
            Deutsch
          </button>
          <button
            type="button"
            className={`btn btn-mini${lang === 'en' ? ' btn-primary' : ''}`}
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
          >
            English
          </button>
        </span>
      </div>

      {lang === 'de' ? <PrivacyDe /> : <PrivacyEn />}

      <p style={{ marginTop: 24 }}>
        <Link to="/impressum">Impressum</Link> · <Link to="/privacy">Datenschutzerklärung / Privacy Policy</Link>
      </p>
    </div>
  )
}

function PrivacyEn() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated {LAST_UPDATED.en}. The German version is the one to read if the two ever seem to differ.</p>

      <p>
        This text describes how OpenLPM is built and what it does with your data. It applies to OpenLPM. The institute&apos;s
        own websites are covered by the{' '}
        <a href="https://www.eva.mpg.de/privacy-policy/" target="_blank" rel="noreferrer">
          eva.mpg.de privacy policy
        </a>
        .
      </p>

      <h2>1. The short version</h2>
      <ul>
        <li>OpenLPM stores your name, your email address, your password (in scrambled form) and what you enter in the spaces you join.</li>
        <li>The data sits on a server in Frankfurt, Germany.</li>
        <li>There is no advertising and no visitor tracking.</li>
        <li>
          The app has no AI feature that sends your data anywhere. The team does use outside AI services to help read
          feedback and analyse work. <strong>You can switch that off for your data</strong> under Profile, in the box
          &quot;AI processing&quot;. Section 6 explains exactly what it covers.
        </li>
        <li>You can see, correct and delete your data, and you can ask us to do it for you (section 10).</li>
      </ul>

      <h2>2. Who is responsible</h2>
      <p>
        The Max Planck Society for the Advancement of Science e.V. (Hofgartenstrasse 8, 80539 Munich) is the
        provider of OpenLPM. The service is run by Dustin Eirdosh, Department of Comparative Cultural Psychology,
        Max Planck Institute for Evolutionary Anthropology, Deutscher Platz 6, 04103 Leipzig. Contact:{' '}
        <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a>. The full provider details are in the{' '}
        <Link to="/impressum">Impressum</Link>. For questions about data protection you can also contact the data
        protection officer of the Max Planck Society through the institute.
      </p>
      <p>
        For the EvoMentor seminar at the University of Jena, the seminar leader (Susan Hanisch) works in OpenLPM
        together with the OpenEvo team. The people who can see your work are listed in section 5.
      </p>

      <h2>3. What we store</h2>
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Data</th>
            <th style={{ textAlign: 'left' }}>What it contains</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account</td>
            <td>Name, email address, password (stored scrambled by Supabase Auth, never readable by us), the date you signed up, your role.</td>
          </tr>
          <tr>
            <td>Memberships</td>
            <td>Which project spaces you belong to and with which role, and how you joined.</td>
          </tr>
          <tr>
            <td>Your work</td>
            <td>
              What you enter in a space: for example saved learning goals, your judgments of suggested links,
              cross-cutting themes, reflections, notebooks, discussion posts, groups, and the name you enter for the
              hand-in file.
            </td>
          </tr>
          <tr>
            <td>Your activity timeline</td>
            <td>
              In the Jena seminar space, a list of the pages you opened and the steps you took. You see it yourself and
              put it in the process file you hand in. The seminar leader can read it too.
            </td>
          </tr>
          <tr>
            <td>Saved prompts</td>
            <td>
              Prompts you generate and save in the AI prompt generator, with the notes and the AI answer you paste
              back in, if you choose to.
            </td>
          </tr>
          <tr>
            <td>Feedback</td>
            <td>
              If you use the Feedback button: your comment, the page you were on, a short excerpt of the visible text
              of that page, a short list of pages you visited just before, and a screenshot if you attach one.
            </td>
          </tr>
          <tr>
            <td>Your privacy choice</td>
            <td>Whether you switched on &quot;AI processing: opt out&quot; (section 6).</td>
          </tr>
          <tr>
            <td>Deletion requests</td>
            <td>The date of a request to delete your account, the date we answer by, and the reason if you give one (section 10).</td>
          </tr>
          <tr>
            <td>Technical data</td>
            <td>
              Your device&apos;s IP address and request details in the server logs of the hosting providers (section 7),
              and a sign-in token in your browser&apos;s local storage so you stay signed in.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>4. Why we use it, and on what legal basis</h2>
      <ul>
        <li>
          <strong>Running your account and the spaces you join</strong> (Art. 6(1)(b) GDPR: providing the service you
          signed up for).
        </li>
        <li>
          <strong>Keeping the service secure and working</strong>, including server logs (Art. 6(1)(f): our
          legitimate interest in a safe service).
        </li>
        <li>
          <strong>Feedback and screenshots</strong> are used to fix problems and improve OpenLPM. You choose what to
          write and whether to attach a screenshot (Art. 6(1)(a): your consent, given when you send it).
        </li>
        <li>
          <strong>The seminar.</strong> Your work in the seminar space is used to run the seminar and to give you
          feedback (Art. 6(1)(b): the seminar work you signed up for).
        </li>
        <li>
          <strong>Research.</strong> If your individual work is ever to be used in research, we will ask you for your
          separate consent first.
        </li>
        <li>
          <strong>Answering your requests</strong>, such as a deletion request, and keeping a record that we answered
          in time (Art. 6(1)(c): our legal duty to respond to your rights).
        </li>
        <li>
          <strong>Anonymized data</strong> is no longer personal data, so no legal basis is needed for it (see section 6).
        </li>
      </ul>

      <h2>5. Who can see what</h2>
      <ul>
        <li>
          <strong>Other students</strong> see your name in a group list. They see only the part of your work you share
          with your group. They never see your email address, your reflections or your participant name.
        </li>
        <li>
          <strong>The seminar leader and the project owners</strong> can read all work in the seminar space, including
          the activity timeline.
        </li>
        <li>
          <strong>OpenEvo administrators</strong> can see accounts and content across spaces, which they need to run the
          service and answer feedback.
        </li>
        <li>
          Feedback is read by the OpenEvo team only. Other users cannot browse it.
        </li>
      </ul>

      <h2>6. AI processing, and how to opt out</h2>
      <p>
        <strong>What the app does.</strong> OpenLPM itself does not send what you enter to any AI service. The chat
        assistant for the app is switched off.
      </p>
      <p>
        <strong>What the team does.</strong> Members of the OpenEvo team use AI assistants and language models from
        outside providers to maintain the platform and to help read and sort feedback and student work, for example
        Claude from Anthropic, and language models run by the GWDG, a German academic computing centre. To do this,
        the text you wrote can be sent to those providers. We do not use your contributions to train AI models.
      </p>
      <p>
        <strong>Your choice.</strong> Open <Link to="/dashboard/profile">Profile</Link> and tick &quot;I do not want
        my data processed by outside AI services&quot;. From that moment:
      </p>
      <ul>
        <li>
          Your feedback, your work entries, your activity timeline, your saved prompts and your notebook content are
          left out of every AI-assisted analysis and are never sent to an outside AI service.
        </li>
        <li>
          The scripts the team uses to read feedback and project content check this setting and hide your text from the
          AI assistant. People can still read your contributions, as described in section 5.
        </li>
        <li>
          You can change your mind at any time. The switch applies from the moment you change it. If you want us to
          check what was processed before you switched it on, write to us and we will tell you what we find.
        </li>
        <li>Choosing to opt out has no effect on your grade or your place in the seminar.</li>
      </ul>
      <p>
        <strong>What the opt-out does not cover.</strong> Data that has been anonymized is no longer personal data, so
        the opt-out does not apply to it. Anonymized means that nobody, including us, can tell who the data came from.
        Examples are counts of how many people used a page or averages over many people. We use data like this for the
        normal running and improvement of OpenLPM. Data that only has your name taken off is not anonymized if it can
        still be linked back to you, for example through an account number, a typical phrase or a very small group.
        The opt-out covers such data. Free text is hard to anonymize, so we treat what you write as personal data
        unless a person has removed every detail that points to you and checked the result.
      </p>
      <p>
        <strong>Your own use of AI tools.</strong> The AI prompt generator builds a text that you may copy into an AI
        tool you choose yourself. What you paste there is between you and that provider, under its terms. Do not paste
        personal data about yourself or others into it.
      </p>

      <h2>7. Companies that process data for us</h2>
      <ul>
        <li>
          <strong>Supabase, Inc.</strong> runs the database and the sign-in. Your data is stored in Frankfurt, Germany
          (AWS region eu-central-1).{' '}
          <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase privacy policy</a>.
        </li>
        <li>
          <strong>GitHub</strong> (GitHub, Inc. / GitHub B.V.) serves the pages of the app (GitHub Pages) and, if you
          choose it, signs you in with your GitHub account. GitHub receives your IP address when your browser loads
          the app.{' '}
          <a
            href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
            target="_blank"
            rel="noreferrer"
          >
            GitHub privacy statement
          </a>
          .
        </li>
        <li>
          <strong>Google Workspace</strong> sends the confirmation and password-reset emails from the address
          noreply@openevo.net. Google sees your email address and the text of those messages.
        </li>
        <li>
          The outside AI providers described in section 6, only for people who have not opted out.
        </li>
      </ul>
      <p>
        We run no analytics and no advertising or tracking scripts. The welcome page loads its fonts from this site,
        so your visit does not reach Google Fonts.
      </p>

      <h2>8. Cookies and local storage</h2>
      <p>
        OpenLPM stores a sign-in token in your browser&apos;s local storage so you stay signed in, and it removes the
        token when you sign out. It also stores short notes such as the page you were heading to before you signed
        in. This is not a tracking cookie. It is needed for the service to work, so no consent banner applies.
      </p>

      <h2>9. How long we keep it</h2>
      <p>
        We keep your data while your account exists. What happens when it is deleted is described in section 10. We
        also keep short-lived backup copies of the database to recover from a failure. They are replaced on a rolling
        basis, currently within about two weeks, and deleted data leaves them with that replacement.
      </p>

      <h2>10. Your rights, and how to ask for deletion</h2>
      <p>
        You have the right to information about your data, to correction, to deletion, to restriction of
        processing, to receive your data in a common format, and to object to processing. If you gave consent, you can
        withdraw it at any time with effect for the future. You can delete your own content and leave a space inside
        the app. You also have the right to complain to the data protection supervisory authority responsible for you.
      </p>
      <p>
        <strong>To have your account and data deleted</strong>, open <Link to="/dashboard/profile">Profile</Link>,
        go to &quot;Delete my account and data&quot; and choose &quot;Request deletion&quot;. If you cannot sign in, write to{' '}
        <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a> from the address of your account. You can
        also use that address for any other request about your data, such as a copy of it.
      </p>
      <ul>
        <li>We record the date of your request and answer within one month. If a request is unusually complex, the law
          allows us to take up to two further months. In that case we tell you within the first month and give the reason.</li>
        <li>We may ask you to confirm who you are before we delete anything, so that nobody can delete your account for you.</li>
        <li>You can withdraw the request in the same place until we have carried it out. Deletion cannot be undone.</li>
        <li>When we have finished, we send you a confirmation that says what was deleted and what was kept.</li>
      </ul>
      <p><strong>What is deleted:</strong> your account, your name and email address, your memberships, your work entries,
        activity timeline, notebooks, favourites, group memberships, saved prompts, discussion posts, the entries about you
        in the activity log, your privacy settings, and the screenshots you attached to feedback.</p>
      <p><strong>What is kept, without your name:</strong></p>
      <ul>
        <li>The text of a feedback comment you sent, because we may still need it to fix the problem. We remove the page
          excerpt and the page list saved with it. If you want the comment removed as well, say so in your request.</li>
        <li>Contributions you made to shared project content, such as curriculum entries, for as long as the project
          needs them. Tell us if you want specific items removed.</li>
        <li>Anonymized data as described in section 6.</li>
        <li>A short record that a deletion request was made, with its dates and outcome and without any personal
          details, so that we can show we answered in time.</li>
      </ul>
      <p><strong>What we cannot reach:</strong> documents you handed in on Moodle belong to the University of Jena and
        are deleted there, on request to the university. Text that an AI assistant has already read in a working session
        before you opted out may remain in that provider&apos;s own logs for the period its terms allow. We tell you in
        the confirmation where this applies.</p>

      <h2>11. Changes</h2>
      <p>
        When the setup changes, we update this page and the date at the top. A change that affects what happens to
        your data in the seminar is announced in the seminar as well.
      </p>
    </>
  )
}

function PrivacyDe() {
  return (
    <>
      <h1>Datenschutzerklärung</h1>
      <p className="muted">Stand: {LAST_UPDATED.de}. Die englische Fassung steht unter „English“.</p>

      <p>
        Dieser Text beschreibt, wie OpenLPM aufgebaut ist und was damit mit deinen Daten geschieht. Er gilt für
        OpenLPM. Für die übrigen Webseiten des Instituts gilt die{' '}
        <a href="https://www.eva.mpg.de/privacy-policy/" target="_blank" rel="noreferrer">
          Datenschutzerklärung von eva.mpg.de
        </a>
        .
      </p>

      <h2>1. Das Wichtigste in Kürze</h2>
      <ul>
        <li>OpenLPM speichert deinen Namen, deine E-Mail-Adresse, dein Passwort (verschlüsselt) und das, was du in den Bereichen einträgst, denen du beitrittst.</li>
        <li>Die Daten liegen auf einem Server in Frankfurt am Main.</li>
        <li>Es gibt keine Werbung und keine Besucherverfolgung.</li>
        <li>
          Die App hat keine KI-Funktion, die deine Daten irgendwohin sendet. Das Team nutzt aber externe KI-Dienste,
          um Rückmeldungen und studentische Arbeiten zu lesen und auszuwerten.{' '}
          <strong>Du kannst das für deine Daten ausschalten</strong>: im Profil, im Feld „KI-Verarbeitung“.
          Abschnitt 6 beschreibt genau, was das bedeutet.
        </li>
        <li>Du kannst deine Daten einsehen, korrigieren und löschen oder uns darum bitten (Abschnitt 10).</li>
      </ul>

      <h2>2. Wer verantwortlich ist</h2>
      <p>
        Anbieterin von OpenLPM ist die Max-Planck-Gesellschaft zur Förderung der Wissenschaften e.V.
        (Hofgartenstraße 8, 80539 München). Betreut wird der Dienst von Dustin Eirdosh, Abteilung für Vergleichende
        Kulturpsychologie, Max-Planck-Institut für evolutionäre Anthropologie, Deutscher Platz 6, 04103 Leipzig.
        Kontakt: <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a>. Die vollständigen
        Anbieterangaben stehen im <Link to="/impressum">Impressum</Link>. Bei Fragen zum Datenschutz kannst du dich
        über das Institut auch an die Datenschutzbeauftragte der Max-Planck-Gesellschaft wenden.
      </p>
      <p>
        Für das EvoMentor-Seminar an der Universität Jena arbeitet die Seminarleitung (Susan Hanisch) gemeinsam mit
        dem OpenEvo-Team in OpenLPM. Wer deine Arbeit sehen kann, steht in Abschnitt 5.
      </p>

      <h2>3. Was wir speichern</h2>
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Daten</th>
            <th style={{ textAlign: 'left' }}>Inhalt</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Konto</td>
            <td>Name, E-Mail-Adresse, Passwort (von Supabase Auth verschlüsselt gespeichert, für uns nie lesbar), Anmeldedatum, Rolle.</td>
          </tr>
          <tr>
            <td>Mitgliedschaften</td>
            <td>In welchen Bereichen du Mitglied bist, mit welcher Rolle, und wie du beigetreten bist.</td>
          </tr>
          <tr>
            <td>Deine Arbeit</td>
            <td>
              Was du in einem Bereich einträgst: zum Beispiel gemerkte Lernziele, deine Beurteilungen vorgeschlagener
              Verknüpfungen, übergreifende Themen, Reflexionen, Notizbücher, Diskussionsbeiträge, Gruppen und der Name,
              den du für die Abgabedatei eingibst.
            </td>
          </tr>
          <tr>
            <td>Dein Aktivitätsverlauf</td>
            <td>
              Im Jenaer Seminarbereich eine Liste der Seiten, die du geöffnet hast, und der Schritte, die du gemacht
              hast. Du siehst sie selbst und legst sie in die Prozessdatei, die du abgibst. Auch die Seminarleitung
              kann sie lesen.
            </td>
          </tr>
          <tr>
            <td>Gespeicherte Prompts</td>
            <td>
              Prompts, die du im KI-Prompt-Generator erzeugst und speicherst, mit den Notizen und der KI-Antwort, die
              du dazu einfügst, wenn du das möchtest.
            </td>
          </tr>
          <tr>
            <td>Rückmeldungen</td>
            <td>
              Wenn du den Feedback-Knopf benutzt: dein Kommentar, die Seite, auf der du warst, ein kurzer Auszug des
              sichtbaren Seitentextes, eine kurze Liste der Seiten, die du kurz vorher besucht hast, und ein
              Bildschirmfoto, wenn du eines anhängst.
            </td>
          </tr>
          <tr>
            <td>Deine Datenschutz-Einstellung</td>
            <td>Ob du „KI-Verarbeitung ausschließen“ eingeschaltet hast (Abschnitt 6).</td>
          </tr>
          <tr>
            <td>Löschanfragen</td>
            <td>Das Datum einer Anfrage, dein Konto zu löschen, das Datum, bis zu dem wir antworten, und der Grund, wenn du einen nennst (Abschnitt 10).</td>
          </tr>
          <tr>
            <td>Technische Daten</td>
            <td>
              Die IP-Adresse deines Geräts und Angaben zur Anfrage in den Server-Protokollen der Hosting-Anbieter
              (Abschnitt 7) sowie ein Anmelde-Token im lokalen Speicher deines Browsers, damit du angemeldet bleibst.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>4. Wozu wir die Daten nutzen und auf welcher Rechtsgrundlage</h2>
      <ul>
        <li>
          <strong>Dein Konto und die Bereiche, denen du beitrittst, betreiben</strong> (Art. 6 Abs. 1 lit. b DSGVO:
          der Dienst, für den du dich angemeldet hast).
        </li>
        <li>
          <strong>Den Dienst sicher und funktionsfähig halten</strong>, einschließlich Server-Protokollen (Art. 6
          Abs. 1 lit. f: unser berechtigtes Interesse an einem sicheren Dienst).
        </li>
        <li>
          <strong>Rückmeldungen und Bildschirmfotos</strong> dienen dazu, Probleme zu beheben und OpenLPM zu
          verbessern. Du entscheidest, was du schreibst und ob du ein Bildschirmfoto anhängst (Art. 6 Abs. 1 lit. a:
          deine Einwilligung, die du beim Absenden gibst).
        </li>
        <li>
          <strong>Das Seminar.</strong> Deine Arbeit im Seminarbereich wird gebraucht, um das Seminar durchzuführen und
          dir Rückmeldung zu geben (Art. 6 Abs. 1 lit. b: die Seminararbeit, für die du dich angemeldet hast).
        </li>
        <li>
          <strong>Forschung.</strong> Wenn deine individuelle Arbeit jemals in der Forschung verwendet werden soll,
          fragen wir dich vorher um deine gesonderte Einwilligung.
        </li>
        <li>
          <strong>Beantwortung deiner Anfragen</strong>, zum Beispiel einer Löschanfrage, und ein Nachweis, dass wir
          rechtzeitig geantwortet haben (Art. 6 Abs. 1 lit. c: unsere rechtliche Pflicht, auf deine Rechte zu antworten).
        </li>
        <li>
          <strong>Anonymisierte Daten</strong> sind keine personenbezogenen Daten mehr, dafür brauchen wir keine
          Rechtsgrundlage (siehe Abschnitt 6).
        </li>
      </ul>

      <h2>5. Wer was sehen kann</h2>
      <ul>
        <li>
          <strong>Andere Studierende</strong> sehen deinen Namen in der Gruppenliste. Sie sehen nur den Teil deiner
          Arbeit, den du mit deiner Gruppe teilst. Deine E-Mail-Adresse, deine Reflexionen und deinen Namen für die
          Abgabe sehen sie nie.
        </li>
        <li>
          <strong>Die Seminarleitung und die Eigentümerinnen und Eigentümer des Bereichs</strong> können alle Arbeiten
          im Seminarbereich lesen, auch den Aktivitätsverlauf.
        </li>
        <li>
          <strong>Administratorinnen und Administratoren von OpenEvo</strong> sehen Konten und Inhalte über Bereiche
          hinweg. Sie brauchen das, um den Dienst zu betreiben und Rückmeldungen zu beantworten.
        </li>
        <li>Rückmeldungen liest nur das OpenEvo-Team. Andere Nutzende können sie nicht einsehen.</li>
      </ul>

      <h2>6. KI-Verarbeitung und wie du sie ausschließt</h2>
      <p>
        <strong>Was die App tut.</strong> OpenLPM selbst sendet nichts von dem, was du einträgst, an einen KI-Dienst.
        Der Chat-Assistent der App ist abgeschaltet.
      </p>
      <p>
        <strong>Was das Team tut.</strong> Mitglieder des OpenEvo-Teams nutzen KI-Assistenten und Sprachmodelle
        externer Anbieter, um die Plattform zu pflegen und um Rückmeldungen und studentische Arbeiten zu lesen und zu
        sortieren, zum Beispiel Claude von Anthropic und Sprachmodelle der GWDG, eines deutschen
        wissenschaftlichen Rechenzentrums. Dafür kann der Text, den du geschrieben hast, an diese Anbieter gesendet
        werden. Wir verwenden deine Beiträge nicht, um KI-Modelle zu trainieren.
      </p>
      <p>
        <strong>Deine Wahl.</strong> Öffne dein <Link to="/dashboard/profile">Profil</Link> und setze das Häkchen bei
        „Ich möchte nicht, dass meine Daten von externen KI-Diensten verarbeitet werden“. Ab diesem Moment gilt:
      </p>
      <ul>
        <li>
          Deine Rückmeldungen, deine Arbeitseinträge, dein Aktivitätsverlauf, deine gespeicherten Prompts und die
          Inhalte deiner Notizbücher bleiben aus jeder KI-gestützten Auswertung heraus und werden an keinen externen
          KI-Dienst gesendet.
        </li>
        <li>
          Die Skripte, mit denen das Team Rückmeldungen und Projektinhalte liest, prüfen diese Einstellung und
          verbergen deinen Text vor dem KI-Assistenten. Menschen können deine Beiträge weiter lesen, wie in Abschnitt 5
          beschrieben.
        </li>
        <li>
          Du kannst deine Entscheidung jederzeit ändern. Die Einstellung gilt ab dem Moment der Änderung. Wenn wir
          prüfen sollen, was schon vor deiner Einstellung verarbeitet wurde, schreib uns. Wir teilen dir mit, was wir
          finden.
        </li>
        <li>Der Ausschluss hat keinen Einfluss auf deine Note oder deinen Platz im Seminar.</li>
      </ul>
      <p>
        <strong>Was der Ausschluss nicht umfasst.</strong> Daten, die anonymisiert wurden, sind keine
        personenbezogenen Daten mehr, deshalb gilt der Ausschluss dafür nicht. Anonymisiert heißt: Niemand, auch wir
        nicht, kann erkennen, von wem die Daten stammen. Beispiele sind Zahlen darüber, wie viele Personen eine Seite
        genutzt haben, oder Durchschnittswerte über viele Personen. Solche Daten nutzen wir für den normalen Betrieb
        und die Weiterentwicklung von OpenLPM. Daten, bei denen nur dein Name entfernt wurde, sind nicht anonymisiert,
        wenn sie sich noch auf dich zurückführen lassen, zum Beispiel über eine Konto-Nummer, eine typische
        Formulierung oder eine sehr kleine Gruppe. Dafür gilt der Ausschluss. Freitext lässt sich schwer
        anonymisieren. Deshalb behandeln wir das, was du schreibst, als personenbezogene Daten, es sei denn, eine
        Person hat jede Angabe entfernt, die auf dich hinweist, und das Ergebnis geprüft.
      </p>
      <p>
        <strong>Deine eigene Nutzung von KI-Werkzeugen.</strong> Der KI-Prompt-Generator erzeugt einen Text, den du in
        ein KI-Werkzeug deiner Wahl kopieren kannst. Was du dort einfügst, regelst du mit diesem Anbieter nach dessen
        Bedingungen. Füge dort keine persönlichen Daten über dich oder andere ein.
      </p>

      <h2>7. Unternehmen, die Daten für uns verarbeiten</h2>
      <ul>
        <li>
          <strong>Supabase, Inc.</strong> betreibt die Datenbank und die Anmeldung. Deine Daten liegen in Frankfurt am
          Main (AWS-Region eu-central-1).{' '}
          <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Datenschutzerklärung von Supabase</a>.
        </li>
        <li>
          <strong>GitHub</strong> (GitHub, Inc. / GitHub B.V.) liefert die Seiten der App aus (GitHub Pages) und meldet
          dich an, wenn du dich für die Anmeldung mit deinem GitHub-Konto entscheidest. GitHub erhält deine
          IP-Adresse, wenn dein Browser die App lädt.{' '}
          <a
            href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement"
            target="_blank"
            rel="noreferrer"
          >
            Datenschutzerklärung von GitHub
          </a>
          .
        </li>
        <li>
          <strong>Google Workspace</strong> versendet die Bestätigungs- und Passwort-Zurücksetzen-E-Mails von der
          Adresse noreply@openevo.net. Google sieht dabei deine E-Mail-Adresse und den Text dieser Nachrichten.
        </li>
        <li>Die externen KI-Anbieter aus Abschnitt 6, nur für Personen, die die KI-Verarbeitung nicht ausgeschlossen haben.</li>
      </ul>
      <p>
        Wir setzen keine Analyse-, Werbe- oder Tracking-Skripte ein. Die Willkommensseite lädt ihre Schriften von
        dieser Seite, daher erreicht dein Besuch Google Fonts nicht.
      </p>

      <h2>8. Cookies und lokaler Speicher</h2>
      <p>
        OpenLPM legt ein Anmelde-Token im lokalen Speicher deines Browsers ab, damit du angemeldet bleibst, und
        entfernt es beim Abmelden. Außerdem merkt es sich kurze Angaben, etwa die Seite, zu der du vor der Anmeldung
        wolltest. Das ist kein Tracking-Cookie. Es wird für den Betrieb des Dienstes gebraucht, deshalb gibt es kein
        Einwilligungsbanner.
      </p>

      <h2>9. Wie lange wir die Daten aufbewahren</h2>
      <p>
        Wir bewahren deine Daten auf, solange dein Konto besteht. Was beim Löschen geschieht, steht in Abschnitt 10.
        Außerdem halten wir kurzlebige Sicherungskopien der Datenbank vor, um nach einem Ausfall alles
        wiederherstellen zu können. Sie werden laufend ersetzt, derzeit innerhalb von etwa zwei Wochen, und gelöschte
        Daten verschwinden mit diesem Austausch auch aus ihnen.
      </p>

      <h2>10. Deine Rechte und wie du die Löschung beantragst</h2>
      <p>
        Du hast das Recht auf Auskunft über deine Daten, auf Berichtigung, auf Löschung, auf Einschränkung der
        Verarbeitung, auf Herausgabe deiner Daten in einem gängigen Format und auf Widerspruch gegen die
        Verarbeitung. Hast du eingewilligt, kannst du die Einwilligung jederzeit mit Wirkung für die Zukunft
        widerrufen. Eigene Inhalte löschen und einen Bereich verlassen kannst du in der App selbst. Du hast außerdem
        das Recht, dich bei der für dich zuständigen Datenschutz-Aufsichtsbehörde zu beschweren.
      </p>
      <p>
        <strong>Um dein Konto und deine Daten löschen zu lassen</strong>, öffne dein{' '}
        <Link to="/dashboard/profile">Profil</Link>, gehe zu „Konto und Daten löschen lassen“ und wähle „Löschung
        beantragen“. Wenn du dich nicht anmelden kannst, schreib von der Adresse deines Kontos an{' '}
        <a href="mailto:dustin.eirdosh@eva.mpg.de">dustin.eirdosh@eva.mpg.de</a>. Diese Adresse gilt auch für jede
        andere Anfrage zu deinen Daten, zum Beispiel für eine Kopie.
      </p>
      <ul>
        <li>Wir halten das Datum deiner Anfrage fest und antworten innerhalb eines Monats. Ist eine Anfrage
          ungewöhnlich aufwendig, darf das Gesetz uns bis zu zwei weitere Monate geben. Dann sagen wir dir im ersten
          Monat Bescheid und nennen den Grund.</li>
        <li>Wir können dich bitten, zu bestätigen, wer du bist, bevor wir etwas löschen, damit niemand dein Konto für
          dich löschen lassen kann.</li>
        <li>Bis wir die Anfrage ausgeführt haben, kannst du sie an derselben Stelle zurückziehen. Das Löschen lässt sich
          nicht rückgängig machen.</li>
        <li>Wenn wir fertig sind, schicken wir dir eine Bestätigung, die sagt, was gelöscht wurde und was erhalten blieb.</li>
      </ul>
      <p><strong>Was gelöscht wird:</strong> dein Konto, dein Name und deine E-Mail-Adresse, deine Mitgliedschaften,
        deine Arbeitseinträge, dein Aktivitätsverlauf, deine Notizbücher, Favoriten und Gruppenmitgliedschaften, deine
        gespeicherten Prompts, Diskussionsbeiträge, die Einträge über dich im Aktivitätsprotokoll, deine
        Datenschutz-Einstellungen und die Bildschirmfotos, die du an Rückmeldungen angehängt hast.</p>
      <p><strong>Was ohne deinen Namen erhalten bleibt:</strong></p>
      <ul>
        <li>Der Text eines Rückmeldungs-Kommentars, den du gesendet hast, weil wir ihn eventuell noch brauchen, um das
          Problem zu beheben. Den Seitenauszug und die Seitenliste, die dazu gespeichert wurden, entfernen wir. Wenn
          auch der Kommentar entfernt werden soll, schreib das in deine Anfrage.</li>
        <li>Beiträge, die du zu gemeinsamen Projektinhalten geleistet hast, etwa Einträge im Lehrplan, solange das
          Projekt sie braucht. Sag uns, wenn bestimmte Beiträge entfernt werden sollen.</li>
        <li>Anonymisierte Daten, wie in Abschnitt 6 beschrieben.</li>
        <li>Ein kurzer Vermerk, dass eine Löschanfrage gestellt wurde, mit Daten und Ergebnis und ohne persönliche
          Angaben, damit wir nachweisen können, dass wir rechtzeitig geantwortet haben.</li>
      </ul>
      <p><strong>Was wir nicht erreichen:</strong> Dokumente, die du in Moodle abgegeben hast, gehören zur Universität
        Jena und werden dort gelöscht, auf Anfrage an die Universität. Text, den ein KI-Assistent in einer
        Arbeitssitzung schon gelesen hat, bevor du die KI-Verarbeitung ausgeschlossen hast, kann so lange in den
        eigenen Protokollen dieses Anbieters bleiben, wie dessen Bedingungen es erlauben. In der Bestätigung sagen wir
        dir, wo das zutrifft.</p>

      <h2>11. Änderungen</h2>
      <p>
        Wenn sich der Aufbau ändert, aktualisieren wir diese Seite und das Datum oben. Eine Änderung, die betrifft,
        was im Seminar mit deinen Daten geschieht, geben wir zusätzlich im Seminar bekannt.
      </p>
    </>
  )
}
