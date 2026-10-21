// Shared bilingual chrome strings for all 4 real pages the 4 2026-10-20
// German/US custom views use (Overview, Network, Comparison, Report). Split
// out of curriculum-connections-page.tsx when that one page's content grew
// into a real multi-page sidebar nav. Every string here is short and plain
// on purpose -- real feedback asked for "short clear style-checked
// explanations... of what is in a given space and how users can explore,
// analyze or export data," not long prose.
export interface ConnectionsStrings {
  navOverview: string
  navNetwork: string
  navRegions: string
  navComparison: string
  navReport: string
  groupExplore: string
  groupAnalyze: string

  regionsTitle: string
  regionsHelp: string
  regionsCoverage: (covered: number, total: number) => string
  regionsNoLinks: string
  regionsStrandLabel: string
  regionsNoStrandLinks: string
  regionsSelectAll: string
  regionsClearAll: string
  regionsSelectPrompt: string

  overviewTitle: string
  overviewIntro: (region: string) => string
  overviewHelp: string
  overviewStrands: string
  overviewGradeBands: string
  overviewTheories: string
  overviewLiterature: string
  overviewRealWorld: string
  overviewComparisons: string
  overviewDivergences: string
  overviewCoverage: string
  topics: string
  noConnections: string
  addConnection: string
  search: string
  rationaleLabel: string
  rationalePlaceholder: string
  save: string
  cancel: string
  edit: string
  connect: string
  connecting: string
  noMatches: string
  selectTopic: string

  networkTitle: string
  networkHelp: string
  graphHint: string
  legendTopic: string
  legendRecord: string
  controlFit: string
  controlZoomIn: string
  controlZoomOut: string
  controlDownload: string
  controlLabelsAlways: string
  controlLabelsHover: string
  controlSpacingLess: string
  controlSpacingMore: string

  comparisonTitle: string
  comparisonHelp: string
  comparingAgainst: (name: string) => string
  comparisonNotes: string
  noComparisonNotes: string
  illustrates: string
  sankeyTitle: string
  sankeyHint: string
  sankeyEmpty: string

  reportTitle: string
  reportHelp: string
  reportKeywordLabel: string
  reportKeywordPlaceholder: string
  reportAllTopics: string
  reportNoMatches: string
  reportDownload: string
  reportCopy: string
  reportCopied: string
  reportSectionTopics: (n: number) => string
  reportSectionComparisons: (n: number) => string
  reportGeneratedOn: (date: string) => string
}

export const STRINGS: Record<'de' | 'en', ConnectionsStrings> = {
  de: {
    navOverview: 'Übersicht',
    navNetwork: 'Netzwerk',
    navRegions: 'Nach Bundesland',
    navComparison: 'Vergleich',
    navReport: 'Bericht',
    groupExplore: 'ERKUNDEN',
    groupAnalyze: 'ANALYSIEREN',

    regionsTitle: 'Nach Bundesland',
    regionsHelp: 'Wie sich die Stränge dieses LPM auf jedes einzelne Bundesland stützen, statt nur gepoolt gezeigt zu werden. Wähle ein oder mehrere Bundesländer, um sie Seite an Seite zu vergleichen.',
    regionsCoverage: (covered: number, total: number) => `${covered} von ${total} Strängen haben eine Verknüpfung aus diesem Bundesland`,
    regionsNoLinks: 'Für dieses Bundesland liegt noch keine Verknüpfung vor.',
    regionsStrandLabel: 'Strang',
    regionsNoStrandLinks: 'Kein Bezug aus diesem Bundesland.',
    regionsSelectAll: 'Alle auswählen',
    regionsClearAll: 'Auswahl zurücksetzen',
    regionsSelectPrompt: 'Wähle oben mindestens ein Bundesland.',

    overviewTitle: 'Verbindungen zum Lehrplan',
    overviewIntro: (region: string) =>
      `Verbinde die Lernziele dieses LPM mit echten Lehrplan-Dokumenten aus ${region}, mit einer kurzen Begründung je Verbindung.`,
    overviewHelp: 'Diese Seite zeigt auf einen Blick, wie umfangreich dieses LPM ist und wie gut es bereits mit realen Lehrplänen verknüpft ist. Wähle unten links ein Lernziel, um seine Verbindungen zu sehen oder zu bearbeiten.',
    overviewStrands: 'Stränge',
    overviewGradeBands: 'Klassenstufen',
    overviewTheories: 'Theorien',
    overviewLiterature: 'Literatur',
    overviewRealWorld: 'Praxis-Verknüpfungen',
    overviewComparisons: 'Vergleichsnotizen',
    overviewDivergences: 'Geprüfte Thesen',
    overviewCoverage: 'Abdeckung nach Klassenstufe',
    topics: 'Lernziele',
    noConnections: 'Noch keine Verbindung.',
    addConnection: 'Verbindung hinzufügen',
    search: 'Lehrplan-Dokument suchen…',
    rationaleLabel: 'Begründung (optional)',
    rationalePlaceholder: 'z. B. dieser Lehrplan-Beschluss ist der reale Hintergrund für dieses Lernziel',
    save: 'Speichern',
    cancel: 'Abbrechen',
    edit: 'Bearbeiten',
    connect: 'Verbinden',
    connecting: 'Verbinde…',
    noMatches: 'Keine Treffer.',
    selectTopic: 'Wähle links ein Lernziel.',

    networkTitle: 'Netzwerk',
    networkHelp: 'Ein interaktives Diagramm: Lernziele (große Punkte) verbunden mit realen Lehrplan-Dokumenten (kleine Punkte). Klicke einen Punkt an, um seine Verbindungen hervorzuheben; die Steuerung oben rechts passt Abstand, Zoom und Beschriftungen an.',
    graphHint: 'Lernziele (groß) und reale Lehrplan-Dokumente (klein), verbunden durch echte Verknüpfungen. Klicken zum Hervorheben.',
    legendTopic: 'Lernziel',
    legendRecord: 'Lehrplan-Dokument',
    controlFit: 'Ganze Ansicht einpassen',
    controlZoomIn: 'Vergrößern',
    controlZoomOut: 'Verkleinern',
    controlDownload: 'Als PNG herunterladen',
    controlLabelsAlways: 'Alle Beschriftungen zeigen',
    controlLabelsHover: 'Beschriftungen nur bei Hover',
    controlSpacingLess: 'Enger anordnen',
    controlSpacingMore: 'Weiter auseinanderziehen',

    comparisonTitle: 'Vergleich',
    comparisonHelp: 'Vergleicht dieses LPM mit seinem Gegenstück anhand von Umfang, Tiefe und Verankerung, plus den einzelnen Vergleichsnotizen zwischen beiden. Das Flussdiagramm unten zeigt, welche Stränge bereits miteinander verglichen wurden und wie oft.',
    comparingAgainst: (name: string) => `Im Vergleich mit ${name}`,
    comparisonNotes: 'Vergleichsnotizen',
    noComparisonNotes: 'Noch keine Vergleichsnotizen zwischen diesen beiden Projekten.',
    illustrates: 'Veranschaulicht',
    sankeyTitle: 'Stränge im Vergleich',
    sankeyHint: 'Jeder Fluss ist eine echte Vergleichsnotiz zwischen einem Strang links und einem Strang rechts; die Breite zeigt, wie viele. Farbe = Art des Vergleichs. Klicke einen Strang an, um nur seine Flüsse zu zeigen.',
    sankeyEmpty: 'Noch keine Vergleichsnotizen zum Anzeigen.',

    reportTitle: 'Bericht',
    reportHelp: 'Erzeuge eine kurze, druckbare Zusammenfassung: alle Lernziele und Verbindungen zu einem Suchbegriff, plus passende Vergleichsnotizen. Als Markdown-Datei herunterladen oder in die Zwischenablage kopieren.',
    reportKeywordLabel: 'Suchbegriff (optional)',
    reportKeywordPlaceholder: 'z. B. Variation, Agency, Thüringen…',
    reportAllTopics: 'Alle Lernziele',
    reportNoMatches: 'Keine Treffer für diesen Suchbegriff.',
    reportDownload: 'Als Markdown herunterladen',
    reportCopy: 'In Zwischenablage kopieren',
    reportCopied: 'Kopiert!',
    reportSectionTopics: (n: number) => `Lernziele (${n})`,
    reportSectionComparisons: (n: number) => `Vergleichsnotizen (${n})`,
    reportGeneratedOn: (date: string) => `Erstellt am ${date}`,
  },
  en: {
    navOverview: 'Overview',
    navNetwork: 'Network',
    navRegions: 'By State',
    navComparison: 'Comparison',
    navReport: 'Report',
    groupExplore: 'EXPLORE',
    groupAnalyze: 'ANALYZE',

    regionsTitle: 'By State',
    regionsHelp: 'How this LPM\'s strands are grounded in each individual state, rather than pooled together. Pick one or more states to compare them side by side.',
    regionsCoverage: (covered: number, total: number) => `${covered} of ${total} strands have a connection from this state`,
    regionsNoLinks: 'No connections from this state yet.',
    regionsStrandLabel: 'Strand',
    regionsNoStrandLinks: 'No grounding from this state.',
    regionsSelectAll: 'Select all',
    regionsClearAll: 'Clear selection',
    regionsSelectPrompt: 'Pick at least one state above.',

    overviewTitle: 'Curriculum Connections',
    overviewIntro: (region: string) =>
      `Connect this LPM's learning goals to real curriculum documents from ${region}, with a short rationale per connection.`,
    overviewHelp: 'This page shows how large this LPM is at a glance, and how well it is already connected to real curricula. Pick a learning goal on the lower left to see or edit its connections.',
    overviewStrands: 'Strands',
    overviewGradeBands: 'Grade bands',
    overviewTheories: 'Theories',
    overviewLiterature: 'Literature',
    overviewRealWorld: 'Real-world links',
    overviewComparisons: 'Comparison notes',
    overviewDivergences: 'Divergences reviewed',
    overviewCoverage: 'Coverage by grade band',
    topics: 'Learning Goals',
    noConnections: 'No connection yet.',
    addConnection: 'Add connection',
    search: 'Search curriculum documents…',
    rationaleLabel: 'Rationale (optional)',
    rationalePlaceholder: 'e.g. this policy mandate is the real-world background for this learning goal',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    connect: 'Connect',
    connecting: 'Connecting…',
    noMatches: 'No matches.',
    selectTopic: 'Select a learning goal on the left.',

    networkTitle: 'Network',
    networkHelp: 'An interactive diagram: learning goals (larger dots) connected to real curriculum documents (smaller dots). Click a dot to highlight its connections; the controls in the top right adjust spacing, zoom, and labels.',
    graphHint: 'Learning goals (larger) and real curriculum documents (smaller), connected by real links. Click one to highlight it.',
    legendTopic: 'Learning goal',
    legendRecord: 'Curriculum document',
    controlFit: 'Fit to screen',
    controlZoomIn: 'Zoom in',
    controlZoomOut: 'Zoom out',
    controlDownload: 'Download as PNG',
    controlLabelsAlways: 'Show all labels',
    controlLabelsHover: 'Show labels on hover only',
    controlSpacingLess: 'Pack tighter',
    controlSpacingMore: 'Spread out',

    comparisonTitle: 'Comparison',
    comparisonHelp: 'Compares this LPM against its counterpart on scope, depth, and grounding, plus the individual comparison notes between the two. The flow diagram below shows which strands have already been compared, and how often.',
    comparingAgainst: (name: string) => `Compared against ${name}`,
    comparisonNotes: 'Comparison notes',
    noComparisonNotes: 'No comparison notes yet between these two projects.',
    illustrates: 'Illustrates',
    sankeyTitle: 'Strands compared',
    sankeyHint: 'Each flow is a real comparison note between a strand on the left and a strand on the right; width shows how many. Color = kind of comparison. Click a strand to show only its flows.',
    sankeyEmpty: 'No comparison notes to show yet.',

    reportTitle: 'Report',
    reportHelp: 'Generate a short, printable summary: every learning goal and connection matching a keyword, plus any matching comparison notes. Download as a Markdown file or copy to your clipboard.',
    reportKeywordLabel: 'Keyword (optional)',
    reportKeywordPlaceholder: 'e.g. variation, agency, Thuringia…',
    reportAllTopics: 'All learning goals',
    reportNoMatches: 'No matches for that keyword.',
    reportDownload: 'Download as Markdown',
    reportCopy: 'Copy to clipboard',
    reportCopied: 'Copied!',
    reportSectionTopics: (n: number) => `Learning Goals (${n})`,
    reportSectionComparisons: (n: number) => `Comparison Notes (${n})`,
    reportGeneratedOn: (date: string) => `Generated on ${date}`,
  },
} as const
