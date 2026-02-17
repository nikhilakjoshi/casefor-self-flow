import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const email = process.argv.filter((a) => a !== "--").at(2);
if (!email) {
  console.error("Usage: pnpm db:cleanup -- <email>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const count = await prisma.case.count({ where: { userId: user.id } });
  console.log(`Found ${count} cases for ${email}`);
  if (count === 0) return;

  const result = await prisma.case.deleteMany({ where: { userId: user.id } });
  console.log(`Deleted ${result.count} cases (all related records cascaded)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
