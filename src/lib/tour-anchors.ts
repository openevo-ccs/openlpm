// The parts of a screen a guided tour can point at. A page marks one of its
// parts with data-tour="<key>"; a tour step names the same key. This list is
// what the tour editor offers an owner, so adding a new pointable part is two
// small edits: put data-tour on the element, add a row here.
//
// page: the path inside the space where the part lives ('' = the start page,
// '*' = visible on every page, so the tour does not need to change page).
// templates: which student-view templates have this part. Omitted = any view.

export interface TourAnchor {
  key: string
  label: string
  group: string
  page: string | '*'
  templates?: 'jena'
}

export const TOUR_ANCHORS: TourAnchor[] = [
  { key: 'sidebar', label: 'Side menu (with the collapse button)', group: 'On every page', page: '*' },
  { key: 'sidebar.toggle', label: 'Button that opens and closes the side menu', group: 'On every page', page: '*' },

  { key: 'sidebar.meine-arbeit', label: 'Side menu section "Meine Arbeit"', group: 'On every page', page: '*', templates: 'jena' },
  { key: 'sidebar.gruppen', label: 'Side menu section "Gruppen"', group: 'On every page', page: '*', templates: 'jena' },

  { key: 'lernziele.kopf', label: 'Page title and goal count', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.suche', label: 'Free search box', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.klassenstufe', label: 'Grade buttons', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.thema', label: 'Topic menu', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.unterthema', label: 'Subtopic menu (appears after a topic is chosen)', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.basiskonzepte', label: 'Basic concepts and relevance filter', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.ansicht', label: 'List of learning goals with sort and view buttons', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.karte', label: 'A learning goal card (the first one)', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.bezuege', label: 'Button for the basic concept links (open card)', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.strategien', label: 'Button for the teaching strategies (open card)', group: 'Lernziele page', page: '', templates: 'jena' },
  { key: 'lernziele.favorit', label: 'Favorite star on a card', group: 'Lernziele page', page: '', templates: 'jena' },

  { key: 'basiskonzepte.kopf', label: 'Page title and tabs', group: 'Basiskonzepte page', page: 'basiskonzepte', templates: 'jena' },
  { key: 'basiskonzepte.dashboard', label: 'Dashboard with the relevance overview', group: 'Basiskonzepte page', page: 'basiskonzepte', templates: 'jena' },

  { key: 'gruppen.liste', label: 'The numbered groups with the join buttons', group: 'Gruppen page', page: 'groups', templates: 'jena' },

  { key: 'strands.liste', label: 'List of strands', group: 'Strands page', page: 'strands' },
  { key: 'strands.detail', label: 'The chosen strand with its stages by grade band', group: 'Strands page', page: 'strands' },
]

export interface TourPage {
  path: string
  label: string
  templates?: 'jena'
}

// Pages a step can move to without pointing at anything in particular.
export const TOUR_PAGES: TourPage[] = [
  { path: '', label: 'Start page' },
  { path: 'basiskonzepte', label: 'Basiskonzepte (Dashboard tab)', templates: 'jena' },
  { path: 'basiskonzepte/netz', label: 'Basiskonzepte (Netz tab)', templates: 'jena' },
  { path: 'basiskonzepte/detail', label: 'Basiskonzepte (Details zu den Basiskonzepten)', templates: 'jena' },
  { path: 'planen', label: 'KI-Prompt-Generator', templates: 'jena' },
  { path: 'aufgabe1', label: 'Meine Arbeit (Aufgabe 1)', templates: 'jena' },
  { path: 'groups', label: 'Gruppen', templates: 'jena' },
]

export function getTourAnchor(key: string | undefined | null): TourAnchor | null {
  if (!key) return null
  return TOUR_ANCHORS.find((a) => a.key === key) ?? null
}

export function anchorSelector(key: string): string {
  return `[data-tour="${key}"]`
}
