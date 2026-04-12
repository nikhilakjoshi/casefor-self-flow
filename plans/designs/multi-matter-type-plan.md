# Plan: Multi-Matter-Type Configurable Pipeline

## Context

CaseFor AI's pipeline (extraction, analysis, drafting, strength evaluation, denial probability) is hardcoded to EB-1A's 10 criteria across ~32 files. A key stakeholder requires multi-matter-type support (O-1B, O-1A, EB-2 NIW, etc.) configurable by a lawyer through admin UI. The acceptance criterion is O-1B running end-to-end, all admin-configured. Design doc: `~/.gstack/projects/nikhilakjoshi-casefor-self-flow/nikhiljoshi-main-design-20260411-234612.md`.

**Key challenge:** Two parallel criterion-key systems exist — DB seeds use `awards`, `membership`, etc. as `criterionKey`, while the pipeline uses `C1`, `C2`, etc. The `LEGACY_TO_CANONICAL` map bridges them. This duality must be resolved during the refactor.

---

## Phase 1: Schema & Data Model (foundation — everything depends on this)

### 1.1 Extend `prisma/schema.prisma`

**Add to `AgentPrompt`:**
- `applicationTypeId String?` + relation to `ApplicationType`
- Change `slug @unique` to `@@unique([slug, applicationTypeId])` (allows same slug per type + one global)

**Add new models:**
- `EvidenceTypeDefinition` — `(applicationTypeId, schemaKey)` unique, `name`, `fieldsJson Json`, `displayOrder`, `active`
- `StrengthRubric` — `applicationTypeId @unique`, `content` (full rubric prompt text)
- `CriterionPromptLink` — `(applicationTypeId, criterionKey, purpose)` unique, `promptSlug`
- `DenialFramework` — `applicationTypeId @unique`, `content` (full framework prompt)

**Rename `EB1AAnalysis` → `CaseAnalysis`:**
- Add `@@map("EB1AAnalysis")` to avoid table drop/recreate
- Add nullable `applicationTypeId String?` FK
- Keep Prisma relation name as `eb1aAnalyses` for now (rename in Phase 8 to avoid touching 28 files early)

**Migrate `DocumentCategory`:**
- Change `category DocumentCategory?` to `category String?` on `Document` model
- Remove the `enum DocumentCategory` declaration
- May need manual SQL: `ALTER TABLE "Document" ALTER COLUMN "category" TYPE TEXT; DROP TYPE "DocumentCategory";`

**Add to `CriteriaMapping`:**
- `uscisText String? @default("")`
- `guidanceText String? @default("")`

**Add inverse relations on `ApplicationType`** for all new models.

**Run:** `pnpm db:push` (needs DIRECT_URL for Supabase)

### 1.2 Backfill existing data

Create `prisma/backfill-case-analysis.ts`:
- Set `applicationTypeId` on all existing `CaseAnalysis` rows from their parent `Case.applicationTypeId`
- Backfill `uscisText`/`guidanceText` on existing EB-1A `CriteriaMapping` rows from the hardcoded `CRITERIA_METADATA` constant

Run: `node --env-file=.env --import tsx prisma/backfill-case-analysis.ts`

**Files:** `prisma/schema.prisma`, `prisma/backfill-case-analysis.ts`
**Verify:** `pnpm db:generate` compiles. Existing seed script still runs.

---

## Phase 2: Dynamic Criteria Infrastructure

### 2.1 `lib/criteria.ts` — add `getCriteriaMetadata()`

```ts
export interface CriterionMetadata {
  key: string; name: string; description: string;
  uscis: string; guidance: string; displayOrder: number;
}
export async function getCriteriaMetadata(
  applicationTypeId: string | null
): Promise<Record<string, CriterionMetadata>>
```

Query `CriteriaMapping` for the type. For EB-1A, populate `uscis`/`guidance` from the new DB columns (backfilled in 1.2). Returns empty `{}` if type not found.

### 2.2 `lib/eb1a-extraction-schema.ts` — widen types

- Change `CriterionIdSchema` from `z.enum(["C1"..."C10"])` to keep as `EB1ACriterionIdSchema` (renamed), add `export type CriterionKey = string`
- Change `mapped_criteria` in all evidence schemas from `z.array(CriterionIdSchema)` to `z.array(z.string())`
- Change `CriteriaSummaryItemSchema.criterion_id` from `CriterionIdSchema` to `z.string()`
- Add deprecation comments on `CRITERIA_METADATA`, keep it for fallback
- `resolveCanonicalId()` → works on any string, falls back to `LEGACY_TO_CANONICAL`

### 2.3 `lib/agent-prompt.ts` — add `getPromptForType()`

```ts
export async function getPromptForType(
  slug: string, applicationTypeId: string | null
): Promise<PromptData | null>
```

Lookup: `(slug, applicationTypeId)` → `(slug, null)` → `null`. Cache key: `${slug}:${appTypeId ?? 'global'}`.

**Files:** `lib/criteria.ts`, `lib/eb1a-extraction-schema.ts`, `lib/agent-prompt.ts`
**Verify:** All existing imports compile. `getCriteriaMetadata(null)` returns EB-1A data.

---

## Phase 3: Pipeline Refactoring

Each file retains hardcoded EB-1A fallback. Every function that takes `caseId` can resolve `applicationTypeId` internally via the case record.

### 3.1 `lib/multipass-extraction.ts`

- Add `applicationTypeId` param to `multipassExtract()` and `extractCriterion()`
- Replace `ANALYSIS_SLUGS` with `CriterionPromptLink` query (purpose='extraction')
- Replace `ALL_CRITERIA` with criteria list from `getCriteriaForType()`
- Replace `CRITERION_ARRAY_KEYS` with `EvidenceTypeDefinition` lookup
- EB-1A fallback: if no DB config, use existing constants

### 3.2 `lib/criterion-extraction-schemas.ts`

- Rename `CRITERION_SCHEMAS` to `EB1A_CRITERION_SCHEMAS` (preserve for fallback)
- Add `EVIDENCE_TYPE_SCHEMAS` registry keyed by evidence type (`publications`, `awards`, etc.)
- Add `buildCriterionSchema(criterionKey, evidenceTypeKeys)` that composes a Zod schema from the registry
- For EB-1A: if no `EvidenceTypeDefinition` rows, use `EB1A_CRITERION_SCHEMAS`

### 3.3 `lib/eb1a-agent.ts`

- Add `applicationTypeId` to `extractAndEvaluate()` signature (optional, defaults to null)
- Build `EXTRACTION_SYSTEM_PROMPT` dynamically from `getCriteriaMetadata(appTypeId)`
- Thread `applicationTypeId` to `multipassExtract()`
- `countExtractionStrengths()`: accept criteria list param, default to 10
- `extractionToLegacyFormat()`: accept criteria list

### 3.4 `lib/merge-extraction.ts`

- Add `criteriaMetadata` param to `recalculateCriteriaSummary()`
- Initialize `criteriaMap` from passed metadata keys instead of hardcoded C1-C10
- Fallback: if no metadata, use `CRITERIA_METADATA`

### 3.5 `lib/strength-evaluation.ts`

- In `streamStrengthEvaluation(caseId)`: resolve case's `applicationTypeId`
- Query `StrengthRubric` for rubric content; fallback to `FALLBACK_PROMPT`
- Use `getPromptForType("strength-evaluator", appTypeId)` for model config

### 3.6 `lib/evidence-verification.ts`

- Replace `CRITERION_SLUGS` with `CriterionPromptLink` query (purpose='verification')
- Replace hardcoded criteria array with `getCriteriaForCase(caseId)`
- Use `getPromptForType(slug, appTypeId)` for prompts
- EB-1A fallback: if no links, use existing `CRITERION_SLUGS` + `SYSTEM_PROMPTS`

### 3.7 Supporting pipeline files

| File | Change |
|---|---|
| `lib/tier-evidence-guide.ts` | Add `getTierGuide(appTypeId)` async fn; falls back to static `TIER_EVIDENCE_GUIDE` |
| `lib/denial-probability.ts` | Query `DenialFramework.content`; fallback to existing prompt |
| `lib/case-strategy.ts` | Use `getPromptForType("case-strategy", appTypeId)` |
| `lib/gap-analysis.ts` | Use `getPromptForType("gap-analysis", appTypeId)` |
| `lib/incremental-analysis.ts` | Already dynamic via `getCriteriaForCase()` — verify only |
| `lib/document-classifier.ts` | Category field is now String — no functional change needed |

**Verify:** Create EB-1A case, upload resume, full pipeline runs identically to before.

---

## Phase 4: API Route Updates

Thread `applicationTypeId` through routes that call pipeline functions. Most routes already load the case record — just pass `caseRecord.applicationTypeId`.

| Route | Change |
|---|---|
| `app/api/analyze/route.ts` | Pass `applicationTypeId` to `extractAndEvaluate()` |
| `app/api/case/[caseId]/analyze/route.ts` | Same |
| `app/api/case/[caseId]/criterion/route.ts` | Replace `CRITERIA_METADATA` lookup with DB, replace `resolveCanonicalId` |
| `app/api/case/[caseId]/analysis/route.ts` | Already dynamic — verify |
| Pipeline agent routes (strength-eval, gap-analysis, etc.) | Already call functions that resolve type internally — verify |
| `app/api/case/[caseId]/slash/route.ts` | Already uses `getCriteriaForCase()` — verify |

**Verify:** All API routes return 200 for existing EB-1A case. No breaking changes.

---

## Phase 5: Front-End Migration

### 5.1 Server component data loading

`app/case/[caseId]/page.tsx`:
- Fetch `criteriaMetadata` via `getCriteriaMetadata(caseRecord.applicationTypeId)`
- Pass to `<CasePageClient>` as prop

### 5.2 Prop threading through components

`app/case/[caseId]/client.tsx`:
- Accept `criteriaMetadata` prop, thread to child panels

Components to update (replace `CRITERIA_METADATA` static import with prop):
- `report-panel.tsx` — uses `CRITERIA_METADATA`, `resolveCanonicalId`
- `evidence-list-panel.tsx` — uses `CRITERIA_METADATA`
- `extraction-detail-panel.tsx` — uses `CRITERIA_METADATA`, `CriterionId`
- `extraction-raw-panel.tsx` — uses `CRITERIA_METADATA`
- `evidence-checklist-panel.tsx` — uses `DetailedExtraction` type only
- `criteria-tab.tsx` — uses `DetailedExtraction` type only

**Pattern:** `const name = criteriaMetadata?.[criterionId]?.name ?? criterionId`

### 5.3 `DetailedExtraction` type

Keep the type shape as-is. It already uses optional fields. O-1B reuses the same evidence categories. Only `criteria_summary[].criterion_id` widens from union to `string` (done in Phase 2.2).

### 5.4 Dashboard API

`app/api/dashboard/route.ts`: Update `eb1aAnalyses` references to match any Prisma accessor rename. Criteria coverage chart needs dynamic criteria labels.

**Verify:** Case page renders for EB-1A with no visual changes. Criteria names from props, not static imports.

---

## Phase 6: Admin UI

### 6.1 Application Types overview page

Create `app/admin/application-types/page.tsx`:
- Table: Code, Name, Threshold, Criteria count, Cases count, Active, Actions (Edit, Clone, Detail link)
- Follow pattern from `app/admin/criteria/page.tsx`

### 6.2 Application Type detail page

Create `app/admin/application-types/[id]/page.tsx`:
- Sections: Basic Info, Criteria (inline CRUD), Prompt Links, Strength Rubric (textarea), Evidence Types, Denial Framework (textarea)
- Reuse existing admin patterns (inline edit, active toggle)

### 6.3 Clone endpoint

Create `app/api/admin/application-types/[id]/clone/route.ts`:
- POST: duplicates type + all associated CriteriaMapping, CriterionPromptLink, EvidenceTypeDefinition, StrengthRubric, DenialFramework

### 6.4 API routes for new models

- `app/api/admin/application-types/[id]/route.ts` — GET/PATCH/DELETE
- `app/api/admin/application-types/[id]/criteria/route.ts` — per-type criteria CRUD
- `app/api/admin/application-types/[id]/prompts/route.ts` — CriterionPromptLink CRUD
- `app/api/admin/application-types/[id]/rubric/route.ts` — StrengthRubric GET/PUT
- `app/api/admin/application-types/[id]/evidence-types/route.ts` — EvidenceTypeDefinition CRUD

**Verify:** Clone EB-1A, modify name/criteria → new type visible in admin.

---

## Phase 7: O-1B Seed & End-to-End Verification

### 7.1 Seed script

Create `prisma/seed-o1b.ts`:
- `ApplicationType`: code=`O1B`, name=`O-1B Extraordinary Ability`, threshold=3
- 8 `CriteriaMapping` entries (Awards, Membership, Published material, Judging, Original contributions, Scholarly articles, High salary, Leading role — no Exhibitions/Commercial Success)
- `CriterionPromptLink` entries (can reuse EB-1A prompt slugs initially)
- `StrengthRubric` with O-1B benchmarks
- `EvidenceTypeDefinition` entries
- `DenialFramework` with O-1B evidentiary standard

Run: `node --env-file=.env --import tsx prisma/seed-o1b.ts`

### 7.2 End-to-end verification

1. Create case with `applicationTypeId = O1B`
2. Upload resume → extraction uses 8 criteria, not 10
3. Run strength evaluation → O-1B rubric
4. Draft recommendation letter → O-1B framing
5. Check denial probability → O-1B framework
6. Front-end shows 8 criteria in report panel

### 7.3 Onboard type selection

Add application type dropdown to onboard flow (simple select, defaults to EB-1A).

---

## Phase 8: Cleanup

1. Rename `eb1aAnalyses` relation → `caseAnalyses` across 28 files (mechanical find-replace)
2. Rename Prisma accessor `db.eB1AAnalysis` → `db.caseAnalysis`
3. Remove deprecated static exports from `eb1a-extraction-schema.ts`
4. Update admin sidebar nav to include Application Types link
5. Update `CLAUDE.md` with multi-type architecture notes

---

## Key files (reference)

| File | Role |
|---|---|
| `prisma/schema.prisma` | All schema changes |
| `lib/eb1a-extraction-schema.ts` | Hub: 19 importers, CriterionId union, CRITERIA_METADATA, DetailedExtraction |
| `lib/multipass-extraction.ts` | Core extraction orchestrator: 3 hardcoded maps |
| `lib/criteria.ts` | Dynamic criteria resolution + new getCriteriaMetadata() |
| `lib/agent-prompt.ts` | Prompt resolution + new getPromptForType() |
| `lib/strength-evaluation.ts` | 300-line hardcoded rubric → DB-driven |
| `lib/evidence-verification.ts` | 350-line hardcoded prompts + slug maps |
| `app/case/[caseId]/page.tsx` | Server component data loading entry point |
| `app/case/[caseId]/_components/report-panel.tsx` | Largest front-end consumer of CRITERIA_METADATA |

## Verification (end-to-end)

1. **EB-1A regression:** existing case → upload → extraction → strength eval → drafting → package. All identical to before.
2. **O-1B demo:** new case (O-1B type) → upload → extraction (8 criteria) → strength eval (O-1B rubric) → drafting → package.
3. **Admin demo:** clone EB-1A → modify criteria → create case under clone → pipeline uses cloned config.
4. **Type check:** `pnpm tsc --noEmit` — zero errors.

## Notes

- All `pnpm` for package management
- `prisma db push` for schema changes (no migrate dev)
- TipTap editor (`tiptap-editor.tsx`) does NOT import EB1A types — no editor changes needed
- Slash command system already uses `getCriteriaForCase()` — works dynamically
- Admin tables use simple HTML/Tailwind inline editing — no table library needed
