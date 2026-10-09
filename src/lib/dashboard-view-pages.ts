// The one shared list of "pages a standard dashboard view can show or
// hide" -- both project-layout.tsx (which filters the real sidebar down to
// a view's page_keys) and settings-page.tsx (which renders the checklist
// an owner builds a view from) read from this file rather than keeping
// their own copies, so a page added to the dashboard later only has to be
// added here once to become choosable in a Custom View too.
//
// 'groups' and 'curriculum-repository' are included even though they only
// ever actually appear in a given project's sidebar when that project has
// turned Groups on, or has real repository content -- checking one of
// those two in a view that doesn't have them is harmless and simply has no
// visible effect, the same way page_keys can only ever narrow the sidebar
// down, never add an item that wouldn't show there at all.
export interface DashboardPageDescriptor {
  key: string
  label: string
}

export const DASHBOARD_PAGES: DashboardPageDescriptor[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'learning-goals', label: 'Learning Goals' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'theories', label: 'Theories' },
  { key: 'strands', label: 'Strands' },
  { key: 'literature', label: 'Literature' },
  { key: 'review', label: 'Review' },
  { key: 'discussions', label: 'Discussions' },
  { key: 'notebooks', label: 'Notebooks' },
  { key: 'groups', label: 'Groups' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'curriculum-repository', label: 'Curriculum Repository' },
  { key: 'settings', label: 'Settings' },
]

// Every standard view always includes this one, whether or not it's in
// page_keys -- it's the view's own home/landing page, not an optional tab.
export const ALWAYS_VISIBLE_PAGE_KEY = 'dashboard'

export function defaultPageKeys(): string[] {
  return DASHBOARD_PAGES.map((p) => p.key)
}
