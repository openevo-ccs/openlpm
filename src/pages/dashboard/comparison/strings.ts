import type { Lang } from '@/lib/comparison'

// Every word the comparison views show, English first and German second, side
// by side so a missing translation is a type error rather than a gap a reader
// finds. Plain language first: the technical name of a measure sits in the
// "how it is calculated" notes and stays out of the headline.
//
// Placeholders: {n} {u} and so on are filled by t('key', { n: 3 }).

const S = {
  // ---- navigation
  groupExplore: ['Explore', 'Erkunden'],
  groupCompare: ['Compare', 'Vergleichen'],
  groupImprove: ['Improve', 'Verbessern'],
  groupShare: ['Share', 'Weitergeben'],
  navOverview: ['Overview', 'Übersicht'],
  navCoverage: ['Coverage map', 'Abdeckungskarte'],
  navNetwork: ['Network', 'Netzwerk'],
  navTimeline: ['Timeline', 'Zeitleiste'],
  navFlows: ['Flows', 'Flüsse'],
  navMeasures: ['Measures', 'Kennzahlen'],
  navSideBySide: ['Side by side', 'Gegenüberstellung'],
  navSpaces: ['Between spaces', 'Zwischen den Räumen'],
  navCurate: ['Curate', 'Pflegen'],
  navReport: ['Report', 'Bericht'],

  // ---- generic
  loading: ['Loading…', 'Wird geladen …'],
  loadError: ['The data could not be loaded: {msg}', 'Die Daten konnten nicht geladen werden: {msg}'],
  close: ['Close', 'Schließen'],
  save: ['Save', 'Speichern'],
  cancel: ['Cancel', 'Abbrechen'],
  search: ['Search', 'Suchen'],
  remove: ['Remove', 'Entfernen'],
  confirm: ['Confirm', 'Bestätigen'],
  link: ['Link', 'Verknüpfen'],
  howCalculated: ['How this is calculated', 'So wird gerechnet'],
  whatThisTells: ['What this tells you', 'Was das aussagt'],
  none: ['none', 'keine'],
  links: ['links', 'Verknüpfungen'],
  records: ['records', 'Einträge'],
  places: ['places', 'Orte'],
  rows: ['rows', 'Zeilen'],
  of: ['of', 'von'],
  download: ['Download', 'Herunterladen'],
  downloadPng: ['Download as image', 'Als Bild herunterladen'],
  downloadCsv: ['Download as table (CSV)', 'Als Tabelle herunterladen (CSV)'],
  copy: ['Copy', 'Kopieren'],
  copied: ['Copied', 'Kopiert'],
  emptyNoRecords: ['No records are available for this selection.', 'Für diese Auswahl liegen keine Einträge vor.'],
  emptyNoLinks: ['No links yet for this selection.', 'Für diese Auswahl gibt es noch keine Verknüpfungen.'],

  // ---- scope controls
  scopeCountries: ['Countries', 'Länder'],
  scopeLevel: ['Compare', 'Vergleichen nach'],
  levelState: ['States', 'Bundesländern / Staaten'],
  levelCountry: ['Countries', 'Ländern'],
  scopeRows: ['Rows', 'Zeilen'],
  dimStrand: ['Strands', 'Stränge'],
  dimItem: ['Every item', 'Jeder Baustein'],
  dimBand: ['Grade bands', 'Klassenstufen'],
  scopeKinds: ['Record kinds', 'Art der Einträge'],
  scopeAllKinds: ['All kinds', 'Alle Arten'],
  scopeProposed: ['Include AI-drafted proposals', 'KI-Entwürfe einbeziehen'],
  proposedNote: [
    '{p}% of the links shown are AI-drafted proposals that nobody has confirmed yet.',
    '{p}% der angezeigten Verknüpfungen sind KI-Entwürfe, die noch niemand bestätigt hat.',
  ],
  addCountryHint: ['Switch more countries on once their records exist.', 'Weitere Länder lassen sich zuschalten, sobald ihre Einträge vorliegen.'],
  countryNoLinks: ['no links from this space yet', 'noch keine Verknüpfungen aus diesem Raum'],

  // ---- record kinds
  familyMandate: ['Laws and standards', 'Gesetze und Standards'],
  familyUnit: ['Curriculum units', 'Lehrplaneinheiten'],
  familyEvent: ['Dated events', 'Datierte Ereignisse'],
  familyActor: ['Institutions', 'Institutionen'],
  familyPrinciple: ['Principles and briefs', 'Grundsätze und Papiere'],
  familyFinding: ['Findings and proposals', 'Befunde und Vorschläge'],
  familyControversy: ['Controversies', 'Kontroversen'],
  familyOther: ['Other', 'Sonstiges'],

  // ---- reliability and honesty
  relNone: ['No links yet in these places, so there is nothing to measure.', 'In diesen Orten gibt es noch keine Verknüpfungen, daher lässt sich nichts messen.'],
  relSmall: [
    'Small sample: {n} {n|link|links} in {u} {u|place|places}. Treat differences as leads to check. They are not findings yet.',
    'Kleine Stichprobe: {n} {n|Verknüpfung|Verknüpfungen} in {u} {u|Ort|Orten}. Unterschiede sind Hinweise zum Prüfen. Befunde sind es noch nicht.',
  ],
  relFair: ['{n} {n|link|links} in {u} {u|place|places}.', '{n} {n|Verknüpfung|Verknüpfungen} in {u} {u|Ort|Orten}.'],
  draftBadge: ['AI-drafted, no expert review yet', 'KI-Entwurf, noch ohne fachliche Prüfung'],

  // ---- units
  unitNoLinks: ['No links yet', 'Noch keine Verknüpfungen'],
  unitRecordsN: ['{n} records', '{n} Einträge'],
  unitLinksN: ['{n} {n|link|links}', '{n} {n|Verknüpfung|Verknüpfungen}'],

  // ---- link drawer
  drawerNoLinks: ['No links here yet.', 'Hier gibt es noch keine Verknüpfungen.'],
  drawerCheckedDone: ['Someone checked this place and found nothing that fits.', 'Dieser Ort wurde geprüft. Es passt nichts.'],
  drawerViewerNote: ['You can look, search and download. Editors can change links.', 'Sie können ansehen, suchen und herunterladen. Verknüpfungen ändern können Bearbeitende.'],
  drawerCriticNote: ['You can question a link. Editors can change links.', 'Sie können eine Verknüpfung in Frage stellen. Ändern können sie Bearbeitende.'],
  drawerWhy: ['Why it fits', 'Warum es passt'],
  drawerLinkedTo: ['Linked to', 'Verknüpft mit'],
  drawerEdit: ['Edit reason', 'Begründung ändern'],
  drawerConfirm: ['Confirm', 'Bestätigen'],
  drawerQuestion: ['Question this', 'In Frage stellen'],
  drawerRemoveConfirm: ['Remove this link? The record stays in the repository.', 'Diese Verknüpfung entfernen? Der Eintrag bleibt im Repositorium.'],
  drawerSuggest: ['Find records that might fit', 'Mögliche passende Einträge finden'],
  drawerSuggestions: ['Records that might fit', 'Einträge, die passen könnten'],
  drawerSuggestionsHint: [
    'Ranked by shared words with this part of the progression, with a small lift for kinds of record people link more often. Tested on 38 earlier links (records of 2026-10-28), the right record was in the top 10 for 42% of them (a random list gives about 24%). Read a record before you link it.',
    'Gereiht nach gemeinsamen Wörtern mit diesem Teil der Progression, mit leichtem Vorzug für Arten von Einträgen, die Menschen häufiger verknüpfen. An 38 früheren Verknüpfungen geprüft (Einträge vom 28.10.2026), stand der richtige Eintrag bei 42 % unter den ersten 10 (eine Zufallsliste ergibt etwa 24 %). Lesen Sie einen Eintrag, bevor Sie ihn verknüpfen.',
  ],
  drawerNoSuggestions: ['No record in this place shares enough words with this part.', 'Kein Eintrag in diesem Ort teilt genug Wörter mit diesem Teil.'],
  drawerSharedWords: ['Shared words', 'Gemeinsame Wörter'],
  drawerWhyPlaceholder: ['Why does this record fit? One or two sentences.', 'Warum passt dieser Eintrag? Ein bis zwei Sätze.'],
  drawerNeedsReason: ['Add a reason of at least 20 characters.', 'Bitte eine Begründung mit mindestens 20 Zeichen angeben.'],
  drawerAdd: ['Add link', 'Verknüpfung hinzufügen'],
  drawerCheckedNone: ['Mark: checked, nothing here fits', 'Markieren: geprüft, hier passt nichts'],
  drawerCommentPlaceholder: ['What is the problem? What would you change?', 'Was ist das Problem? Was würden Sie ändern?'],
  verdictSupports: ['Looks right', 'Passt'],
  verdictQuestions: ['Not convinced', 'Nicht überzeugt'],
  verdictTooBroad: ['Too broad', 'Zu allgemein'],
  verdictWrongPlace: ['Fits a different part', 'Passt zu einem anderen Teil'],
  issueNoRationale: ['no reason given', 'keine Begründung'],
  issueShort: ['short reason', 'kurze Begründung'],
  issueBoilerplate: ['automatic reason only', 'nur automatische Begründung'],
  issueProposed: ['AI-drafted, unconfirmed', 'KI-Entwurf, unbestätigt'],
  issueQuestioned: ['questioned by a reviewer', 'von Prüfenden in Frage gestellt'],

  // ---- overview
  overviewTitle: ['Overview', 'Übersicht'],
  overviewHelp: [
    'Where this progression meets the curriculum policy of the places you chose: how many parts of it are tied to curriculum policy records, where the gaps are, and what stands out.',
    'Wo diese Progression auf die Lehrplanpolitik der gewählten Orte trifft: welche Teile mit Einträgen zur Lehrplanpolitik verknüpft sind, wo Lücken liegen und was auffällt.',
  ],
  overviewStands: ['What stands out', 'Was auffällt'],
  overviewBands: ['Links by grade band', 'Verknüpfungen nach Klassenstufe'],
  overviewBandsHelp: ['How many links sit on parts of the progression for each school stage.', 'Wie viele Verknüpfungen an Teilen der Progression für jede Schulstufe hängen.'],
  overviewMap: ['Coverage at a glance', 'Abdeckung auf einen Blick'],
  overviewExplain: [
    'Every number counts links: a link ties one part of the progression to one record about a place, with a written reason. A record can carry several links, and a part can have several records.',
    'Jede Zahl zählt Verknüpfungen: Eine Verknüpfung bindet einen Teil der Progression mit einer schriftlichen Begründung an einen Eintrag zu einem Ort. Ein Eintrag kann mehrere Verknüpfungen tragen, und ein Teil mehrere Einträge.',
  ],
  statItems: ['Parts of the progression', 'Teile der Progression'],
  statItemsSub: ['in {n} strands', 'in {n} Strängen'],
  statPlaces: ['Places with links', 'Orte mit Verknüpfungen'],
  statPlacesSub: ['of those with records', 'von denen mit Einträgen'],
  statRecords: ['Records in scope', 'Einträge im Blick'],
  statLinks: ['Links', 'Verknüpfungen'],
  statLinksSub: ['{p}% AI-drafted', '{p}% KI-Entwurf'],
  statStrandsLinked: ['Strands with a link', 'Stränge mit Verknüpfung'],
  statSubLinked: ['Grade-band parts with a link', 'Klassenstufen-Teile mit Verknüpfung'],
  statGroundedSub: ['in the places chosen', 'in den gewählten Orten'],
  statMedian: ['Median links per part', 'Median je Teil'],
  findTop: [
    '{place} has the most links: {n}, spread over {a} of {b} rows.',
    '{place} hat die meisten Verknüpfungen: {n}, verteilt auf {a} von {b} Zeilen.',
  ],
  findEmptyPlaces: [
    '{n} places have records but no link yet: {list}.',
    '{n} Orte haben Einträge, aber noch keine Verknüpfung: {list}.',
  ],
  findStrandGaps: [
    '{n} of {total} strands have no link in these places: {list}.',
    '{n} von {total} Strängen haben in diesen Orten keine Verknüpfung: {list}.',
  ],
  findStrandLevelOnly: [
    'Every link sits on a whole strand. None is attached to one of the {n} grade-band parts yet, so those rows stay empty. Links at that level would show which school stage each record speaks to.',
    'Jede Verknüpfung hängt an einem ganzen Strang. Keine ist an einen der {n} Klassenstufen-Teile geknüpft, diese Zeilen bleiben daher leer. Verknüpfungen auf dieser Ebene würden zeigen, zu welcher Schulstufe ein Eintrag spricht.',
  ],
  findGaps: [
    '{n} of {total} grade-band parts have no link in these places, for example: {list}.',
    '{n} von {total} Klassenstufen-Teilen haben in diesen Orten keine Verknüpfung, zum Beispiel: {list}.',
  ],
  findDistinct: [
    '{a} and {b} differ most in what they connect to (distance {d}), and more than chance would give for samples this size.',
    '{a} und {b} unterscheiden sich am stärksten darin, womit sie verknüpft sind (Abstand {d}), und mehr, als der Zufall bei solchen Stichproben erwarten lässt.',
  ],
  findNoneDistinct: [
    'No two places differ by more than chance would give. With {n} {n|link|links} in the two most different places, that says as much about the sample size as about the places.',
    'Kein Ortspaar unterscheidet sich stärker, als der Zufall erwarten lässt. Bei {n} {n|Verknüpfung|Verknüpfungen} in den beiden verschiedensten Orten sagt das ebenso viel über die Stichprobe wie über die Orte.',
  ],
  findBridge: [
    '"{title}" ties together {o} parts across {n} strands. Records like it tie the progression to curriculum policy in more than one place.',
    '„{title}“ verbindet {o} Teile aus {n} Strängen. Solche Einträge binden die Progression an mehreren Stellen an die Lehrplanpolitik.',
  ],
  findIsolated: [
    '{n} of {total} parts share no record with any other part.',
    '{n} von {total} Teilen teilen mit keinem anderen Teil einen Eintrag.',
  ],

  // ---- coverage map
  coverageTitle: ['Coverage map', 'Abdeckungskarte'],
  coverageHelp: [
    'Rows are parts of the progression, columns are places. A number says how many links tie that part to records of that place. Click a cell to read the records, add a link, or question one.',
    'Zeilen sind Teile der Progression, Spalten sind Orte. Eine Zahl sagt, wie viele Verknüpfungen diesen Teil mit Einträgen dieses Ortes verbinden. Ein Klick auf eine Zelle zeigt die Einträge und erlaubt, zu verknüpfen oder zu hinterfragen.',
  ],
  coverageGroupBy: ['Group rows by', 'Zeilen gruppieren nach'],
  groupStructure: ['Strand', 'Strang'],
  groupBand: ['Grade band', 'Klassenstufe'],
  groupConcept: ['Concept', 'Konzept'],
  groupThread: ['Thread', 'Faden'],
  coverageOrder: ['Order places', 'Orte ordnen'],
  orderDefault: ['By country', 'Nach Land'],
  orderSimilar: ['By similarity', 'Nach Ähnlichkeit'],
  orderLinks: ['By links', 'Nach Verknüpfungen'],
  coverageOnlyLinked: ['Only places with links', 'Nur Orte mit Verknüpfungen'],
  coverageSearch: ['Search records and reasons', 'Einträge und Begründungen durchsuchen'],
  coverageSearchResult: ['{n} records match. Cells with a matching link are outlined.', '{n} Einträge passen. Zellen mit passender Verknüpfung sind umrandet.'],
  coverageExplain: [
    'Darker cells hold more links. Hatched cells mark a gap: the place has records, other places have links for this row, this place has none. A check mark means someone looked and found nothing that fits.',
    'Dunklere Zellen enthalten mehr Verknüpfungen. Schraffierte Zellen sind Lücken: Der Ort hat Einträge, andere Orte haben Verknüpfungen für diese Zeile, dieser nicht. Ein Haken heißt: Jemand hat geschaut und nichts Passendes gefunden.',
  ],
  coverageHow: [
    'Each cell counts the links from the row to records whose place is the column. A strand row adds up the links of its own parts. When rows are grouped by concept or thread, one part can appear under several groups.',
    'Jede Zelle zählt die Verknüpfungen der Zeile mit Einträgen, deren Ort die Spalte ist. Eine Strangzeile addiert die Verknüpfungen ihrer Teile. Bei Gruppierung nach Konzept oder Faden kann ein Teil unter mehreren Gruppen stehen.',
  ],
  matrixGap: ['gap', 'Lücke'],
  matrixTotal: ['Distinct links', 'Verknüpfungen'],
  legendCount: ['more links', 'mehr Verknüpfungen'],
  legendGap: ['gap', 'Lücke'],
  legendChecked: ['checked, nothing fits', 'geprüft, nichts passt'],

  // ---- network
  networkTitle: ['Network', 'Netzwerk'],
  networkHelp: [
    'The same links drawn as a network. Choose what the dots stand for. Point at a dot to read its name, click it to follow its connections.',
    'Dieselben Verknüpfungen als Netzwerk. Wählen Sie, wofür die Punkte stehen. Zeigen Sie auf einen Punkt für den Namen, klicken Sie, um seinen Verbindungen zu folgen.',
  ],
  netMode: ['Show', 'Zeigen'],
  netModeGrid: ['Parts and places', 'Teile und Orte'],
  netModeTies: ['Parts tied by shared records', 'Teile, verbunden durch gemeinsame Einträge'],
  netModePlaces: ['Places by similarity', 'Orte nach Ähnlichkeit'],
  netGridHelp: [
    'The progression is laid out as it is taught: one row per strand, one column per grade band. Places stand on the right. A line means at least one link, and a number on it counts the links.',
    'Die Progression ist so angeordnet, wie sie unterrichtet wird: eine Zeile je Strang, eine Spalte je Klassenstufe. Rechts stehen die Orte. Eine Linie bedeutet mindestens eine Verknüpfung, die Zahl darauf zählt sie.',
  ],
  netTiesHelp: [
    'Two parts are joined when the same record is linked to both. A bigger dot means more routes between other parts run through it. These parts hold the progression together.',
    'Zwei Teile sind verbunden, wenn derselbe Eintrag mit beiden verknüpft ist. Ein größerer Punkt heißt: Mehr Wege zwischen anderen Teilen führen über ihn. Diese Teile halten die Progression zusammen.',
  ],
  netPlacesHelp: [
    'Places that connect to the progression in a similar pattern sit joined by a thick line. A dot grows with the number of links. Places without links are left out.',
    'Orte, die sich in ähnlichem Muster mit der Progression verbinden, sind durch eine dicke Linie verbunden. Ein Punkt wächst mit der Zahl der Verknüpfungen. Orte ohne Verknüpfungen fehlen.',
  ],
  netFixed: ['Fixed', 'Fest'],
  netFixedHint: ['Always the same arrangement.', 'Immer dieselbe Anordnung.'],
  netLegendPlaces: ['Line thickness shows how alike two places are in what they connect to.', 'Die Liniendicke zeigt, wie ähnlich zwei Orte in ihren Verbindungen sind.'],
  netLegendStrand: ['strand', 'Strang'],
  netLegendPlace: ['place (colored by country)', 'Ort (Farbe nach Land)'],
  netStructure: ['How the parts hold together', 'Wie die Teile zusammenhalten'],
  netStructureWhat: [
    'Counts how many separate groups the parts fall into when they are joined by shared records, and how many stand alone.',
    'Zählt, in wie viele getrennte Gruppen die Teile zerfallen, wenn gemeinsame Einträge sie verbinden, und wie viele allein stehen.',
  ],
  netStructureHow: [
    'Parts are nodes and two parts share a line when at least one record is linked to both. Groups are connected components. Density is the share of all possible pairs that are joined.',
    'Teile sind Knoten, zwei Teile teilen eine Linie, wenn mindestens ein Eintrag mit beiden verknüpft ist. Gruppen sind zusammenhängende Komponenten. Die Dichte ist der Anteil aller möglichen Paare, die verbunden sind.',
  ],
  netParts: ['Parts', 'Teile'],
  netComponents: ['Separate groups', 'Getrennte Gruppen'],
  netIsolated: ['Parts that stand alone', 'Allein stehende Teile'],
  netDensity: ['Density (0 to 1)', 'Dichte (0 bis 1)'],
  netBridges: ['Records that tie parts together', 'Einträge, die Teile verbinden'],
  netBridgesWhat: [
    'A record linked to several parts joins them. The ones that reach into several strands are the strongest evidence that the progression and the place talk about the same thing across subjects.',
    'Ein mit mehreren Teilen verknüpfter Eintrag verbindet sie. Besonders aussagekräftig sind die, die in mehrere Stränge reichen: Sie zeigen, dass Progression und Ort fächerübergreifend dasselbe meinen.',
  ],
  netNoBridges: ['No record is linked to more than one part yet.', 'Noch ist kein Eintrag mit mehr als einem Teil verknüpft.'],
  netRecord: ['Record', 'Eintrag'],
  netSpans: ['Reaches', 'Reicht in'],
  netSpansValue: ['{o} parts, {s} strands', '{o} Teile, {s} Stränge'],

  // ---- flows
  flowsTitle: ['Flows', 'Flüsse'],
  flowsHelp: [
    'Follow the links from the progression through the kind of record to the place. The width of a band is the number of links. Click a bar to follow only its flows.',
    'Verfolgen Sie die Verknüpfungen von der Progression über die Art des Eintrags bis zum Ort. Die Breite eines Bandes ist die Zahl der Verknüpfungen. Ein Klick auf einen Balken zeigt nur seine Flüsse.',
  ],
  flowsStart: ['Start from', 'Beginnen bei'],
  flowsReverse: ['Start from places instead', 'Bei den Orten beginnen'],
  flowsKinds: ['Kind of record', 'Art des Eintrags'],
  flowsPlaces: ['Place', 'Ort'],
  flowsExplain: [
    'Reading across: how much of each strand is tied to laws, events, institutions or findings, and which place those records come from. A thick band into one place says that place supplies most of that evidence.',
    'Von links nach rechts gelesen: wie viel von jedem Strang an Gesetze, Ereignisse, Institutionen oder Befunde gebunden ist und aus welchem Ort diese Einträge stammen. Ein dickes Band in einen Ort heißt: Dieser Ort liefert den Großteil dieser Belege.',
  ],
  flowsHow: [
    'Each link contributes one unit per place its record belongs to, so a record that names two states counts in both. A part that sits under several concepts is shared between them in equal parts.',
    'Jede Verknüpfung zählt einmal je Ort, zu dem ihr Eintrag gehört. Ein Eintrag, der zwei Länder nennt, zählt in beiden. Ein Teil unter mehreren Konzepten wird zu gleichen Teilen auf sie verteilt.',
  ],

  // ---- timeline
  timelineTitle: ['Timeline', 'Zeitleiste'],
  timelineHelp: [
    'When each place adopted, revised or contested curriculum policy. A solid mark is a record the progression is linked to. An outline is a record nobody has linked yet.',
    'Wann welcher Ort Lehrplanpolitik beschlossen, überarbeitet oder bestritten hat. Eine ausgefüllte Markierung ist ein Eintrag, mit dem die Progression verknüpft ist. Ein Umriss ist ein Eintrag ohne Verknüpfung.',
  ],
  timelineYears: ['Years', 'Jahre'],
  timelineFrom: ['From year', 'Von Jahr'],
  timelineTo: ['To year', 'Bis Jahr'],
  timelineAll: ['All', 'Alle'],
  timelineSince2015: ['Since 2015', 'Seit 2015'],
  timelineOnlyLinked: ['Only records with a link', 'Nur Einträge mit Verknüpfung'],
  timelineEmpty: ['No dated records in this selection.', 'In dieser Auswahl gibt es keine datierten Einträge.'],
  timelineUnlinked: ['no link yet', 'noch keine Verknüpfung'],
  timelineSolid: ['dashed line: today', 'gestrichelte Linie: heute'],
  timelineRhythm: ['Rhythm by place', 'Rhythmus je Ort'],
  timelineDated: ['Dated records', 'Datierte Einträge'],
  timelineFirst: ['First', 'Erster'],
  timelineLatest: ['Latest', 'Letzter'],
  timelineLinkedN: ['With a link', 'Mit Verknüpfung'],
  timelineByPeriod: ['Records per 3 years', 'Einträge je 3 Jahre'],
  timelineExplain: [
    'Places differ in how often policy moves and how recently. A place whose latest record is old may have a newer change that the repository has not caught up with yet.',
    'Orte unterscheiden sich darin, wie oft und wie zuletzt sich Politik bewegt. Hat ein Ort nur alte Einträge, kann es neuere Änderungen geben, die das Repositorium noch nicht erfasst hat.',
  ],
  timelineHow: [
    'The date of a record is its event date, or the date it took effect. A bar runs from the start to the end date when both are known. Only records that carry a date appear here.',
    'Das Datum eines Eintrags ist sein Ereignisdatum oder das Datum des Inkrafttretens. Ein Balken reicht vom Beginn bis zum Ende, wenn beide bekannt sind. Nur Einträge mit Datum erscheinen hier.',
  ],
  timelineRecord: ['Records', 'Einträge'],
  timelineMore: ['{n} more records in {y}. Click to list them.', '{n} weitere Einträge in {y}. Klicken zum Auflisten.'],
  timelineLinkedTo: ['Linked to', 'Verknüpft mit'],
  timelineNoLinks: ['Not linked to any part of the progression yet.', 'Mit keinem Teil der Progression verknüpft.'],

  // ---- measures
  measuresTitle: ['Measures', 'Kennzahlen'],
  measuresHelp: [
    'Numbers that answer four questions: how much is linked, how evenly, where the places differ, and which parts hold the progression together. Each number shows the amount of data behind it.',
    'Zahlen zu vier Fragen: wie viel verknüpft ist, wie gleichmäßig, worin sich die Orte unterscheiden und welche Teile die Progression zusammenhalten. Jede Zahl zeigt, wie viele Daten dahinterstehen.',
  ],
  msGlance: ['Each place at a glance', 'Jeder Ort auf einen Blick'],
  msGlanceWhat: [
    'The plain counts. The small bars show how a place spreads its links over the rows, in row order.',
    'Die einfachen Zählungen. Die kleinen Balken zeigen, wie ein Ort seine Verknüpfungen auf die Zeilen verteilt, in Zeilenreihenfolge.',
  ],
  msGlanceHow: [
    'Links are counted per place. The median is the middle row count, with the range from the lower to the upper quarter in brackets. "With a reason" is the share of links that carry a written reason of at least 40 characters.',
    'Verknüpfungen werden je Ort gezählt. Der Median ist die mittlere Zeilenzahl, in Klammern der Bereich vom unteren bis zum oberen Viertel. „Mit Begründung“ ist der Anteil der Verknüpfungen mit einer schriftlichen Begründung von mindestens 40 Zeichen.',
  ],
  msRecordsLinked: ['Records linked', 'Verknüpfte Einträge'],
  msRowsCovered: ['Rows reached', 'Erreichte Zeilen'],
  msMedian: ['Median per row', 'Median je Zeile'],
  msProfile: ['Spread over rows', 'Verteilung auf Zeilen'],
  msReasoned: ['With a reason', 'Mit Begründung'],
  msYears: ['Record years', 'Jahre der Einträge'],
  msEven: ['How evenly each place spreads its links', 'Wie gleichmäßig jeder Ort seine Verknüpfungen verteilt'],
  msEvenWhat: [
    '1 means the links of a place fall equally on every row. 0 means they all pile onto one row. The bar shows the likely range given how few links there are.',
    '1 heißt: Die Verknüpfungen eines Ortes fallen gleichmäßig auf jede Zeile. 0 heißt: Alle häufen sich auf einer Zeile. Der Balken zeigt die wahrscheinliche Spanne bei so wenigen Verknüpfungen.',
  ],
  msEvenHow: [
    'Evenness is the Shannon entropy of a place\'s link counts over the rows, divided by its maximum (log2 of the number of rows). The range is a 90% bootstrap interval from resampling the links 400 times. Concentration is the Gini coefficient of the same counts. Places with fewer than 6 links are not rated.',
    'Gleichmäßigkeit ist die Shannon-Entropie der Verknüpfungszahlen eines Ortes über die Zeilen, geteilt durch ihr Maximum (log2 der Zeilenzahl). Die Spanne ist ein 90-%-Bootstrap-Intervall aus 400 Ziehungen der Verknüpfungen. Konzentration ist der Gini-Koeffizient derselben Zahlen. Orte mit weniger als 6 Verknüpfungen werden nicht bewertet.',
  ],
  msEvenness: ['Evenness (0 to 1)', 'Gleichmäßigkeit (0 bis 1)'],
  msConcentration: ['Concentration', 'Konzentration'],
  msTooFew: ['only {n} {n|link|links}, too few to rate', 'nur {n} {n|Verknüpfung|Verknüpfungen}, zu wenig für eine Bewertung'],
  msDiff: ['How different the places are', 'Wie verschieden die Orte sind'],
  msDiffWhat: [
    'Two places are close when their links land on the same rows in the same proportions. 0 means identical patterns, 1 means no row in common. Places are ordered so similar ones sit together.',
    'Zwei Orte sind nah, wenn ihre Verknüpfungen in gleichen Anteilen auf dieselben Zeilen fallen. 0 heißt: gleiches Muster, 1 heißt: keine gemeinsame Zeile. Die Orte sind so geordnet, dass ähnliche nebeneinander stehen.',
  ],
  msDiffHow: [
    'The number is the Jensen-Shannon distance between the two places\' link profiles over the chosen rows (square root of the divergence in bits). Small samples look different by chance alone, so each pair is compared with 300 random re-dealings of the pooled links. An outlined cell is more different than 95% of those re-dealings. Faded cells have fewer than 6 links on one side and are left unjudged.',
    'Die Zahl ist die Jensen-Shannon-Distanz zwischen den Verknüpfungsprofilen zweier Orte über die gewählten Zeilen (Wurzel der Divergenz in Bit). Kleine Stichproben wirken allein durch Zufall verschieden. Daher wird jedes Paar mit 300 zufälligen Neuverteilungen der gemeinsamen Verknüpfungen verglichen. Eine umrandete Zelle ist verschiedener als 95 % dieser Neuverteilungen. Blasse Zellen haben auf einer Seite weniger als 6 Verknüpfungen und bleiben unbewertet.',
  ],
  msNeedTwo: ['Two places with links are needed for a comparison.', 'Für einen Vergleich braucht es zwei Orte mit Verknüpfungen.'],
  msClosest: ['Closest: {a} and {b} (distance {d}).', 'Am nächsten: {a} und {b} (Distanz {d}).'],
  msOnlyPair: ['{a} and {b}: distance {d}.', '{a} und {b}: Distanz {d}.'],
  msFarthest: ['Farthest: {a} and {b} (distance {d}).', 'Am weitesten: {a} und {b} (Distanz {d}).'],
  msCell: [
    '{a} and {b}: distance {d}. Chance alone would give about {c} for samples of {n1} and {n2} links (p = {p}).',
    '{a} und {b}: Distanz {d}. Der Zufall allein ergäbe etwa {c} bei Stichproben von {n1} und {n2} Verknüpfungen (p = {p}).',
  ],
  msDiffLegend: [
    'Darker = more different. Outlined = more different than chance. Faded = too few links to judge. Click a cell to compare the two places side by side.',
    'Dunkler = verschiedener. Umrandet = verschiedener als der Zufall. Blass = zu wenige Verknüpfungen für ein Urteil. Ein Klick auf eine Zelle stellt die beiden Orte gegenüber.',
  ],
  msEmph: ['Where each place puts its weight', 'Wo jeder Ort sein Gewicht setzt'],
  msEmphWhat: [
    'Which rows a place links to more or less than the places together would suggest. ▲ marks clearly more, ▼ clearly fewer.',
    'Welche Zeilen ein Ort stärker oder schwächer verknüpft, als alle Orte zusammen erwarten ließen. ▲ heißt deutlich mehr, ▼ deutlich weniger.',
  ],
  msEmphHow: [
    'Each cell compares its count with what the row and column totals predict if places and rows were unrelated, using adjusted standardized residuals. Beyond ±2 a cell is marked. The summary above uses mutual information: how many bits the place tells you about the row, with the small-sample bias removed, scaled to 0 to 1 and compared with 300 shuffles.',
    'Jede Zelle vergleicht ihre Zahl mit dem, was die Zeilen- und Spaltensummen erwarten ließen, wenn Orte und Zeilen unabhängig wären (angepasste standardisierte Residuen). Jenseits von ±2 wird die Zelle markiert. Die Zusammenfassung oben nutzt die Transinformation: wie viele Bit der Ort über die Zeile verrät, um die Verzerrung bei kleinen Stichproben bereinigt, auf 0 bis 1 skaliert und mit 300 Mischungen verglichen.',
  ],
  msMiNone: ['Not enough links to tell.', 'Zu wenige Verknüpfungen für eine Aussage.'],
  msMiSummary: [
    'Knowing the place explains {v} of the uncertainty about which row a link lands on. Pure chance would give about {c} (p = {p}).',
    'Der Ort erklärt {v} der Unsicherheit darüber, auf welche Zeile eine Verknüpfung fällt. Der reine Zufall ergäbe etwa {c} (p = {p}).',
  ],
  msMiBeyond: ['That is more than chance.', 'Das ist mehr als Zufall.'],
  msMiWithin: ['That is within chance, so the differences below are leads to check.', 'Das liegt im Bereich des Zufalls. Die Unterschiede unten sind daher Hinweise zum Prüfen.'],
  msEmphLegend: ['Numbers are link counts. Shaded cells differ clearly from what the totals predict.', 'Die Zahlen sind Verknüpfungszahlen. Schattierte Zellen weichen deutlich von dem ab, was die Summen erwarten ließen.'],
  msStruct: ['How the parts hold together', 'Wie die Teile zusammenhalten'],
  msStructWhat: [
    'Parts of the progression are joined when one record is linked to both. This shows whether the policy records tie the progression into one piece, and whether ties stay inside strands or reach across.',
    'Teile der Progression sind verbunden, wenn ein Eintrag mit beiden verknüpft ist. Das zeigt, ob die Einträge zur Lehrplanpolitik die Progression zu einem Ganzen verbinden und ob Verbindungen innerhalb von Strängen bleiben oder darüber hinausreichen.',
  ],
  msStructHow: [
    'Groups are connected components. Density is the share of possible pairs that are joined. The two grouping numbers are Newman modularity of the strand grouping and of the grade-band grouping: above about 0.3 the ties stay inside the groups, near 0 they ignore them, below 0 they cross them. A bridging record is linked to more than one part.',
    'Gruppen sind zusammenhängende Komponenten. Die Dichte ist der Anteil der möglichen Paare, die verbunden sind. Die beiden Gruppierungszahlen sind die Newman-Modularität der Strang- und der Klassenstufen-Gruppierung: Über etwa 0,3 bleiben die Verbindungen innerhalb der Gruppen, nahe 0 ignorieren sie die Gruppen, unter 0 queren sie sie. Ein verbindender Eintrag ist mit mehr als einem Teil verknüpft.',
  ],
  msModStrand: ['Ties stay inside strands (modularity)', 'Verbindungen bleiben im Strang (Modularität)'],
  msModBand: ['Ties stay inside grade bands (modularity)', 'Verbindungen bleiben in der Klassenstufe (Modularität)'],
  msBridging: ['Records linked to more than one part', 'Mit mehr als einem Teil verknüpfte Einträge'],
  sbsTitle: ['Side by side', 'Gegenüberstellung'],
  sbsHelp: [
    'Two places compared in detail: what each links to, where they agree, and which records only one of them uses. Pick any two places.',
    'Zwei Orte im Detail verglichen: womit jeder verknüpft ist, wo sie übereinstimmen und welche Einträge nur einer nutzt. Wählen Sie beliebige zwei Orte.',
  ],
  sbsPlaceA: ['First place', 'Erster Ort'],
  sbsPlaceB: ['Second place', 'Zweiter Ort'],
  sbsVersus: ['against', 'gegen'],
  sbsShowAll: ['Show rows with no links', 'Zeilen ohne Verknüpfungen zeigen'],
  sbsDistance: ['Distance (0 to 1)', 'Distanz (0 bis 1)'],
  sbsChance: ['chance gives about {c} (p = {p})', 'Zufall ergäbe etwa {c} (p = {p})'],
  sbsRowOverlap: ['Rows both reach', 'Von beiden erreichte Zeilen'],
  sbsRowOverlapSub: ['share of all rows either reaches', 'Anteil aller Zeilen, die einer erreicht'],
  sbsSharedRecords: ['Records both use', 'Von beiden genutzte Einträge'],
  sbsSmall: [
    'One of the two places has fewer than 6 links. Read the numbers as a sketch.',
    'Einer der beiden Orte hat weniger als 6 Verknüpfungen. Lesen Sie die Zahlen als Skizze.',
  ],
  sbsSummary: ['In words', 'In Worten'],
  sbsTotals: ['{a} has {na} links and {b} has {nb}.', '{a} hat {na} Verknüpfungen und {b} hat {nb}.'],
  sbsRows: [
    '{both} rows have links in both places, {oa} only in {a} and {ob} only in {b}.',
    '{both} Zeilen haben Verknüpfungen in beiden Orten, {oa} nur in {a} und {ob} nur in {b}.',
  ],
  sbsBiggest: [
    'The biggest difference in emphasis is "{row}": {p1} of the links in {a} against {p2} in {b}.',
    'Der größte Unterschied im Schwerpunkt liegt bei „{row}“: {p1} der Verknüpfungen in {a} gegen {p2} in {b}.',
  ],
  sbsShared: ['{n} records are linked in both places.', '{n} Einträge sind in beiden Orten verknüpft.'],
  sbsButterfly: ['Share of each place\'s links, row by row', 'Anteil der Verknüpfungen jedes Ortes, Zeile für Zeile'],
  sbsButterflyWhat: [
    'Each bar is the share of a place\'s own links that land on that row, so places with different numbers of links can be compared fairly. Click a bar to read the records.',
    'Jeder Balken ist der Anteil der eigenen Verknüpfungen eines Ortes, der auf diese Zeile fällt. So lassen sich Orte mit unterschiedlich vielen Verknüpfungen fair vergleichen. Ein Klick auf einen Balken zeigt die Einträge.',
  ],
  sbsButterflyHow: [
    'Share = links on the row divided by all links of that place. The distance in the cards above is the Jensen-Shannon distance between the two share profiles, compared with 400 random re-dealings of the pooled links.',
    'Anteil = Verknüpfungen auf der Zeile geteilt durch alle Verknüpfungen dieses Ortes. Die Distanz in den Kacheln oben ist die Jensen-Shannon-Distanz zwischen den beiden Anteilsprofilen, verglichen mit 400 zufälligen Neuverteilungen der gemeinsamen Verknüpfungen.',
  ],
  sbsOnly: ['Linked only in {place}', 'Nur in {place} verknüpft'],
  curateTitle: ['Curate', 'Pflegen'],
  curateHelp: [
    'The work list for improving the links: where a place is missing a link that other places have, which records nobody has linked, which links need a better reason, and what reviewers have questioned.',
    'Die Arbeitsliste zum Verbessern der Verknüpfungen: wo einem Ort eine Verknüpfung fehlt, die andere Orte haben, welche Einträge niemand verknüpft hat, welche Verknüpfungen eine bessere Begründung brauchen und was Prüfende in Frage gestellt haben.',
  ],
  curRoleEdit: ['You can add, edit, confirm and remove links, and question them.', 'Sie können Verknüpfungen hinzufügen, ändern, bestätigen, entfernen und in Frage stellen.'],
  curRoleCritic: ['You can question links. Editors make the changes.', 'Sie können Verknüpfungen in Frage stellen. Änderungen nehmen Bearbeitende vor.'],
  curRoleView: ['You can look through the list. Ask an editor to act on it.', 'Sie können die Liste durchsehen. Bitten Sie Bearbeitende, sie abzuarbeiten.'],
  curRecordsLinked: ['Records with a link', 'Einträge mit Verknüpfung'],
  curGaps: ['Gaps', 'Lücken'],
  curRecords: ['Unlinked records', 'Unverknüpfte Einträge'],
  curWeak: ['Links to strengthen', 'Zu stärkende Verknüpfungen'],
  curLog: ['Reviewer log', 'Prüfprotokoll'],
  curGapsWhat: [
    'A gap is a row with no link in a place that has records, while other places do link that row. The list starts with the gaps most likely to be worth filling, and shows the record that shares the most words with the row.',
    'Eine Lücke ist eine Zeile ohne Verknüpfung in einem Ort mit Einträgen, während andere Orte diese Zeile verknüpfen. Die Liste beginnt mit den Lücken, deren Füllung sich am ehesten lohnt, und zeigt den Eintrag mit den meisten gemeinsamen Wörtern.',
  ],
  curGapsHow: [
    'Priority is half the share of other places that link the row plus half the word match of the best record (cosine similarity of TF-IDF weights, scaled up, with a small lift for kinds of record that are linked more often). Cells already marked "checked, nothing fits" are left out. A word match is a pointer for a person to read, and the person decides.',
    'Die Priorität ist zur Hälfte der Anteil der anderen Orte, die die Zeile verknüpfen, und zur Hälfte die Wortübereinstimmung des besten Eintrags (Kosinus-Ähnlichkeit von TF-IDF-Gewichten, hochskaliert, mit leichtem Vorzug für häufiger verknüpfte Arten von Einträgen). Zellen, die als „geprüft, nichts passt“ markiert sind, fehlen. Eine Wortübereinstimmung ist ein Hinweis zum Lesen, die Entscheidung trifft ein Mensch.',
  ],
  curNoGaps: ['No gaps found for this selection.', 'Für diese Auswahl wurden keine Lücken gefunden.'],
  curPeers: ['{n} of {u} places with links have this row.', '{n} von {u} Orten mit Verknüpfungen haben diese Zeile.'],
  curReview: ['Review', 'Prüfen'],
  curOpen: ['Open', 'Öffnen'],
  curMore: ['Show more', 'Mehr zeigen'],
  curRecordsWhat: [
    'Records that no part of the progression is linked to yet, ordered by how closely each resembles a part. A record with no good match may simply be outside the scope of this progression.',
    'Einträge, mit denen noch kein Teil der Progression verknüpft ist, geordnet danach, wie stark sie einem Teil ähneln. Ein Eintrag ohne guten Treffer liegt vielleicht einfach außerhalb dieser Progression.',
  ],
  curRecordsHow: [
    'Each record\'s title and summary is matched against the title, description and concepts of every part, by shared words. Many records have only a title, so their match is weak.',
    'Titel und Zusammenfassung jedes Eintrags werden mit Titel, Beschreibung und Konzepten jedes Teils verglichen, über gemeinsame Wörter. Viele Einträge haben nur einen Titel, ihr Treffer ist daher schwach.',
  ],
  curResembles: ['resembles', 'ähnelt'],
  curWeakWhat: [
    'Links with no written reason, a very short one, an automatic one, an AI draft nobody has confirmed, or a question from a reviewer. Open one to fix it.',
    'Verknüpfungen ohne schriftliche Begründung, mit einer sehr kurzen, einer automatischen, einem KI-Entwurf ohne Bestätigung oder mit einer Frage von Prüfenden. Öffnen Sie eine, um sie zu verbessern.',
  ],
  curNoWeak: ['Every link has a reason and none is open to question.', 'Jede Verknüpfung hat eine Begründung und keine ist offen in Frage gestellt.'],
  curLogWhat: [
    'What reviewers said about links, newest first. The record stays in the log even after the link is changed.',
    'Was Prüfende zu Verknüpfungen gesagt haben, neueste zuerst. Der Eintrag bleibt im Protokoll, auch nachdem die Verknüpfung geändert wurde.',
  ],
  curLogUnavailable: ['The reviewer log arrives with the next database update.', 'Das Prüfprotokoll kommt mit dem nächsten Datenbank-Update.'],
  curLogEmpty: ['Nobody has questioned or confirmed a link yet.', 'Noch hat niemand eine Verknüpfung in Frage gestellt oder bestätigt.'],
  spacesTitle: ['Between spaces', 'Zwischen den Räumen'],
  spacesHelp: [
    'Compares this space with its counterpart on breadth, depth and grounding, plus the comparison notes researchers wrote between their strands.',
    'Vergleicht diesen Raum mit seinem Gegenstück nach Breite, Tiefe und Verankerung, dazu die Vergleichsnotizen, die Forschende zwischen den Strängen geschrieben haben.',
  ],
  spacesAgainst: ['Compared with {name}', 'Im Vergleich mit {name}'],
  structTitle: ['Structure at equal size', 'Struktur bei gleicher Größe'],
  structHint: [
    'These measures describe how the parts of each space share concepts. A space with more parts and a larger vocabulary reaches further for that reason alone, so the larger space is also drawn down to the size of the smaller one, many times over. The ranges say how much each measure depends on which parts happened to be there. They say nothing about which space is better, or about what students learn.',
    'Diese Kennzahlen beschreiben, wie die Teile jedes Raums Konzepte teilen. Ein Raum mit mehr Teilen und größerem Wortschatz reicht schon deshalb weiter. Darum wird der größere Raum viele Male auf die Größe des kleineren verkleinert. Die Spannen zeigen, wie stark jede Kennzahl davon abhängt, welche Teile gerade vorhanden sind. Sie sagen nichts darüber, welcher Raum besser ist, oder was Lernende lernen.',
  ],
  structHow: [
    'Only the grade-band parts of the strands count. Draft example and bridge parts that belong to no strand are left out. Equal size: from the larger space, {n} parts are drawn at random without putting any back, 200 times. The cell shows the middle value and, in brackets, the range between the 5th and 95th percentile. Stability: 10% of the links between parts and concepts are dropped at random, 200 times, and each measure is recomputed. Overlap between two parts is the share of their concepts they have in common. Spread is the evenness of links across the concepts in use (1 means every concept carries the same number of links). Fixed seeds, so the numbers repeat on reload.',
    'Es zählen nur die Klassenstufen-Teile der Stränge. Entwurfs-Beispiele und Brückenfälle, die zu keinem Strang gehören, bleiben draußen. Gleiche Größe: Aus dem größeren Raum werden {n} Teile zufällig ohne Zurücklegen gezogen, 200-mal. Die Zelle zeigt den mittleren Wert und in Klammern die Spanne zwischen dem 5. und 95. Perzentil. Stabilität: 10 % der Verknüpfungen zwischen Teilen und Konzepten werden zufällig entfernt, 200-mal, und jede Kennzahl wird neu berechnet. Überlappung zweier Teile ist der Anteil ihrer gemeinsamen Konzepte. Streuung ist die Gleichmäßigkeit der Verknüpfungen über die genutzten Konzepte (1 heißt: jedes Konzept trägt gleich viele). Feste Startwerte, die Zahlen wiederholen sich also beim Neuladen.',
  ],
  structMeasure: ['Measure', 'Kennzahl'],
  structActual: ['{name} as it is', '{name} wie vorhanden'],
  structCol: ['{name} (at {n} parts)', '{name} (bei {n} Teilen)'],
  structStableTitle: ['How steady the measures are', 'Wie stabil die Kennzahlen sind'],
  structStable: ['Range for {name} when 10% of its links are dropped', 'Spanne für {name}, wenn 10 % der Verknüpfungen fehlen'],
  structParts: ['Parts', 'Teile'],
  structConceptsUsed: ['Concepts in use', 'Genutzte Konzepte'],
  structConceptsPerPart: ['Concepts per part', 'Konzepte pro Teil'],
  structMainShare: ['Share of links that are main concepts', 'Anteil der Verknüpfungen mit Hauptkonzepten'],
  structSpread: ['Spread of links across concepts', 'Streuung der Verknüpfungen über die Konzepte'],
  structOverlap: ['Overlap between two parts', 'Überlappung zweier Teile'],
  structJoined: ['Pairs of parts with a concept in common', 'Teilepaare mit einem gemeinsamen Konzept'],
  structGroup: ['Parts in the largest connected group', 'Teile in der größten verbundenen Gruppe'],
  structEqualSize: ['The smaller space has {n} parts, so {name} is drawn down to {n}.', 'Der kleinere Raum hat {n} Teile, darum wird {name} auf {n} verkleinert.'],
  structNoData: ['No parts with concept tags found.', 'Keine Teile mit Konzept-Zuordnung gefunden.'],
  spacesSankeyTitle: ['Strands compared', 'Verglichene Stränge'],
  spacesSankeyHint: [
    'Each flow is a comparison note between a strand on the left and a strand on the right. The width shows how many notes. The color shows the kind of comparison. Click a strand to follow only its flows.',
    'Jeder Fluss ist eine Vergleichsnotiz zwischen einem Strang links und einem Strang rechts. Die Breite zeigt, wie viele Notizen es sind, die Farbe die Art des Vergleichs. Ein Klick auf einen Strang zeigt nur seine Flüsse.',
  ],
  spacesEmpty: ['No comparison notes to show yet.', 'Noch keine Vergleichsnotizen zum Anzeigen.'],
  spacesNotesUnit: ['notes', 'Notizen'],
  spacesNotes: ['Comparison notes', 'Vergleichsnotizen'],
  spacesNoNotes: ['No comparison notes yet between these two spaces.', 'Noch keine Vergleichsnotizen zwischen diesen beiden Räumen.'],
  spacesIllustrates: ['Illustrates', 'Veranschaulicht'],

  reportTitle: ['Report', 'Bericht'],
  reportHelp: [
    'A written summary of what this view shows, ready to read, paste or hand on, plus a table of every link for a spreadsheet. A keyword narrows the links.',
    'Eine schriftliche Zusammenfassung dessen, was diese Ansicht zeigt, zum Lesen, Einfügen oder Weitergeben, dazu eine Tabelle aller Verknüpfungen für die Tabellenkalkulation. Ein Stichwort grenzt die Verknüpfungen ein.',
  ],
  repGenerated: ['Generated on {date}.', 'Erstellt am {date}.'],
  repKeyword: ['Keyword', 'Stichwort'],
  repKeywordPlaceholder: ['for example: Informatik, norms, evolution', 'zum Beispiel: Informatik, Normen, Evolution'],
  repNumbers: ['In numbers', 'In Zahlen'],
  repLinks: ['{n} of {total} links shown', '{n} von {total} Verknüpfungen angezeigt'],
  repPlaces: ['{n} places with links', '{n} Orte mit Verknüpfungen'],
  repPlacesTable: ['Places', 'Orte'],
  repDifferences: ['Where places differ most', 'Wo sich Orte am stärksten unterscheiden'],
  repPair: ['Pair', 'Paar'],
  repChance: ['By chance', 'Zufällig'],
  repLinksSection: ['Links', 'Verknüpfungen'],
  repDownloadMd: ['Download (Markdown)', 'Herunterladen (Markdown)'],
  repNoMatches: ['No link matches this keyword.', 'Keine Verknüpfung passt zu diesem Stichwort.'],

  // ---- school years
  navSchoolYears: ['School years', 'Schuljahre'],
  syTitle: ['School years', 'Schuljahre'],
  syHelp: [
    'When each place teaches a topic: the units of its official curriculum, placed on the school years with the hours it gives them. Pick a subject and the topics to compare.',
    'Wann welcher Ort ein Thema unterrichtet: die Einheiten seines offiziellen Lehrplans auf den Schuljahren, mit den Stunden, die er ihnen gibt. Wählen Sie ein Fach und die Themen zum Vergleichen.',
  ],
  syNoUnits: [
    'No curriculum units are loaded for the places chosen yet. They exist for some German states only.',
    'Für die gewählten Orte sind noch keine Lehrplaneinheiten geladen. Es gibt sie bisher nur für einige deutsche Länder.',
  ],
  sySubject: ['Subject', 'Fach'],
  syTopics: ['Topics', 'Themen'],
  syAllTopics: ['All topics', 'Alle Themen'],
  syGrade: ['Grade', 'Klasse'],
  syTotal: ['Units', 'Einheiten'],
  syUnitsN: ['{n} units', '{n} Einheiten'],
  syNoHoursNote: ['{n} state no hours', '{n} ohne Stundenangabe'],
  syHoursGrid: ['Hours by school year', 'Stunden je Schuljahr'],
  syHoursGridWhat: [
    'Each cell is the number of hours the Lehrplan gives to the chosen topics in that school year. A unit that spans two years is split evenly. A number in brackets counts units where the Lehrplan states no hours. Click a cell to read the units.',
    'Jede Zelle zeigt die Stunden, die der Lehrplan den gewählten Themen in diesem Schuljahr gibt. Eine Einheit über zwei Jahre wird gleichmäßig geteilt. Eine Zahl in Klammern zählt Einheiten, für die der Lehrplan keine Stunden nennt. Ein Klick auf eine Zelle zeigt die Einheiten.',
  ],
  syHoursGridHow: [
    'Hours are the guide values (Zeitrichtwerte or Stundenrichtwerte) the Lehrplan gives each unit, taken from the official page. Places differ in how they set them: some leave part of the year free, so hours are comparable within a place more than between places.',
    'Die Stunden sind die Richtwerte (Zeitrichtwerte oder Stundenrichtwerte), die der Lehrplan jeder Einheit gibt, von der offiziellen Seite übernommen. Orte setzen sie unterschiedlich an und lassen teils einen Teil des Jahres frei. Die Stunden sind daher innerhalb eines Ortes besser vergleichbar als zwischen Orten.',
  ],
  syFirst: ['First school year a topic appears', 'Erstes Schuljahr, in dem ein Thema vorkommt'],
  syFirstWhat: [
    'The earliest school year with a unit on the topic. The earliest place is in bold. A dash means no unit on the topic in the units loaded.',
    'Das früheste Schuljahr mit einer Einheit zum Thema. Der früheste Ort ist fett. Ein Strich heißt: keine Einheit zum Thema unter den geladenen.',
  ],
  syFirstHow: [
    'Taken from the lowest grade of any unit carrying the topic tag. The tags were set when each unit was recorded, from its title and text, and a person has not checked them. Only the units loaded count, which for a subject is a selection of the relevant ones.',
    'Entnommen der niedrigsten Klasse einer Einheit mit dem Themen-Etikett. Die Etiketten wurden beim Erfassen jeder Einheit nach Titel und Text gesetzt, eine Person hat sie nicht geprüft. Es zählen nur die geladenen Einheiten, bei einem Fach also eine Auswahl der einschlägigen.',
  ],
  syShares: ['Where the hours fall: school stages', 'Wohin die Stunden fallen: Schulstufen'],
  sySharesWhat: [
    'The share of the chosen topics that falls in each stage of school. Hours are used where the Lehrplan states them, units otherwise.',
    'Der Anteil der gewählten Themen, der auf jede Schulstufe fällt. Es zählen Stunden, wo der Lehrplan sie nennt, sonst Einheiten.',
  ],
  syBasisHours: ['share of hours', 'Anteil der Stunden'],
  syBasisUnits: ['share of units (no hours stated)', 'Anteil der Einheiten (keine Stunden angegeben)'],
  syDistance: ['How alike the places are', 'Wie ähnlich die Orte sind'],
  syDistanceWhat: [
    '0 means two places spread the chosen topics over the school years in the same way, 1 means they share no school year. A place with fewer than 5 units is faded: the number is a sketch.',
    '0 heißt: Zwei Orte verteilen die gewählten Themen gleich auf die Schuljahre, 1 heißt: Sie teilen kein Schuljahr. Ein Ort mit weniger als 5 Einheiten ist blass dargestellt, die Zahl ist dann eine Skizze.',
  ],
  syDistanceHow: [
    'Jensen-Shannon distance (square root of the divergence in bits) between the two places\' hours per school year, or unit counts where either place states no hours.',
    'Jensen-Shannon-Distanz (Wurzel der Divergenz in Bit) zwischen den Stunden je Schuljahr zweier Orte, oder den Einheitenzahlen, wo einer der Orte keine Stunden nennt.',
  ],
  syNeedTwo: ['Two places with units are needed for a comparison.', 'Für einen Vergleich braucht es zwei Orte mit Einheiten.'],
  syDrawerTitle: ['Grade {g}: {n} units', 'Klasse {g}: {n} Einheiten'],
  msMix: ['Kinds of record behind the links', 'Art der Einträge hinter den Verknüpfungen'],
  msMixWhat: [
    'A place can lean on laws and standards, on dated events, or on analyses. The mix shows what kind of evidence the progression is tied to there.',
    'Ein Ort kann sich auf Gesetze und Standards, auf datierte Ereignisse oder auf Analysen stützen. Die Mischung zeigt, an welche Art von Belegen die Progression dort gebunden ist.',
  ],
} as const

export type StringKey = keyof typeof S
export type Translate = (key: StringKey, params?: Record<string, string | number>) => string

export function makeT(lang: Lang): Translate {
  const i = lang === 'de' ? 1 : 0
  return (key, params) => {
    const raw = (S[key] as readonly [string, string])[i]
    if (!params) return raw
    // {n|link|links} picks the singular form when n is 1.
    const withPlurals = raw.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_, k, one, many) => (Number(params[k]) === 1 ? one : many))
    return withPlurals.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`))
  }
}

export { S as STRING_TABLE }
