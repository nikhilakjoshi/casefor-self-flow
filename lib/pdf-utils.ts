import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function markdownToPdf(markdownContent: string, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 612 // Letter
  const pageHeight = 792
  const margin = 72 // 1 inch
  const lineHeight = 14
  const fontSize = 11
  const titleSize = 14
  const maxWidth = pageWidth - margin * 2

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Draw title
  const titleWidth = boldFont.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: Math.min((pageWidth - titleWidth) / 2, margin),
    y,
    size: titleSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  })
  y -= lineHeight * 2

  // Split content into lines, wrapping long lines
  const lines = markdownContent.split('\n')

  for (const line of lines) {
    // Skip markdown heading markers for cleaner PDF
    const cleanLine = line.replace(/^#{1,6}\s+/, '')
    const isHeading = line.match(/^#{1,6}\s+/)
    const currentFont = isHeading ? boldFont : font
    const currentSize = isHeading ? 12 : fontSize

    if (cleanLine.trim() === '') {
      y -= lineHeight
      if (y < margin) {
        page = doc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      continue
    }

    // Simple word wrapping
    const words = cleanLine.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = currentFont.widthOfTextAtSize(testLine, currentSize)

      if (testWidth > maxWidth && currentLine) {
        if (y < margin) {
          page = doc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(currentLine, {
          x: margin,
          y,
          size: currentSize,
          font: currentFont,
          color: rgb(0, 0, 0),
        })
        y -= lineHeight
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      if (y < margin) {
        page = doc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      page.drawText(currentLine, {
        x: margin,
        y,
        size: currentSize,
        font: currentFont,
        color: rgb(0, 0, 0),
      })
      y -= lineHeight
    }
  }

  return doc.save()
}
