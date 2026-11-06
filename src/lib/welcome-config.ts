// The welcome page (pages/welcome-page.tsx) is public: a visitor who has no
// account yet cannot read the project row (projects are only visible to
// signed-in users), so the text it shows lives here, keyed by the space's slug.
// Adding a space with its own welcome link takes a new entry here and no new code.
export interface WelcomeConfig {
  slug: string
  heading: string
  intro: string
  // Bare domain (no @). Sign-up on this page only accepts addresses at this
  // domain; the join rule in the database enforces the same thing server-side.
  allowedDomain: string
  domainExample: string
  sandbox?: boolean
}

export const WELCOME_CONFIGS: Record<string, WelcomeConfig> = {
  'evomentor-thuringia': {
    slug: 'evomentor-thuringia',
    heading: 'Willkommen bei EvoMentor',
    intro:
      'Für das Seminar Allgemeine Fachdidaktik Biologie (Universität Jena) arbeitest du hier mit dem Thüringer Lehrplan. Du findest Lernziele zu deinem Thema, siehst, wie sie mit den Basiskonzepten der Biologie zusammenhängen, und beurteilst die vorgeschlagenen Verknüpfungen.',
    allowedDomain: 'uni-jena.de',
    domainExample: 'vorname.nachname@uni-jena.de',
  },
  'evomentor-thuringia-sandbox': {
    slug: 'evomentor-thuringia-sandbox',
    heading: 'EvoMentor Sandbox',
    intro:
      'Testbereich für synthetische (KI-erzeugte) Studierende. Hier arbeiten keine echten Studierenden. Der Bereich ist ein Abbild des Seminarbereichs und dient dazu, Aufgaben, Oberfläche und Auswertung zu erproben, bevor echte Studierende sie nutzen.',
    allowedDomain: 'globalesd.org',
    domainExample: 'name+test@globalesd.org',
    sandbox: true,
  },
}
