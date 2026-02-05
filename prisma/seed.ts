import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

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

  // 3. Upsert 4 Templates
  const templates = [
    {
      name: 'Recommendation Letter',
      type: 'RECOMMENDATION_LETTER' as const,
      content: 'Draft a recommendation letter for an EB-1A petition. The letter should be from a qualified expert in the field who can attest to the applicant\'s extraordinary ability. Include specific examples of achievements, contributions, and impact in the field.',
    },
    {
      name: 'Personal Statement',
      type: 'PERSONAL_STATEMENT' as const,
      content: 'Draft a personal statement for an EB-1A petition. The statement should describe the applicant\'s career trajectory, key achievements, and how they demonstrate extraordinary ability in their field. Focus on concrete evidence that maps to USCIS criteria.',
    },
    {
      name: 'Petition Letter',
      type: 'PETITION' as const,
      content: 'Draft a petition letter (cover letter) for an EB-1A application. The letter should summarize the applicant\'s qualifications, identify which criteria are met, and present a compelling legal argument for extraordinary ability classification.',
    },
    {
      name: 'USCIS Form Instructions',
      type: 'USCIS_FORM' as const,
      content: 'Provide guidance for completing USCIS Form I-140 (Immigrant Petition for Alien Workers) for an EB-1A extraordinary ability classification. Include instructions for each relevant section and common pitfalls to avoid.',
    },
  ]

  for (const t of templates) {
    await prisma.template.upsert({
      where: {
        id: `${eb1a.id}-${t.type}`,
      },
      update: { name: t.name, content: t.content },
      create: {
        id: `${eb1a.id}-${t.type}`,
        applicationTypeId: eb1a.id,
        name: t.name,
        type: t.type,
        content: t.content,
        version: 1,
        active: true,
      },
    })
  }
  console.log(`Upserted ${templates.length} Template rows`)

  // 4. Backfill existing cases with applicationTypeId
  const updated = await prisma.case.updateMany({
    where: { applicationTypeId: null },
    data: { applicationTypeId: eb1a.id },
  })
  console.log(`Backfilled ${updated.count} cases with applicationTypeId`)
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
