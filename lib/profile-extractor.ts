import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const MODEL = "gemini-2.5-flash";

export const ProfileSchema = z.object({
  name: z.string().nullable(),
  currentRole: z.string().nullable(),
  institution: z.string().nullable(),
  field: z.string().nullable(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedIn: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  education: z
    .array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        year: z.number().nullable().optional(),
        field: z.string().nullable().optional(),
      })
    )
    .optional(),
  publications: z
    .array(
      z.object({
        title: z.string(),
        venue: z.string().nullable().optional(),
        year: z.number().nullable().optional(),
        citations: z.number().nullable().optional(),
      })
    )
    .optional(),
  awards: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string().nullable().optional(),
        year: z.number().nullable().optional(),
      })
    )
    .optional(),
  expertise: z.array(z.string()).optional(),
  experience: z
    .array(
      z.object({
        role: z.string(),
        organization: z.string(),
        startYear: z.number().nullable().optional(),
        endYear: z.number().nullable().optional(),
        current: z.boolean().optional(),
      })
    )
    .optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

const SYSTEM_PROMPT = `You are an expert at extracting structured profile information from resumes and CVs.

Extract the following information if present:
- name: Full name
- currentRole: Current job title/position
- institution: Current employer/organization
- field: Primary professional field (e.g., "Machine Learning", "Biomedical Research")
- email: Contact email
- phone: Phone number
- linkedIn: LinkedIn profile URL
- location: City/Country
- education: Array of degrees with institution, year, field
- publications: Array of publications with title, venue, year, citations
- awards: Array of awards/honors with name, issuer, year
- expertise: Array of key skills/expertise areas
- experience: Array of work experiences with role, organization, years

Return null for fields with no data. Be precise and extract only what's explicitly stated.`;

export async function extractProfile(resumeText: string): Promise<Profile> {
  const { output } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: ProfileSchema }),
    system: SYSTEM_PROMPT,
    prompt: `Extract profile information from this resume:\n\n${resumeText}`,
  });

  return output!;
}

export async function extractProfileFromPdf(
  pdfBuffer: ArrayBuffer
): Promise<Profile> {
  const { output } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: ProfileSchema }),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract profile information from this PDF resume.",
          },
          {
            type: "file",
            data: Buffer.from(pdfBuffer),
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  return output!;
}
