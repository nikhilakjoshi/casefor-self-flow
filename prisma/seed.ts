import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { agentPromptSeeds } from './agent-prompt-seeds'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. Upsert EB-1A ApplicationType
  const eb1a = await prisma.applicationType.upsert({
    where: { code: 'EB1A' },
    update: { name: 'EB-1A Extraordinary Ability' },
    create: {
      code: 'EB1A',
      name: 'EB-1A Extraordinary Ability',
      defaultThreshold: 3,
      active: true,
    },
  })
  console.log(`Upserted ApplicationType: ${eb1a.code} (${eb1a.id})`)

  // 2. Upsert 10 CriteriaMapping rows matching lib/eb1a-criteria.ts
  const criteria = [
    { criterionKey: 'awards', name: 'Awards', description: 'Documentation of receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.', displayOrder: 0 },
    { criterionKey: 'membership', name: 'Membership', description: 'Documentation of membership in associations in the field which require outstanding achievements of their members, as judged by recognized national or international experts.', displayOrder: 1 },
    { criterionKey: 'published_material', name: 'Published Material', description: 'Published material about the person in professional or major trade publications or other major media, relating to their work in the field.', displayOrder: 2 },
    { criterionKey: 'judging', name: 'Judging', description: 'Evidence of participation, either individually or on a panel, as a judge of the work of others in the same or an allied field.', displayOrder: 3 },
    { criterionKey: 'original_contributions', name: 'Original Contributions', description: 'Evidence of original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.', displayOrder: 4 },
    { criterionKey: 'scholarly_articles', name: 'Scholarly Articles', description: 'Evidence of authorship of scholarly articles in the field, in professional or major trade publications or other major media.', displayOrder: 5 },
    { criterionKey: 'exhibitions', name: 'Artistic Exhibitions', description: 'Evidence of display of the person\'s work in the field at artistic exhibitions or showcases.', displayOrder: 6 },
    { criterionKey: 'leading_role', name: 'Leading/Critical Role', description: 'Evidence of performing in a leading or critical role for organizations or establishments that have a distinguished reputation.', displayOrder: 7 },
    { criterionKey: 'high_salary', name: 'High Salary', description: 'Evidence of commanding a high salary or other significantly high remuneration for services, in relation to others in the field.', displayOrder: 8 },
    { criterionKey: 'commercial_success', name: 'Commercial Success', description: 'Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.', displayOrder: 9 },
  ]

  for (const c of criteria) {
    await prisma.criteriaMapping.upsert({
      where: {
        applicationTypeId_criterionKey: {
          applicationTypeId: eb1a.id,
          criterionKey: c.criterionKey,
        },
      },
      update: { name: c.name, description: c.description, displayOrder: c.displayOrder },
      create: {
        applicationTypeId: eb1a.id,
        criterionKey: c.criterionKey,
        name: c.name,
        description: c.description,
        displayOrder: c.displayOrder,
        active: true,
      },
    })
  }
  console.log(`Upserted ${criteria.length} CriteriaMapping rows`)

  // 3. Upsert 4 Templates (systemInstruction = drafting guidelines, variations = actual template body)
  const templates = [
    {
      name: 'Recommendation Letter',
      type: 'RECOMMENDATION_LETTER' as const,
      systemInstruction: 'Draft a recommendation letter for an EB-1A petition. The letter should be from a qualified expert in the field who can attest to the applicant\'s extraordinary ability. Include specific examples of achievements, contributions, and impact in the field.',
      defaultVariationContent: 'Write a formal recommendation letter. Open with the recommender\'s credentials and relationship to the applicant. Provide 2-3 specific examples of the applicant\'s extraordinary contributions. Close with a strong endorsement of their EB-1A eligibility.',
    },
    {
      name: 'Personal Statement',
      type: 'PERSONAL_STATEMENT' as const,
      systemInstruction: 'Draft a personal statement for an EB-1A petition. The statement should describe the applicant\'s career trajectory, key achievements, and how they demonstrate extraordinary ability in their field. Focus on concrete evidence that maps to USCIS criteria.',
      defaultVariationContent: 'Write a compelling first-person narrative. Begin with early career motivation, progress through key milestones, highlight specific achievements that meet EB-1A criteria, and conclude with future plans and continued impact in the field.',
    },
    {
      name: 'Petition Letter',
      type: 'PETITION' as const,
      systemInstruction: 'Draft a petition letter (cover letter) for an EB-1A application. The letter should summarize the applicant\'s qualifications, identify which criteria are met, and present a compelling legal argument for extraordinary ability classification.',
      defaultVariationContent: 'Write a formal legal petition letter addressed to USCIS. Introduce the applicant, state the classification sought, enumerate each qualifying criterion with supporting evidence, and conclude with a request for approval.',
    },
    {
      name: 'USCIS Form Instructions',
      type: 'USCIS_FORM' as const,
      systemInstruction: 'Provide guidance for completing USCIS Form I-140 (Immigrant Petition for Alien Workers) for an EB-1A extraordinary ability classification. Include instructions for each relevant section and common pitfalls to avoid.',
      defaultVariationContent: 'Provide section-by-section guidance for Form I-140. Cover beneficiary information, classification requested, and supporting documentation requirements. Note common mistakes and best practices for each field.',
    },
  ]

  for (const t of templates) {
    const templateId = `${eb1a.id}-${t.type}`
    await prisma.template.upsert({
      where: { id: templateId },
      update: { name: t.name, systemInstruction: t.systemInstruction },
      create: {
        id: templateId,
        applicationTypeId: eb1a.id,
        name: t.name,
        type: t.type,
        systemInstruction: t.systemInstruction,
        version: 1,
        active: true,
      },
    })

    // Upsert default variation
    const defaultVarId = `${templateId}-default`
    await prisma.templateVariation.upsert({
      where: { id: defaultVarId },
      update: { content: t.defaultVariationContent, label: 'Default' },
      create: {
        id: defaultVarId,
        templateId,
        label: 'Default',
        content: t.defaultVariationContent,
        matchField: '',
        matchValue: '',
        isDefault: true,
        active: true,
      },
    })
  }
  console.log(`Upserted ${templates.length} Template rows with default variations`)

  // 4. Backfill existing cases with applicationTypeId
  const updated = await prisma.case.updateMany({
    where: { applicationTypeId: null },
    data: { applicationTypeId: eb1a.id },
  })
  console.log(`Backfilled ${updated.count} cases with applicationTypeId`)

  // 5. Upsert AgentPrompt records
  for (const seed of agentPromptSeeds) {
    await prisma.agentPrompt.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        variables: seed.variables,
        provider: seed.provider,
        modelName: seed.modelName,
        content: seed.content,
        defaultContent: seed.content,
        category: seed.category,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        content: seed.content,
        defaultContent: seed.content,
        variables: seed.variables,
        provider: seed.provider,
        modelName: seed.modelName,
      },
    })
  }
  console.log(`Upserted ${agentPromptSeeds.length} AgentPrompt rows`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
