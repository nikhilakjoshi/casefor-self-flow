# Assumptions

- Prisma 7 uses `prisma.config.ts` for datasource URL config (not `url` in schema.prisma datasource block)
- Removed `earlyAccess` flag from prisma.config.ts - not a valid config property in current Prisma 7 types
- dotenv/config imported in prisma.config.ts to load DATABASE_URL from .env
- Fixed shadcn sidebar Math.random lint error by using fixed 70% width for skeleton
- Added npm scripts: typecheck (tsc --noEmit), test (placeholder), db:generate, db:push
