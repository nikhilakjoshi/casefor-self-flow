/**
 * Standalone seed: inserts ONLY the executive-resume-drafter AgentPrompt.
 * Safe to run repeatedly -- uses upsert on slug, won't touch other records.
 *
 * Usage:  npx tsx prisma/seed-executive-resume-drafter.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { agentPromptSeeds } from "./agent-prompt-seeds";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_SLUG = "executive-resume-drafter";

async function main() {
  const seed = agentPromptSeeds.find((s) => s.slug === TARGET_SLUG);
  if (!seed) {
    console.error(`Seed with slug "${TARGET_SLUG}" not found in agent-prompt-seeds.ts`);
    process.exit(1);
  }

  const prompt = await prisma.agentPrompt.upsert({
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
      usageGroup: "category-drafters",
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
      usageGroup: "category-drafters",
    },
  });

  // Create v1 version if none exists
  const versionCount = await prisma.agentPromptVersion.count({
    where: { promptId: prompt.id },
  });
  if (versionCount === 0) {
    await prisma.agentPromptVersion.create({
      data: {
        promptId: prompt.id,
        version: 1,
        content: seed.content,
        provider: seed.provider,
        modelName: seed.modelName,
      },
    });
    console.log(`  created v1 for ${seed.slug}`);
  }

  console.log(`Upserted AgentPrompt: ${seed.slug} (${prompt.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
