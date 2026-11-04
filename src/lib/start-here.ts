// Plain-language text for a first-time visitor: the public home page
// (pages/home-page.tsx) and the "Start here" card on the project list
// (components/start-here-card.tsx) both read it, so the two never drift apart.
// Words here are for people who have never seen OpenLPM, so they avoid
// internal vocabulary.

export const AI_DRAFT_LINE = 'AI-drafted, awaiting expert review'
export const AI_DRAFT_DETAIL =
  'An AI drafted the four models and their links to sources and curricula. No subject expert has checked them yet. Treat every statement as a proposal.'

export const WHAT_IT_IS =
  'OpenLPM is a free, open workspace for building learning progressions. A learning progression describes how a person’s understanding of an idea can grow step by step, from the first school years to the end of school. Researchers, teachers and curriculum planners can write progressions down, link each step to the research behind it, compare them with official curricula, and improve them as classroom experience comes in.'

export interface ModelBlurb {
  slug: string
  name: string
  kind: 'one-subject' | 'cross-subject'
  text: string
}

export const FOUR_MODELS: ModelBlurb[] = [
  {
    slug: 'bio-core-lpm-synth',
    name: 'Bio-Core',
    kind: 'one-subject',
    text: 'Follows biology as a school subject of its own. It shows how ideas about life, inheritance and evolution build on each other when biology is taught by itself.',
  },
  {
    slug: 'social-core-lpm-synth',
    name: 'Social-Core',
    kind: 'one-subject',
    text: 'Follows the social sciences as one subject. It shows how ideas about groups, norms and institutions build up when they are taught by themselves.',
  },
  {
    slug: 'computational-core-lpm-synth',
    name: 'Computational-Core',
    kind: 'one-subject',
    text: 'Follows computing and computational thinking as one subject. It shows how ideas about models, data and algorithms build up when they are taught by themselves.',
  },
  {
    slug: 'interdisciplinary-lpm-synth',
    name: 'Interdisciplinary',
    kind: 'cross-subject',
    text: 'Follows the same big ideas across several subjects at once, for example information, cooperation and change in biology, social studies and computing. It shows what changes when ideas are designed to connect.',
  },
]

export const WHY_MADE_UP_TITLE = 'Why these models are made up'
export const WHY_MADE_UP =
  'The four models are thought experiments. An AI drafted them to make one question visible: what changes for learners when a curriculum is designed around single subjects, compared with one designed across subjects? They are meant for comparison. Nobody should read them as a proposal for what schools must teach. Their value comes from setting them next to the official curriculum documents of Germany, India and the United States, and seeing where each model fits and where it leaves gaps.'

export interface StartingPoint {
  key: string
  title: string
  text: string
  // The project space the page lives in and the page itself. The link only
  // works for a signed-in person who belongs to that space.
  slug: string
  page: string
  spaceName: string
}

export const STARTING_POINTS: StartingPoint[] = [
  {
    key: 'read-one',
    title: 'Read one model',
    text: 'Open the Interdisciplinary model and follow its strands: sequences of ideas from the first school years to the end of school.',
    slug: 'interdisciplinary-lpm-synth',
    page: 'strands',
    spaceName: 'Interdisciplinary',
  },
  {
    key: 'compare-two',
    title: 'Compare two models over the school years',
    text: 'Set Bio-Core next to the Interdisciplinary model and see in which school year each one first brings in an idea.',
    slug: 'bio-core-lpm-synth',
    page: 'time',
    spaceName: 'Bio-Core',
  },
  {
    key: 'see-curricula',
    title: 'See what official curricula say',
    text: 'Browse curriculum documents from India that the models are compared with, from national frameworks down to single states.',
    slug: 'india-curriculum-repository',
    page: 'curriculum-repository',
    spaceName: 'India',
  },
]

export interface StartingPointLink extends StartingPoint {
  // null when the person has no access to that space yet.
  href: string | null
}

// Which starting points can this person open? `slugs` holds the project
// spaces they belong to (everything, for an administrator).
export function resolveStartingPoints(slugs: ReadonlySet<string>): StartingPointLink[] {
  return STARTING_POINTS.map((p) => ({
    ...p,
    href: slugs.has(p.slug) ? `/dashboard/${p.slug}/${p.page}` : null,
  }))
}
