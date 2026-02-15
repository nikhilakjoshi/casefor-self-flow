import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";

export async function generateSeparatorPage(
  label: string,
  options?: {
    fontSize?: number;
    pageSize?: [number, number];
  }
): Promise<Uint8Array> {
  const fontSize = options?.fontSize ?? 24;
  const [pageWidth, pageHeight] = options?.pageSize ?? PageSizes.Letter;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([pageWidth, pageHeight]);

  const textWidth = boldFont.widthOfTextAtSize(label, fontSize);
  const textHeight = boldFont.heightAtSize(fontSize);

  page.drawText(label, {
    x: (pageWidth - textWidth) / 2,
    y: (pageHeight + textHeight) / 2,
    size: fontSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // thin horizontal rule below the label
  const ruleY = (pageHeight - textHeight) / 2 - 10;
  const ruleMargin = pageWidth * 0.2;
  page.drawLine({
    start: { x: ruleMargin, y: ruleY },
    end: { x: pageWidth - ruleMargin, y: ruleY },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });

  // small "Separator Page" footer
  const footerText = "Separator Page";
  const footerSize = 8;
  const footerWidth = font.widthOfTextAtSize(footerText, footerSize);
  page.drawText(footerText, {
    x: (pageWidth - footerWidth) / 2,
    y: 36,
    size: footerSize,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return doc.save();
}
