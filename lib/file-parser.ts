import mammoth from 'mammoth'

export type SupportedFileType = 'docx' | 'txt' | 'pdf'

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
    default:
      throw new FileParseError(`Unsupported file type: ${fileType}`)
  }
}
