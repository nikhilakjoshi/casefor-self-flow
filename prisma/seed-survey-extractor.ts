import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { agentPromptSeeds } from './agent-prompt-seeds'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const seed = agentPromptSeeds.find((s) => s.slug === 'survey-extractor')
  if (!seed) throw new Error('survey-extractor seed not found')

  await prisma.agentPrompt.upsert({
    where: { slug: seed.slug },
    update: {
      content: seed.content,
      defaultContent: seed.content,
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
  console.log('Upserted survey-extractor prompt')
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
