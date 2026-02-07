import mammoth from 'mammoth'

export type SupportedFileType = 'docx' | 'txt' | 'pdf' | 'md' | 'csv' | 'xlsx' | 'xls'

export class FileParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileParseError'
  }
}

function getFileType(fileName: string): SupportedFileType | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'docx') return 'docx'
  if (ext === 'txt') return 'txt'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'md' || ext === 'markdown') return 'md'
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  return null
}

export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    const text = result.value.trim()

    if (!text) {
      throw new FileParseError('DOCX file appears to be empty')
    }

    if (text.length < 100) {
      throw new FileParseError('DOCX content too short - file may be corrupted or nearly empty')
    }

    return text
  } catch (error) {
    if (error instanceof FileParseError) throw error
    throw new FileParseError(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseTxt(buffer: ArrayBuffer): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8')
    const text = decoder.decode(buffer).trim()

    if (!text) {
      throw new FileParseError('TXT file appears to be empty')
    }

    if (text.length < 100) {
      throw new FileParseError('TXT content too short - file may be corrupted or nearly empty')
    }

    return text
  } catch (error) {
    if (error instanceof FileParseError) throw error
    throw new FileParseError(`Failed to parse TXT: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseMarkdown(buffer: ArrayBuffer): Promise<string> {
  try {
    const text = new TextDecoder('utf-8').decode(buffer).trim()

    if (!text) {
      throw new FileParseError('Markdown file appears to be empty')
    }

    if (text.length < 100) {
      throw new FileParseError('Markdown content too short - file may be corrupted or nearly empty')
    }

    return text
  } catch (error) {
    if (error instanceof FileParseError) throw error
    throw new FileParseError(`Failed to parse Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseCsv(buffer: ArrayBuffer): Promise<string> {
  try {
    const text = new TextDecoder('utf-8').decode(buffer).trim()

    if (!text) {
      throw new FileParseError('CSV file appears to be empty')
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    if (lines.length === 0) {
      throw new FileParseError('CSV file has no data rows')
    }

    // Parse CSV rows (handle basic comma separation)
    const rows = lines.map(line => {
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
    })

    // Build markdown table
    const header = rows[0]
    const separator = header.map(() => '---')
    const dataRows = rows.slice(1)

    let markdown = '| ' + header.join(' | ') + ' |\n'
    markdown += '| ' + separator.join(' | ') + ' |\n'
    for (const row of dataRows) {
      // Pad row to match header length
      while (row.length < header.length) row.push('')
      markdown += '| ' + row.join(' | ') + ' |\n'
    }

    return markdown.trim()
  } catch (error) {
    if (error instanceof FileParseError) throw error
    throw new FileParseError(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseExcel(buffer: ArrayBuffer): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'array' })

    if (workbook.SheetNames.length === 0) {
      throw new FileParseError('Excel file has no sheets')
    }

    const markdownSections: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

      if (data.length === 0) continue

      // Filter out empty rows
      const rows = data.filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))

      if (rows.length === 0) continue

      let markdown = `## ${sheetName}\n\n`

      // Build markdown table
      const header = rows[0].map(cell => String(cell ?? ''))
      const separator = header.map(() => '---')
      const dataRows = rows.slice(1)

      markdown += '| ' + header.join(' | ') + ' |\n'
      markdown += '| ' + separator.join(' | ') + ' |\n'
      for (const row of dataRows) {
        const cells = row.map(cell => String(cell ?? ''))
        // Pad row to match header length
        while (cells.length < header.length) cells.push('')
        markdown += '| ' + cells.join(' | ') + ' |\n'
      }

      markdownSections.push(markdown.trim())
    }

    if (markdownSections.length === 0) {
      throw new FileParseError('Excel file has no data')
    }

    return markdownSections.join('\n\n')
  } catch (error) {
    if (error instanceof FileParseError) throw error
    throw new FileParseError(`Failed to parse Excel: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function parseFile(file: File): Promise<string> {
  const fileType = getFileType(file.name)

  if (!fileType) {
    throw new FileParseError(`Unsupported file type: ${file.name}`)
  }

  const buffer = await file.arrayBuffer()

  switch (fileType) {
    case 'docx':
      return parseDocx(buffer)
    case 'txt':
      return parseTxt(buffer)
    case 'pdf':
      // PDF will be passed to LLM for extraction per PRD
      throw new FileParseError('PDF parsing not implemented - use LLM extraction')
    case 'md':
      return parseMarkdown(buffer)
    case 'csv':
      return parseCsv(buffer)
    case 'xlsx':
    case 'xls':
      return parseExcel(buffer)
    default:
      throw new FileParseError(`Unsupported file type: ${fileType}`)
  }
}
