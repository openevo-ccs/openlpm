// Plain-language text for a first-time visitor: the public home page
// (pages/home-page.tsx) and the "Start here" card on the project list
// (components/start-here-card.tsx) both read it, so the two never drift apart.
// Words here are for people who have never seen OpenLPM, so they avoid
// internal vocabulary.

export const HOME_HEADLINE = 'Curricula are cultural models of human learning'

// The lead narrative of the public home page, one paragraph per entry.
export const LEAD_PARAGRAPHS: string[] = [
  'A curriculum is a model of how people learn. Ministries, textbook authors and teachers built it over generations, inside the limits of the classroom: a fixed number of hours, one teacher, a class of about 30, assessments, and boundaries between subjects. It was built to be teachable and testable. It was never meant to hold everything research knows about how people learn.',
  'Research and computational methods can help us find new directions for this work. Those directions may help education navigate the changes it faces across the world, across diverse communities and for individual learners.',
]

export const TOOLKIT_LINE =
  'OpenLPM is an open toolkit where teachers, researchers and AI collaborators build, compare and improve learning progression models and curriculum records together.'

export const PROGRESSION_GLOSS =
  'A learning progression model describes how understanding of an idea can grow step by step, from the first school years to the end of school.'

export const MODELS_TITLE = 'Four models for controlled comparison'
export const MODELS_INTRO =
  'The four models share one drafting method and one format. They differ in a design assumption, so a difference you find can be traced back to that choice. Three follow one school subject each, and the fourth follows shared ideas across subjects.'

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
    text: 'Treats biology as a subject of its own and explains evolution in population-level words only, leaving out what individual organisms do. It shows how a curriculum looks when that single assumption shapes every step.',
  },
  {
    slug: 'social-core-lpm-synth',
    name: 'Social-Core',
    kind: 'one-subject',
    text: 'Treats the social sciences as a subject of its own, with words for groups, norms, cooperation and conflict and nothing borrowed from biology or computing. It shows what that vocabulary does to the order and connections of ideas.',
  },
  {
    slug: 'computational-core-lpm-synth',
    name: 'Computational-Core',
    kind: 'one-subject',
    text: 'Treats computing as a subject of its own, with words for data, algorithms, systems and models, and no intentions credited to machines. It shows what that vocabulary does to the order and connections of ideas.',
  },
  {
    slug: 'interdisciplinary-lpm-synth',
    name: 'Interdisciplinary',
    kind: 'cross-subject',
    text: 'Defines shared ideas such as information, adaptation and selection across several fields at once, with a note on what does not carry over from field to field. It shows what changes when a curriculum is designed to connect subjects.',
  },
]

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
