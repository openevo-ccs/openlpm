import Papa from 'papaparse'
import ExcelJS from 'exceljs'

/**
 * Generic row <-> file conversion for the admin content editor's
 * export/import. JSON round-trips every field with full fidelity,
 * including nested objects like a learning-goal's `content`. CSV/XLSX are
 * flat, spreadsheet-native formats -- any object/array-valued column
 * (chiefly `content`) is written as a JSON string in a single cell so the
 * round trip stays lossless, even though editing that cell in a
 * spreadsheet means editing JSON text rather than a nested form. That's a
 * deliberate tradeoff: the flat columns (title,
 * description, status, ...) are what a CSV/XLSX bulk edit is actually
 * for; deep content edits belong in the card view.
 */

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Parses a flat cell back to a value: valid JSON (object/array/number/boolean) parses as such, everything else stays a string. Empty string becomes null. */
function parseCell(raw: string): unknown {
  if (raw === '' || raw === undefined || raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (/^[[{]/.test(trimmed) || /^-?\d+(\.\d+)?$/.test(trimmed) || trimmed === 'true' || trimmed === 'false') {
    try {
      return JSON.parse(trimmed)
    } catch {
      return raw
    }
  }
  return raw
}

export function rowsToJsonBlob(rows: Record<string, unknown>[]): Blob {
  return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
}

export function rowsToCsvBlob(rows: Record<string, unknown>[], columns: string[]): Blob {
  const flat = rows.map((row) => {
    const out: Record<string, string> = {}
    for (const col of columns) out[col] = stringifyCell(row[col])
    return out
  })
  const csv = Papa.unparse({ fields: columns, data: flat })
  return new Blob([csv], { type: 'text/csv' })
}

export async function rowsToXlsxBlob(rows: Record<string, unknown>[], columns: string[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Data')
  sheet.addRow(columns)
  for (const row of rows) sheet.addRow(columns.map((col) => stringifyCell(row[col])))
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function parseJsonFile(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text()
  const data = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of records.')
  return data
}

export async function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  if (result.errors.length > 0) throw new Error(result.errors[0].message)
  return result.data.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(row)) out[key] = parseCell(raw)
    return out
  })
}

export async function parseXlsxFile(file: File): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('No sheet found in that file.')
  const rows: Record<string, unknown>[] = []
  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '')
  })
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const out: Record<string, unknown> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber]
      if (header) out[header] = parseCell(cell.value == null ? '' : String(cell.value))
    })
    rows.push(out)
  })
  return rows
}
