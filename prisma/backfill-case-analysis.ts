/**
 * Backfill script for the multi-matter-type migration.
 * 1. Sets applicationTypeId on CaseAnalysis rows from their parent Case
 * 2. Backfills uscisText/guidanceText on EB-1A CriteriaMapping rows
 *    from the hardcoded CRITERIA_METADATA constant
 *
 * Run: node --env-file=.env --import tsx prisma/backfill-case-analysis.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { CRITERIA_METADATA } from "../lib/eb1a-extraction-schema"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Map from legacy criterion keys (DB) to C1-C10 (CRITERIA_METADATA keys)
const LEGACY_TO_C: Record<string, string> = {
  awards: "C1",
  membership: "C2",
  published_material: "C3",
  judging: "C4",
  original_contributions: "C5",
  scholarly_articles: "C6",
  exhibitions: "C7",
  leading_role: "C8",
  high_salary: "C9",
  commercial_success: "C10",
}

async function main() {
  // 1. Backfill CaseAnalysis.applicationTypeId from parent Case
  const analyses = await prisma.caseAnalysis.findMany({
    where: { applicationTypeId: null },
    select: { id: true, caseId: true },
  })
  console.log(`Found ${analyses.length} CaseAnalysis rows with null applicationTypeId`)

  let updated = 0
  for (const a of analyses) {
    const parentCase = await prisma.case.findUnique({
      where: { id: a.caseId },
      select: { applicationTypeId: true },
    })
    if (parentCase?.applicationTypeId) {
      await prisma.caseAnalysis.update({
        where: { id: a.id },
        data: { applicationTypeId: parentCase.applicationTypeId },
      })
      updated++
    }
  }
  console.log(`Backfilled applicationTypeId on ${updated} CaseAnalysis rows`)

  // 2. Backfill uscisText/guidanceText on EB-1A CriteriaMapping rows
  const eb1a = await prisma.applicationType.findUnique({ where: { code: "EB1A" } })
  if (!eb1a) {
    console.log("No EB1A ApplicationType found, skipping criteria backfill")
    return
  }

  const criteria = await prisma.criteriaMapping.findMany({
    where: { applicationTypeId: eb1a.id },
  })

  let criteriaUpdated = 0
  for (const c of criteria) {
    const canonicalId = LEGACY_TO_C[c.criterionKey] as keyof typeof CRITERIA_METADATA | undefined
    if (!canonicalId) continue
    const meta = CRITERIA_METADATA[canonicalId]
    if (!meta) continue

    // Only backfill if currently empty
    if (!c.uscisText && !c.guidanceText) {
      await prisma.criteriaMapping.update({
        where: { id: c.id },
        data: {
          uscisText: meta.uscis ?? "",
          guidanceText: meta.guidance ?? "",
        },
      })
      criteriaUpdated++
    }
  }
  console.log(`Backfilled uscisText/guidanceText on ${criteriaUpdated} CriteriaMapping rows`)
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
