import type { HandIn } from './student-handin'
import { JUDGMENT_SCALE } from './supabase/student-work'

// The readable Word version of the hand-in. Built from the same data object as
// the JSON file (student-handin.ts), so the two cannot disagree. Loaded on
// demand: the docx library is large and only needed at download time.

const SCALE_LABEL = new Map(JUDGMENT_SCALE.map((s) => [s.value, s.label]))

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export async function buildHandInDocx(h: HandIn): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = await import('docx')

  const p = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    new Paragraph({ children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size })], spacing: { after: 100 } })
  const h1 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 120 } })
  const empty = (text = 'Noch nichts eingetragen.') => p(text, { italics: true })

  const cell = (text: string, bold = false, width?: number) =>
    new TableCell({
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold, size: 18 })] })],
    })
  const table = (header: string[], rows: string[][], widths?: number[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, true, widths?.[i])) }),
        ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, false, widths?.[i])) })),
      ],
    })

  const rating = (v: number | null) => (v == null ? '–' : `${v} (${SCALE_LABEL.get(v) ?? ''})`)

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []

  children.push(new Paragraph({ text: 'Ergebnis zu Aufgabe 1: Basiskonzepte', heading: HeadingLevel.TITLE }))
  if (h.tool.sandbox) children.push(p('SANDBOX-DATEI: erzeugt von einer synthetischen Testperson, keine echte Studierendenarbeit.', { bold: true }))
  children.push(p(`${h.task.course}`))
  children.push(p(`Teilnahme-Code: ${h.participant_code}`))
  children.push(p(`Gruppe: ${h.groups.length ? h.groups.join(', ') : 'keine gewählt'}`))
  children.push(p(`Erstellt am ${formatDate(h.exported_at)}`))

  // The Thema and Basiskonzepte/Querschnitt steps were taken out of the
  // student screens (2026-10-29). Their sections only appear when a student
  // already filled them in, and the numbering follows what is printed.
  let n = 0
  const sec = (title: string) => h1(`${++n}. ${title}`)

  if (h.topic.favorite_themes.length || h.topic.own_topic || h.topic.reasoning) {
    children.push(sec('Thema'))
    if (h.topic.favorite_themes.length) children.push(p(`Lieblingsthemen der Biologie: ${h.topic.favorite_themes.join(', ')}`))
    if (h.topic.own_topic) children.push(p(`Eigenes Thema: ${h.topic.own_topic}`))
    if (h.topic.reasoning) children.push(p(`Begründung: ${h.topic.reasoning}`))
  }

  if (h.grade_bands.bands.length) {
    children.push(sec('Klassenstufen'))
    children.push(p(`Bearbeitete Klassenstufen: ${h.grade_bands.bands.join(', ')}`))
    if (h.grade_bands.note) children.push(p(h.grade_bands.note))
  }

  children.push(sec('Gemerkte Lernziele im Thüringer Lehrplan'))
  if (h.starred_lernziele.length) {
    children.push(
      table(
        ['Kl.', 'Thema', 'Lernziel'],
        h.starred_lernziele.map((l) => [l.grade_band ?? '', [l.thema, l.unterthema].filter(Boolean).join(' / '), l.title]),
        [8, 32, 60]
      )
    )
  } else children.push(empty())

  children.push(sec('Beurteilung der vorgeschlagenen Basiskonzept-Verknüpfungen'))
  children.push(p('Skala: 1 = trifft nicht zu, 2 = trifft eher nicht zu, 3 = trifft eher zu, 4 = trifft voll zu.', { italics: true }))
  if (h.link_judgments.length) {
    children.push(
      table(
        ['Lernziel', 'Basiskonzept', 'Vorschlag im Tool (0–3)', 'Fachliche Korrektheit', 'Beitrag zum eigenen Fachwissen', 'Didaktische Relevanz', 'Anmerkung'],
        h.link_judgments.map((j) => [
          j.lernziel_title,
          j.basiskonzept,
          j.curriculum_relevance == null ? '–' : String(j.curriculum_relevance),
          rating(j.ratings.correctness),
          rating(j.ratings.own_knowledge),
          rating(j.ratings.didactic_relevance),
          j.note,
        ]),
        [22, 14, 8, 12, 12, 12, 20]
      )
    )
  } else children.push(empty())

  if (h.link_proposals.length) {
    children.push(sec('Ergänzte Verknüpfungen'))
    children.push(
      table(
        ['Lernziel', 'Basiskonzept', 'Begründung'],
        h.link_proposals.map((l) => [l.lernziel_title ?? '', l.basiskonzept, l.description]),
        [30, 20, 50]
      )
    )
  }

  if (h.topic_basiskonzepte.length) {
    children.push(sec('Basiskonzepte zum Thema'))
    for (const b of h.topic_basiskonzepte) {
      children.push(p(b.basiskonzept, { bold: true }))
      children.push(p(b.concrete_link || '(keine Beschreibung)'))
    }
  }

  if (h.cross_cutting.length) {
    children.push(sec('Querschnittsaufgaben und überfachliche Kompetenzen'))
    for (const c of h.cross_cutting) children.push(p(`${c.theme}${c.note ? `: ${c.note}` : ''}`))
  }

  children.push(sec('Reflexion'))
  const written = h.reflections.filter((r) => r.text)
  if (written.length) {
    for (const r of written) {
      children.push(p(r.prompt, { bold: true }))
      children.push(p(r.text))
    }
  } else children.push(empty())

  children.push(
    p(
      'Diese Datei enthält weder deinen Namen noch deine E-Mail-Adresse.',
      { italics: true, size: 16 }
    )
  )

  const doc = new Document({
    creator: 'EvoMentor (OpenLPM)',
    title: 'Ergebnis zu Aufgabe 1: Basiskonzepte',
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}
