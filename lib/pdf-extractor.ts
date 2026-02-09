import { generateText, Output } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"

const MODEL = "gemini-2.5-flash"

export const PdfTextSchema = z.object({
  extractedText: z.string().describe("Full text extracted from the PDF"),
})

export async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { output } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: PdfTextSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all text from this PDF document." },
          {
            type: "file",
            data: Buffer.from(pdfBuffer),
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  })
  return output?.extractedText ?? ""
}
