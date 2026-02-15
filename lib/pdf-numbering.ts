import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function addPageNumbers(
  pdfBytes: Uint8Array
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const totalPages = pages.length;
  const fontSize = 10;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const text = `Page ${i + 1} of ${totalPages}`;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: 24,
      size: fontSize,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return doc.save();
}
