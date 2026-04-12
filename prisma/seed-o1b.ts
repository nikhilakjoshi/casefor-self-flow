/**
 * Seed script for O-1B (Extraordinary Ability in Sciences, Education,
 * Business, or Athletics) application type.
 *
 * O-1B has 8 criteria (vs EB-1A's 10 — no Exhibitions, no Commercial Success).
 * Criteria are from 8 CFR 214.2(o)(3)(iii).
 *
 * Run: node --env-file=.env --import tsx prisma/seed-o1b.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const O1B_CODE = "O1B"
const O1B_NAME = "O-1B Extraordinary Ability (Sciences, Education, Business, Athletics)"

const O1B_CRITERIA = [
  {
    criterionKey: "awards",
    name: "Awards",
    description:
      "Documentation of the beneficiary's receipt of nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(A): Documentation of the alien's receipt of nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
    guidanceText:
      "Look for awards that demonstrate recognition at the national or international level. The award should be for excellence, not mere participation.",
    displayOrder: 0,
  },
  {
    criterionKey: "membership",
    name: "Membership in Associations",
    description:
      "Documentation of the beneficiary's membership in associations in the field for which classification is sought, which require outstanding achievements of their members, as judged by recognized national or international experts.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(B): Documentation of the alien's membership in associations in the field for which classification is sought, which require outstanding achievements of their members, as judged by recognized national or international experts in their disciplines or fields.",
    guidanceText:
      "Selective organizations requiring outstanding achievement. Must be judged by recognized experts, not just paying dues.",
    displayOrder: 1,
  },
  {
    criterionKey: "published_material",
    name: "Published Material",
    description:
      "Published material in professional or major trade publications or major media about the beneficiary, relating to the beneficiary's work in the field.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(C): Published material in professional or major trade publications or major media about the alien, relating to the alien's work in the field for which classification is sought.",
    guidanceText:
      "Material must be ABOUT the beneficiary's work, not just authored by them. Should be in professional/major publications.",
    displayOrder: 2,
  },
  {
    criterionKey: "judging",
    name: "Judging",
    description:
      "Evidence of the beneficiary's participation on a panel, or individually, as a judge of the work of others in the same or in an allied field.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(D): Evidence of the alien's participation on a panel, or individually, as a judge of the work of others in the same or in an allied field of specialization to that for which classification is sought.",
    guidanceText:
      "Peer review, editorial boards, grant panels, thesis committees, competition judging all qualify.",
    displayOrder: 3,
  },
  {
    criterionKey: "original_contributions",
    name: "Original Contributions",
    description:
      "Evidence of the beneficiary's original scientific, scholarly, or business-related contributions of major significance in the field.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(E): Evidence of the alien's original scientific, scholarly, or business-related contributions of major significance in the field.",
    guidanceText:
      "Contributions must be original AND of major significance. Look for evidence of adoption, citations, industry impact, patents.",
    displayOrder: 4,
  },
  {
    criterionKey: "scholarly_articles",
    name: "Scholarly Articles",
    description:
      "Evidence of the beneficiary's authorship of scholarly articles in the field, in professional journals, or other major media.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(F): Evidence of the alien's authorship of scholarly articles in the field, in professional journals, or other major media.",
    guidanceText:
      "Peer-reviewed publications in professional journals. Consider venue quality, citation count, h-index.",
    displayOrder: 5,
  },
  {
    criterionKey: "high_salary",
    name: "High Salary",
    description:
      "Evidence that the beneficiary has either commanded a high salary or will command a high salary or other remuneration for services, as evidenced by contracts or other reliable evidence.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(G): Evidence that the alien has either commanded a high salary or will command a high salary or other remuneration for services, as evidenced by contracts or other reliable evidence.",
    guidanceText:
      "Compare to field averages. Department of Labor wage data, BLS statistics, industry surveys establish benchmarks.",
    displayOrder: 6,
  },
  {
    criterionKey: "leading_role",
    name: "Leading or Critical Role",
    description:
      "Evidence that the beneficiary has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.",
    uscisText:
      "8 CFR 214.2(o)(3)(iii)(H): Evidence that the alien has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.",
    guidanceText:
      "Both the role (leading or critical) and the organization (distinguished reputation) must be established.",
    displayOrder: 7,
  },
]

// Evidence types that O-1B uses (subset of the hybrid registry)
const O1B_EVIDENCE_TYPES = [
  { schemaKey: "awards", name: "Awards & Prizes" },
  { schemaKey: "memberships", name: "Professional Memberships" },
  { schemaKey: "media_coverage", name: "Published Material / Media" },
  { schemaKey: "judging_activities", name: "Judging Activities" },
  { schemaKey: "original_contributions", name: "Original Contributions" },
  { schemaKey: "patents", name: "Patents" },
  { schemaKey: "grants", name: "Grants & Funding" },
  { schemaKey: "publications", name: "Scholarly Publications" },
  { schemaKey: "leadership_roles", name: "Leadership Roles" },
  { schemaKey: "compensation", name: "Salary & Compensation" },
]

const O1B_RUBRIC = `You are a Strength Evaluation Agent for O-1B (Extraordinary Ability in Sciences, Education, Business, or Athletics) visa petitions.

THE 8 O-1B CRITERIA (8 CFR 214.2(o)(3)(iii)):
1. Awards - nationally/internationally recognized prizes for excellence
2. Membership - associations requiring outstanding achievement, judged by national/international experts
3. Published material - about the beneficiary in professional/major publications
4. Judging - participation as judge of others' work
5. Original contributions - of major significance in the field
6. Scholarly articles - authorship in professional journals or major media
7. High salary - commanding high salary or remuneration
8. Leading/critical role - for organizations with distinguished reputation

EVALUATION FRAMEWORK:
For each criterion, assign a tier (1-5):
- Tier 1 (Exceptional): Evidence clearly exceeds USCIS standards
- Tier 2 (Strong): Solid evidence meeting USCIS standards
- Tier 3 (Moderate): Some evidence but needs strengthening
- Tier 4 (Weak): Minimal evidence, significant gaps
- Tier 5 (Insufficient): No meaningful evidence

The O-1B standard requires the beneficiary to demonstrate extraordinary ability by sustained national or international acclaim. The beneficiary must meet at least 3 of the 8 criteria.

Score each criterion 1.0-10.0 based on evidence quality and quantity.
Provide improvement notes for criteria below Tier 2.
Flag RFE risk for criteria with borderline evidence.`

const O1B_DENIAL_FRAMEWORK = `You are a Denial Probability Engine for O-1B (Extraordinary Ability) visa petitions.

LEGAL STANDARD:
O-1B nonimmigrant status is for individuals with extraordinary ability in the sciences, education, business, or athletics, demonstrated by sustained national or international acclaim. 8 CFR 214.2(o)(3)(iii) lists 8 evidentiary criteria.

KEY DIFFERENCES FROM EB-1A:
- O-1B is a nonimmigrant (temporary) visa; EB-1A is immigrant (permanent)
- O-1B requires a US employer/agent as petitioner
- O-1B requires an advisory opinion from a peer group or labor organization
- The evidentiary standard is similar but O-1B has 8 criteria (not 10)

ASSESSMENT APPROACH:
1. Evaluate each of the 8 criteria for evidence quality
2. Determine if at least 3 criteria are clearly satisfied
3. Assess sustained national/international acclaim
4. Identify red flags (gaps in evidence, inconsistencies, weak documentation)
5. Consider the specific field's standards and norms

Provide denial probability as a percentage (5-95%) with rationale.`

async function main() {
  console.log(`Seeding O-1B application type (${O1B_CODE})...`)

  // Check if already exists
  const existing = await prisma.applicationType.findUnique({
    where: { code: O1B_CODE },
  })
  if (existing) {
    console.log(`O-1B already exists (id: ${existing.id}). Skipping.`)
    return
  }

  // Create application type
  const o1b = await prisma.applicationType.create({
    data: {
      code: O1B_CODE,
      name: O1B_NAME,
      defaultThreshold: 3,
      active: true,
    },
  })
  console.log(`Created ApplicationType: ${o1b.id} (${o1b.code})`)

  // Create criteria
  await prisma.criteriaMapping.createMany({
    data: O1B_CRITERIA.map((c) => ({
      applicationTypeId: o1b.id,
      ...c,
    })),
  })
  console.log(`Created ${O1B_CRITERIA.length} CriteriaMapping rows`)

  // Create evidence type definitions
  await prisma.evidenceTypeDefinition.createMany({
    data: O1B_EVIDENCE_TYPES.map((e, i) => ({
      applicationTypeId: o1b.id,
      schemaKey: e.schemaKey,
      name: e.name,
      displayOrder: i,
      active: true,
    })),
  })
  console.log(`Created ${O1B_EVIDENCE_TYPES.length} EvidenceTypeDefinition rows`)

  // Create criterion prompt links — reuse EB-1A prompts where criteria overlap
  // O-1B criteria overlap heavily with EB-1A (awards=C1, membership=C2, etc.)
  const promptLinks = [
    { criterionKey: "awards", purpose: "extraction", promptSlug: "ax-c1-awards" },
    { criterionKey: "membership", purpose: "extraction", promptSlug: "ax-c2-memberships" },
    { criterionKey: "published_material", purpose: "extraction", promptSlug: "ax-c3-published-material" },
    { criterionKey: "judging", purpose: "extraction", promptSlug: "ax-c4-judging" },
    { criterionKey: "original_contributions", purpose: "extraction", promptSlug: "ax-c5-contributions" },
    { criterionKey: "scholarly_articles", purpose: "extraction", promptSlug: "ax-c6-scholarly-articles" },
    { criterionKey: "high_salary", purpose: "extraction", promptSlug: "ax-c9-high-salary" },
    { criterionKey: "leading_role", purpose: "extraction", promptSlug: "ax-c8-leading-role" },
  ]
  await prisma.criterionPromptLink.createMany({
    data: promptLinks.map((l) => ({
      applicationTypeId: o1b.id,
      ...l,
    })),
  })
  console.log(`Created ${promptLinks.length} CriterionPromptLink rows`)

  // Create strength rubric
  await prisma.strengthRubric.create({
    data: {
      applicationTypeId: o1b.id,
      content: O1B_RUBRIC,
    },
  })
  console.log("Created StrengthRubric")

  // Create denial framework
  await prisma.denialFramework.create({
    data: {
      applicationTypeId: o1b.id,
      frameworkName: "O-1B Evidentiary Standard",
      content: O1B_DENIAL_FRAMEWORK,
    },
  })
  console.log("Created DenialFramework")

  console.log("\nO-1B seed complete.")
  console.log(`  Application Type: ${o1b.id}`)
  console.log(`  Criteria: ${O1B_CRITERIA.length}`)
  console.log(`  Evidence Types: ${O1B_EVIDENCE_TYPES.length}`)
  console.log(`  Prompt Links: ${promptLinks.length}`)
}

main()
  .catch((e) => {
    console.error("O-1B seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
