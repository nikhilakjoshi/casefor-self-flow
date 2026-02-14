/**
 * Client-side CSV parser. Returns headers and row data as string arrays.
 */
export function parseCsvToRows(text: string): {
  headers: string[]
  rows: string[][]
} {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current.trim())
    return cells
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map(parseRow)

  if (headers.length === 0 || headers.every((h) => h === '')) {
    throw new Error('CSV has no valid headers')
  }

  return { headers, rows }
}
