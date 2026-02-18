import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "./db";
import { getPrompt, substituteVars, resolveModel } from "./agent-prompt";

const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

const ClassificationSchema = z.object({
  category: z.enum([
    "RESUME_CV",
    "EXECUTIVE_RESUME",
    "AWARD_CERTIFICATE",
    "PUBLICATION",
    "MEDIA_COVERAGE",
    "PATENT",
    "RECOMMENDATION_LETTER",
    "MEMBERSHIP_CERTIFICATE",
    "EMPLOYMENT_VERIFICATION",
    "SALARY_DOCUMENTATION",
    "CITATION_REPORT",
    "JUDGING_EVIDENCE",
    "PERSONAL_STATEMENT",
    "PETITION_LETTER",
    "PASSPORT_ID",
    "DEGREE_CERTIFICATE",
    "COVER_LETTER",
    "USCIS_ADVISORY_LETTER",
    "G1450PPU",
    "G1450300",
    "G1450I40",
    "G28",
    "I140",
    "I907",
    "I20",
    "VISA_STAMP",
    "I797_APPROVAL",
    "I94",
    "DS2019",
    "EAD_CARD",
    "NATIONAL_ID",
    "G1145",
    "G1450",
    "I797C_RECEIPT",
    "I797E_RFE",
    "RFE_RESPONSE",
    "NOID",
    "TRANSFER_NOTICE",
    "INTERVIEW_NOTICE",
    "BIOMETRICS_NOTICE",
    "I485",
    "I485_SUPPLEMENT_J",
    "I765",
    "I131",
    "PASSPORT_PHOTOS",
    "BIRTH_CERTIFICATE",
    "MARRIAGE_CERTIFICATE",
    "DIVORCE_DECREE",
    "NAME_CHANGE_ORDER",
    "I693",
    "VACCINATION_RECORDS",
    "EMPLOYMENT_CONTRACT",
    "OFFER_LETTER",
    "TAX_RETURNS",
    "W2_FORMS",
    "PAY_STUBS",
    "CREDENTIAL_EVALUATION",
    "PROFESSIONAL_LICENSE",
    "OTHER",
  ]),
  confidence: z.number().describe("Confidence score between 0 and 1"),
});

export interface ClassificationResult {
  category: string
  confidence: number
}

export async function classifyDocument(
  documentId: string,
  fileName: string,
  content?: string | null
): Promise<ClassificationResult | null> {
  try {
    const FALLBACK_PROMPT = `Classify this immigration case document into one of the categories. Return the best-fit category and your confidence (0-1).

Categories:
- RESUME_CV: Resume or curriculum vitae
- EXECUTIVE_RESUME: Executive-format resume
- AWARD_CERTIFICATE: Award, prize, or honor certificate
- PUBLICATION: Published article, paper, or book
- MEDIA_COVERAGE: News article, press coverage, or media mention
- PATENT: Patent filing or grant
- RECOMMENDATION_LETTER: Letter of recommendation or support
- MEMBERSHIP_CERTIFICATE: Professional membership or association certificate
- EMPLOYMENT_VERIFICATION: Employment verification letter
- SALARY_DOCUMENTATION: Other salary or compensation evidence
- CITATION_REPORT: Citation metrics, Google Scholar report, or impact data
- JUDGING_EVIDENCE: Evidence of judging, reviewing, or evaluating others' work
- PERSONAL_STATEMENT: Personal statement or declaration
- PETITION_LETTER: Petition letter or legal brief
- PASSPORT_ID: Passport, ID, or identity document
- DEGREE_CERTIFICATE: Academic degree, diploma, or transcript
- COVER_LETTER: Cover letter for the petition package
- USCIS_ADVISORY_LETTER: USCIS advisory or expert opinion letter
- G1450PPU: USCIS Form G-1450 for Premium Processing Unit fee
- G1450300: USCIS Form G-1450 for $300 fee payment
- G1450I40: USCIS Form G-1450 for I-40 fee payment
- G28: USCIS Form G-28 Notice of Entry of Appearance as Attorney
- I140: USCIS Form I-140 Immigrant Petition for Alien Workers
- I907: USCIS Form I-907 Request for Premium Processing Service
- DS2019: DS-2019 Certificate of Eligibility for J-1 status
- EAD_CARD: Employment Authorization Document (EAD) card
- NATIONAL_ID: Government-issued national ID card
- G1145: Form G-1145 E-Notification of Application Acceptance
- G1450: Form G-1450 Authorization for Credit Card Payment (general)
- I797C_RECEIPT: I-797C USCIS receipt notice
- I797E_RFE: I-797E Request for Evidence notice
- RFE_RESPONSE: Response to a Request for Evidence
- NOID: Notice of Intent to Deny
- TRANSFER_NOTICE: USCIS case transfer notification
- INTERVIEW_NOTICE: USCIS interview scheduling notice
- BIOMETRICS_NOTICE: Biometrics appointment notice (ASC)
- I485: Form I-485 Application to Register Permanent Residence
- I485_SUPPLEMENT_J: I-485 Supplement J Confirmation of Bona Fide Job Offer
- I765: Form I-765 Application for Employment Authorization
- I131: Form I-131 Application for Travel Document
- PASSPORT_PHOTOS: USCIS-compliant passport-style photos
- BIRTH_CERTIFICATE: Certified birth certificate
- MARRIAGE_CERTIFICATE: Certified marriage certificate
- DIVORCE_DECREE: Final divorce decree
- NAME_CHANGE_ORDER: Court-ordered name change document
- I693: Form I-693 Report of Medical Examination
- VACCINATION_RECORDS: Immunization or vaccination history
- EMPLOYMENT_CONTRACT: Signed employment contract
- OFFER_LETTER: Job offer letter
- TAX_RETURNS: Federal or state tax returns
- W2_FORMS: W-2 wage and tax statements
- PAY_STUBS: Recent pay stubs
- CREDENTIAL_EVALUATION: Foreign credential evaluation report
- PROFESSIONAL_LICENSE: Professional license or certification
- OTHER: Does not fit any above category

Filename pattern hints: "g-28"/"g28" -> G28, "i-140"/"i140" -> I140, "i-907"/"i907" -> I907, "g-1450"/"g1450" -> G1450, "g-1145"/"g1145" -> G1145, "cover" -> COVER_LETTER, "advisory"/"expert opinion" -> USCIS_ADVISORY_LETTER, "ds-2019"/"ds2019" -> DS2019, "i-485"/"i485" -> I485, "supplement j"/"supp j" -> I485_SUPPLEMENT_J, "i-765"/"i765" -> I765, "i-131"/"i131" -> I131, "i-693"/"i693" -> I693, "i-797c"/"receipt notice" -> I797C_RECEIPT, "rfe"/"request for evidence" -> I797E_RFE, "noid"/"intent to deny" -> NOID, "birth cert" -> BIRTH_CERTIFICATE, "marriage cert" -> MARRIAGE_CERTIFICATE, "divorce" -> DIVORCE_DECREE, "w-2"/"w2" -> W2_FORMS, "pay stub" -> PAY_STUBS, "tax return" -> TAX_RETURNS, "offer letter" -> OFFER_LETTER, "credential eval" -> CREDENTIAL_EVALUATION, "vaccination"/"immunization" -> VACCINATION_RECORDS.

{{fileName}}
{{content}}`;

    const p = await getPrompt("document-classifier");
    const promptTemplate = p?.content ?? FALLBACK_PROMPT;
    const prompt = substituteVars(promptTemplate, {
      fileName: `Filename: ${fileName}`,
      content: content ? `Content (first 1500 chars):\n${content.slice(0, 1500)}` : "",
    });

    const { object } = await generateObject({
      model: p ? resolveModel(p.provider, p.modelName) : anthropic(FALLBACK_MODEL),
      schema: ClassificationSchema,
      prompt,
    });

    await db.document.update({
      where: { id: documentId },
      data: {
        category: object.category,
        classificationConfidence: object.confidence,
      },
    });

    return { category: object.category, confidence: object.confidence }
  } catch (err) {
    console.error(`[DocumentClassifier] Failed for ${documentId}:`, err);
    return null
  }
}
