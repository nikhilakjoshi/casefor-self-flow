import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLUG_GROUP_MAP: Record<string, string> = {
  "profile-extractor": "data-extraction",
  "recommender-extractor": "data-extraction",
  "survey-extractor": "data-extraction",
  "id-doc-extractor": "data-extraction",
  "drafting-agent": "document-generation",
  "evidence-agent": "document-generation",
  "evidence-doc-gen": "document-generation",
  "document-agent": "document-generation",
  "document-verifier": "document-generation",
  "document-classifier": "document-generation",
  "cover-letter-drafter": "category-drafters",
  "uscis-letter-drafter": "category-drafters",
  "resume-drafter": "category-drafters",
  "executive-resume-drafter": "category-drafters",
  "case-agent": "case-analysis",
  "strength-evaluator": "case-analysis",
  "gap-analysis": "case-analysis",
  "case-strategy": "case-analysis",
  "case-consolidation": "case-analysis",
  "denial-probability": "case-analysis",
};

function deriveGroup(slug: string): string {
  if (SLUG_GROUP_MAP[slug]) return SLUG_GROUP_MAP[slug];
  if (slug.startsWith("ax-c")) return "criterion-analysis";
  if (slug.startsWith("ev-c")) return "evidence-verification";
  return "uncategorized";
}

async function main() {
  const prompts = await prisma.agentPrompt.findMany();
  console.log(`Found ${prompts.length} prompts`);

  for (const p of prompts) {
    const group = deriveGroup(p.slug);

    // Update usageGroup
    if (p.usageGroup !== group) {
      await prisma.agentPrompt.update({
        where: { id: p.id },
        data: { usageGroup: group },
      });
      console.log(`  ${p.slug} -> ${group}`);
    }

    // Create v1 if no versions exist
    const count = await prisma.agentPromptVersion.count({
      where: { promptId: p.id },
    });
    if (count === 0) {
      await prisma.agentPromptVersion.create({
        data: {
          promptId: p.id,
          version: 1,
          content: p.content,
          provider: p.provider,
          modelName: p.modelName,
          temperature: p.temperature,
          maxTokens: p.maxTokens,
        },
      });
      console.log(`  ${p.slug} -> created v1`);
    }
  }

  console.log("Done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
