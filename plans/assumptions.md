# Assumptions

- Prisma 7 uses `prisma.config.ts` for datasource URL config (not `url` in schema.prisma datasource block)
- Removed `earlyAccess` flag from prisma.config.ts - not a valid config property in current Prisma 7 types
- dotenv/config imported in prisma.config.ts to load DATABASE_URL from .env
- Fixed shadcn sidebar Math.random lint error by using fixed 70% width for skeleton
- Added npm scripts: typecheck (tsc --noEmit), test (placeholder), db:generate, db:push
- CriteriaMapping.description is non-optional String (PRD didn't specify nullability; all EB-1A criteria have descriptions)
- Document.content is optional String (allows inline storage for markdown when S3 not configured, per PRD task 13 note)
- All new fields on existing models use defaults to avoid breaking existing rows (criteriaThreshold=3, phase=ANALYSIS, applicationTypeId=null)
- Template IDs use deterministic `{applicationTypeId}-{type}` format so upserts are idempotent across re-runs
- Seed uses Node 24 `--env-file=.env` instead of dotenv (not a project dependency)
- Template content is placeholder instruction text; will be refined when evidence agent (task 11) is implemented
- Backfill sets all existing null-applicationTypeId cases to EB-1A (only app type currently supported)
- `Criterion` type uses `key` (= criterionKey) for criterion identification in prompts/analysis, `id` for DB relations
- eb1a-agent streaming functions changed from sync to async (callers must await) to support dynamic criteria loading
- analysis API now returns `criteriaNames` map so client components don't need static criteria imports
- `results-modal.tsx` criteriaNames prop is optional; falls back to raw criterionId as display name if not provided
- `lib/eb1a-criteria.ts` retained as deprecated reference file; no consumers import it
