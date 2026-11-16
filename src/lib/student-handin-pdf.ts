import { groupNumberLine, type HandIn } from './student-handin'
import { JUDGMENT_SCALE } from './supabase/student-work'

// The PDF version of the hand-in, for students whose device or program does not
// open the Word file properly (Susan, 2026-11-16: some students handed in a PDF
// because the Word file failed on their device). Built from the same data
// object as the Word and JSON files, so the three cannot disagree. Loaded on
// demand: the PDF libraries are only needed at download time.
//
// The built-in PDF fonts cover Western European text (umlauts, ß, dashes,
// quotation marks). Anything outside that range is replaced by "?" so the file
// never shows garbled characters.

const SCALE_LABEL = new Map(JUDGMENT_SCALE.map((s) => [s.value, s.label]))

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

const SUPPORTED = /[\u0009\u000a -~ -ÿ–—‘’‚“”„•…€]/

/** Keeps characters the built-in PDF font can draw; replaces the rest. */
export function pdfSafe(text: string): string {
  return Array.from(text ?? '')
    .map((ch) => (SUPPORTED.test(ch) ? ch : ch === '→' ? '->' : ch === '≤' ? '<=' : ch === '≥' ? '>=' : '?'))
    .join('')
}

export async function buildHandInPdf(h: HandIn): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  // The library ships as a default export; some bundlers wrap it one level deeper.
  const mod = (await import('jspdf-autotable')) as any
  const autoTable: (doc: unknown, options: Record<string, unknown>) => void =
    typeof mod.default === 'function' ? mod.default : mod.default?.default ?? mod.autoTable

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const textWidth = pageWidth - margin * 2
  let y = margin

  const ensure = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }
  const lines = (text: string, size: number, bold = false, italic = false) => {
    doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : italic ? 'italic' : 'normal')
    doc.setFontSize(size)
    return doc.splitTextToSize(pdfSafe(text), textWidth) as string[]
  }
  const para = (text: string, opts: { size?: number; bold?: boolean; italic?: boolean; after?: number } = {}) => {
    const size = opts.size ?? 10
    const lh = size * 0.42
    for (const line of lines(text, size, opts.bold, opts.italic)) {
      ensure(lh)
      doc.text(line, margin, y + lh * 0.8)
      y += lh
    }
    y += opts.after ?? 2
  }
  let n = 0
  const sec = (title: string) => {
    ensure(14)
    y += 4
    para(`${++n}. ${title}`, { size: 13, bold: true, after: 2 })
  }
  const empty = () => para('Noch nichts eingetragen.', { italic: true })
  const rating = (v: number | null) => (v == null ? '-' : `${v} (${SCALE_LABEL.get(v) ?? ''})`)
  const table = (head: string[], body: string[][], widths?: number[]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [head.map(pdfSafe)],
      body: body.map((r) => r.map((c) => pdfSafe(c ?? ''))),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [60, 90, 70], textColor: 255, fontSize: 7 },
      columnStyles: widths
        ? Object.fromEntries(widths.map((w, i) => [i, { cellWidth: (textWidth * w) / 100 }]))
        : undefined,
    })
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4
  }

  para('Ergebnis zu Aufgabe 1: Basiskonzepte', { size: 18, bold: true, after: 4 })
  if (h.tool.sandbox) para('SANDBOX-DATEI: erzeugt von einer synthetischen Testperson, keine Arbeit von Studierenden.', { bold: true })
  para(`${h.task.course}`)
  para(`Name: ${h.participant_name}`)
  const grp = groupNumberLine(h.groups)
  para(`${grp.label}: ${grp.value}`)
  para(`Erstellt am ${formatDate(h.exported_at)}`)

  if (h.topic.favorite_themes.length || h.topic.own_topic || h.topic.reasoning) {
    sec('Thema')
    if (h.topic.favorite_themes.length) para(`Lieblingsthemen der Biologie: ${h.topic.favorite_themes.join(', ')}`)
    if (h.topic.own_topic) para(`Eigenes Thema: ${h.topic.own_topic}`)
    if (h.topic.reasoning) para(`Begründung: ${h.topic.reasoning}`)
  }

  if (h.grade_bands.bands.length) {
    sec('Klassenstufen')
    para(`Bearbeitete Klassenstufen: ${h.grade_bands.bands.join(', ')}`)
    if (h.grade_bands.note) para(h.grade_bands.note)
  }

  sec('Gemerkte Lernziele im Thüringer Lehrplan')
  if (h.starred_lernziele.length) {
    table(
      ['Kl.', 'Thema', 'Lernziel'],
      h.starred_lernziele.map((l) => [l.grade_band ?? '', [l.thema, l.unterthema].filter(Boolean).join(' / '), l.title]),
      [8, 32, 60]
    )
  } else empty()

  sec('Beurteilung der vorgeschlagenen Basiskonzept-Verknüpfungen')
  para('Skala: 1 = trifft nicht zu, 2 = trifft eher nicht zu, 3 = trifft eher zu, 4 = trifft voll zu.', { italic: true })
  if (h.link_judgments.length) {
    table(
      ['Lernziel', 'Basiskonzept', 'Vorschlag 0-3', 'Korrektheit', 'Eigenes Fachwissen', 'Relevanzstufe', 'Didaktische Relevanz', 'Anmerkung'],
      h.link_judgments.map((j) => [
        j.lernziel_title,
        j.basiskonzept,
        j.curriculum_relevance == null ? '-' : String(j.curriculum_relevance),
        rating(j.ratings.correctness),
        rating(j.ratings.own_knowledge),
        rating(j.ratings.relevance_level),
        rating(j.ratings.didactic_relevance),
        j.note,
      ]),
      [17, 11, 10, 12, 12, 13, 12, 13]
    )
  } else empty()

  if (h.link_proposals.length) {
    sec('Ergänzte Verknüpfungen')
    table(
      ['Lernziel', 'Basiskonzept', 'Begründung'],
      h.link_proposals.map((l) => [l.lernziel_title ?? '', l.basiskonzept, l.description]),
      [30, 20, 50]
    )
  }

  if (h.topic_basiskonzepte.length) {
    sec('Basiskonzepte zum Thema')
    for (const b of h.topic_basiskonzepte) {
      para(b.basiskonzept, { bold: true, after: 1 })
      para(b.concrete_link || '(keine Beschreibung)')
    }
  }

  if (h.cross_cutting.length) {
    sec('Querschnittsaufgaben und überfachliche Kompetenzen')
    for (const c of h.cross_cutting) para(`${c.theme}${c.note ? `: ${c.note}` : ''}`)
  }

  sec('Reflexion')
  const written = h.reflections.filter((r) => r.text)
  if (written.length) {
    for (const r of written) {
      para(r.prompt, { bold: true, after: 1 })
      para(r.text)
    }
  } else empty()

  y += 4
  para('Diese Datei enthält deinen Namen und deine Arbeit, aber keine E-Mail-Adresse.', { size: 8, italic: true })

  doc.setProperties({ title: 'Ergebnis zu Aufgabe 1: Basiskonzepte', creator: 'EvoMentor (OpenLPM)' })
  return doc.output('blob')
}
