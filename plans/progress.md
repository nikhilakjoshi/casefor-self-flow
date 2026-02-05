# Progress

## 2026-02-04: Prisma Foundation Setup

### Completed

- Created `lib/db.ts` with Prisma client singleton (globalThis pattern for dev hot-reload)
- Updated `prisma.config.ts` to use `datasource.url` (Prisma 7 pattern) - removed deprecated `earlyAccess` flag
- Ran `prisma generate` and `prisma db push` - database synced with schema
- Added npm scripts: `typecheck`, `test`, `db:generate`, `db:push`
- Fixed lint error in `components/ui/sidebar.tsx` (Math.random in render)

### Schema Models

- CaseStatus enum: SCREENING, ACTIVE, CLOSED
- Case model: id, status, createdAt, updatedAt
- ResumeUpload model: id, caseId (FK), fileName, fileSize, pineconeVectorIds[], createdAt
- EB1AAnalysis model: id, caseId (FK), criteria (Json), strongCount, weakCount, createdAt

### Notes for Next Dev

- Prisma 7 uses `prisma.config.ts` for datasource URL (not schema.prisma)
- Use `npm run db:generate` and `npm run db:push` for Prisma commands
- Next priority: file-upload category tasks (onboard page, dropzone component)

## 2026-02-04: Onboard Page Layout

### Completed

- Created `app/onboard/page.tsx` with basic layout structure
- Added "use client" directive for client component
- Page includes: heading, description, dropzone placeholder, error state display, file selected state, analyze button
- State hooks ready for dropzone integration (selectedFile, error)

### Notes for Next Dev

- Lint warnings for unused setters are expected - will be used when dropzone component is wired
- Run `npm run db:generate` if you get PrismaClient import errors after fresh clone
- Next priority: dropzone.tsx component (react-dropzone, 10MB limit, PDF/DOCX/TXT)

## 2026-02-04: Dropzone Component

### Completed

- Created `app/onboard/_components/dropzone.tsx` with react-dropzone
- Configured accept: PDF, DOCX, TXT mime types
- Set maxSize: 10MB (10 _ 1024 _ 1024)
- Added drag-over visual feedback (border/bg color change)
- Displays file name when selected, with "drop new file to replace" hint
- Created `validateFileSize` and `validateFileType` utility functions (exported)
- Wired dropzone to page.tsx with callbacks (onFileSelect, onError)
- Error state clears file; file select clears error

### Notes for Next Dev

- Validation utils exported from dropzone.tsx for potential reuse
- Next priority: text-extraction category (lib/file-parser.ts)

## 2026-02-04: File Parser (Text Extraction)

### Completed

- Created `lib/file-parser.ts` with mammoth for DOCX, TextDecoder for TXT
- `parseDocx(buffer)` - uses mammoth.extractRawText with ArrayBuffer
- `parseTxt(buffer)` - uses TextDecoder UTF-8
- `parseFile(file)` - dispatcher based on file extension
- Custom `FileParseError` class for descriptive errors
- Empty file detection and short content validation (<100 chars)
- PDF case throws error - intended for LLM extraction per PRD

### Notes for Next Dev

- PDF files not parsed here; PRD specifies passing PDF to LLM
- Next priority: lib/chunker.ts (500 char chunks, 50 overlap)

## 2026-02-04: Text Chunker

### Completed

- Created `lib/chunker.ts` for splitting text into overlapping chunks
- `chunkText(text, chunkSize?, overlap?)` - configurable with defaults 500/50
- Handles edge cases: empty text returns [], validates chunkSize > 0, overlap < chunkSize
- Uses sliding window approach with step = chunkSize - overlap

### Notes for Next Dev

- Next priority: vector-storage category (lib/pinecone.ts, lib/embeddings.ts)

## 2026-02-04: Vector Storage (Pinecone + Embeddings)

### Completed

- Created `lib/pinecone.ts` with Pinecone client singleton (globalThis pattern)
- `getIndex()` function connects to index from PINECONE_INDEX env var
- Created `lib/embeddings.ts` with Google text-embedding-004
- `embedText(text)` - single text embedding
- `embedTexts(texts)` - batch embedding via ai sdk embedMany

### Notes for Next Dev

- Requires PINECONE_API_KEY and PINECONE_INDEX in .env
- Index name configurable via env (not hardcoded)
- Next priority: upsert function (chunks -> vectors with caseId metadata)

## 2026-02-04: Upsert Chunks Function

### Completed

- Added `upsertChunks(chunks, caseId)` to `lib/pinecone.ts`
- Generates embeddings for all chunks via embedTexts
- Creates vectors with IDs: `{caseId}-{index}-{timestamp}`
- Metadata includes: caseId, text (chunk content), chunkIndex
- Returns `{ vectorIds: string[] }` for storing in ResumeUpload record

### Notes for Next Dev

- Pinecone SDK v5+ requires `{ records: [...] }` format for upsert
- Next priority: retry logic for Pinecone failures (3 retries, exponential backoff)

## 2026-02-04: EB1A Criteria Definitions

### Completed

- Created `lib/eb1a-criteria.ts` with all 10 EB-1A criteria
- `EB1ACriterion` interface: id, name, description
- `EB1A_CRITERIA` array with: awards, membership, published_material, judging, original_contributions, scholarly_articles, exhibitions, leading_role, high_salary, commercial_success
- Exported `EB1ACriterionId` type for type-safe criterion references

### Notes for Next Dev

- USCIS requires meeting 3+ criteria for EB-1A eligibility
- Next priority: lib/eb1a-agent.ts (Vercel AI SDK generateObject setup)

## 2026-02-04: EB1A Agent + Zod Schema + Attorney Prompt

### Completed

- Created `lib/eb1a-agent.ts` with full AI evaluation pipeline
- `CriterionResultSchema`: criterionId, strength (Strong|Weak|None), reason, evidence[]
- `EB1AEvaluationSchema`: array of criterion results
- `evaluateResume(resumeText)` - calls generateObject with attorney system prompt
- `countCriteriaStrengths(evaluation)` - helper to count strong/weak/none
- Uses gemini-2.5-flash model via @ai-sdk/google
- System prompt: immigration attorney persona, requires evidence quotes, conservative evaluation

### Notes for Next Dev

- Schema uses Zod v4 syntax (project uses zod@4.3.6)
- Model configured as gemini-2.5-flash (faster than 1.5-pro, good for structured output)
- Next priority: server action shell (app/onboard/actions.ts) or Pinecone retry logic

## 2026-02-04: Server Action + Full Pipeline

### Completed

- Created `app/onboard/actions.ts` with `processResume` server action
- Full pipeline: file -> parse -> chunk -> embed -> upsert -> evaluate -> store
- Creates Case record in SCREENING status
- Parses DOCX/TXT via file-parser (PDF returns error - LLM extraction not yet implemented)
- Chunks text via chunker.ts
- Upserts to Pinecone with caseId metadata
- Creates ResumeUpload record with vector IDs
- Runs AI evaluation via eb1a-agent
- Creates EB1AAnalysis record with criteria JSON, strongCount, weakCount
- Returns typed ProcessResumeResult with evaluation data

### Notes for Next Dev

- PDF extraction not implemented (returns error) - needs LLM-based extraction
- Prisma model for EB1AAnalysis uses lowercase `eB1AAnalysis` in db client
- Next priority: results-display components (criterion-card, results-modal, Badge styling)

## 2026-02-04: Criterion Card + Badge Styling

### Completed

- Added shadcn Badge component via `npx shadcn@latest add badge`
- Created `app/onboard/_components/criterion-card.tsx`
- Props: criterionName, strength (Strong|Weak|None), reason, evidence[]
- `getStrengthStyles()` helper for Badge colors: green/yellow/gray
- Evidence quotes displayed with left border styling
- Dark mode support for all color variants

### Notes for Next Dev

- Strength type exported for use in other components
- Next priority: results-modal.tsx (Dialog with summary + criteria list)

## 2026-02-04: Results Modal

### Completed

- Added shadcn Dialog component via `npx shadcn@latest add dialog`
- Created `app/onboard/_components/results-modal.tsx`
- Props: open, onOpenChange, criteria[], strongCount, weakCount
- Summary section shows Strong/Weak/None counts with color coding
- USCIS threshold check (3+ strong) with dynamic feedback message
- Maps over criteria and renders CriterionCard for each
- Close button using DialogClose
- Max height 85vh with overflow scroll for long results

### Notes for Next Dev

- CriterionResultData interface mirrors eb1a-agent CriterionResult type
- getCriterionName helper looks up criterion name from EB1A_CRITERIA
- Next priority: Wire modal to page with state transitions (onboard/page.tsx)

## 2026-02-04: Wire Modal to Page

### Completed

- Wired ResultsModal to onboard/page.tsx with full state management
- Added isLoading state for button disabled/loading text
- Added isModalOpen state to control modal visibility
- Added analysisResult state to store evaluation data
- handleAnalyze() creates FormData, calls processResume server action
- On success: sets analysisResult and opens modal
- On failure: displays error message
- Button shows "Analyzing..." when loading, disabled during processing

### Notes for Next Dev

- Type cast `result.evaluation.criteria as CriterionResultData[]` needed for Zod schema output
- Strength type imported from criterion-card.tsx
- Next priority: Pinecone retry logic OR polish (loading spinner, retry button)

## 2026-02-04: Pinecone Retry Logic

### Completed

- Added `withRetry<T>()` generic helper fn to lib/pinecone.ts
- Recursive impl: tries fn, on error waits backoff then retries with doubled backoff
- MAX_RETRIES=3, INITIAL_BACKOFF_MS=1000 (1s -> 2s -> 4s)
- Wrapped `index.upsert()` call in withRetry
- Throws original error after all retries exhausted

### Notes for Next Dev

- Retry logic only covers upsert, not embedding generation (embedTexts call)
- Next priority: polish category (loading spinner, error messages, retry button)

## 2026-02-04: Polish (Loading/Error States)

### Completed

- Added animated SVG spinner to Analyze button during loading
- Spinner uses `animate-spin` Tailwind class
- Added `handleRetry()` function to reset error and analysisResult states
- Error display now includes "Try again" button inline
- Error section styled with red background for visibility

### Notes for Next Dev

- All PRD items complete
- PDF extraction still not implemented (out of scope for initial PRD)

## 2026-02-05: Prisma Schema - Evidence Phase Foundation (PRD Task 1)

### Completed

- Added 5 new enums: ChatPhase, TemplateType, DocumentType, DocumentSource, DocumentStatus
- Extended CaseStatus enum w/ EVIDENCE value
- Added ApplicationType model (code unique, defaultThreshold, active flag)
- Added CriteriaMapping model (applicationTypeId+criterionKey unique, displayOrder, active)
- Added Template model (name, type, content, version, active)
- Added Document model (caseId indexed, s3Key/s3Url optional, criterionId/templateId optional, status default DRAFT)
- Modified Case: added criteriaThreshold (default 3), applicationTypeId (optional FK to ApplicationType), documents relation
- Modified ChatMessage: added phase field (ChatPhase, default ANALYSIS)
- Ran prisma generate + db push successfully

### Notes for Next Dev

- Pre-existing lint errors in case-agent.ts (no-explicit-any x4) and results-modal.tsx (unescaped entities x2) -- not introduced by this change
- Next priority: Task 2 (seed script) -- depends on this task, unblocks tasks 3, 9
- Task 4 (S3 utilities) has no deps and can be done in parallel w/ task 2

## 2026-02-05: Seed Script (PRD Task 2)

### Completed

- Created `prisma/seed.ts` w/ upserts for EB-1A ApplicationType, 10 CriteriaMappings, 4 Templates
- CriteriaMapping data mirrors `lib/eb1a-criteria.ts` (same keys, names, descriptions, displayOrder 0-9)
- Templates: Recommendation Letter, Personal Statement, Petition Letter, USCIS Form Instructions (placeholder content)
- Template IDs use deterministic format `{applicationTypeId}-{type}` for idempotent upserts
- Backfills existing cases w/ null applicationTypeId to EB-1A
- Added `db:seed` script + `prisma.seed` config to package.json
- Uses `node --env-file=.env --import tsx` (no dotenv dep needed, Node 24 native)
- Ran successfully: 1 ApplicationType, 10 criteria, 4 templates, 20 cases backfilled

### Notes for Next Dev

- dotenv not installed as project dep; seed uses Node's `--env-file` flag instead
- Pre-existing lint errors unchanged (case-agent.ts x4, results-modal.tsx x2)
- Next priority: Task 3 (DB-driven criteria lib) or Task 4 (S3 utils) -- both unblocked
- Task 3 unblocks tasks 7, 11 (agent threshold, evidence agent) -- higher downstream impact

## 2026-02-05: DB-Driven Criteria Lib (PRD Task 3)

### Completed

- Created `lib/criteria.ts` w/ `getCriteriaForCase(caseId)` and `getCriteriaForType(code)`
  - `getCriteriaForCase`: joins Case -> ApplicationType -> CriteriaMapping, falls back to EB1A
  - `getCriteriaForType`: fetches by ApplicationType.code, returns active criteria ordered by displayOrder
  - Returns flat `Criterion` type: `{ id, key, name, description, displayOrder }`
- Updated `lib/case-agent.ts`: dynamic criteria fetched in `runCaseAgent` Promise.all, passed to `buildSystemPrompt` and `createCaseAgentTools`
- Updated `lib/eb1a-agent.ts`: all 4 exported functions (`evaluateResume`, `evaluateResumePdf`, `streamEvaluateResumePdf`, `streamEvaluateResume`) accept optional `criteria` param, fall back to `getCriteriaForType('EB1A')`. Streaming fns now async.
- Updated `app/api/analyze/route.ts`: await streaming fns (now async)
- Updated `app/api/case/[caseId]/analysis/route.ts`: returns `criteriaNames` map from DB
- Updated `report-panel.tsx`: removed static import, uses `criteriaNames` from API response
- Updated `results-modal.tsx`: removed static import, accepts optional `criteriaNames` prop
- Updated `lib/incremental-analysis.ts`: uses `getCriteriaForCase` instead of static array
- Deprecated `lib/eb1a-criteria.ts`: added @deprecated JSDoc, all imports removed

### Notes for Next Dev

- `Criterion.key` maps to `CriteriaMapping.criterionKey` (e.g., "awards") -- used as criterion ID in analysis data
- `Criterion.id` is the DB record ID (cuid) -- used for DB relations
- Pre-existing lint errors unchanged (case-agent.ts x4, results-modal.tsx x2+1 unused caseId)
- Next priority: Task 5 (threshold PATCH API) or Task 4 (S3 utils) or Task 9 (auto-assign applicationTypeId)
- Task 5 unblocks tasks 7, 8, 10 (threshold UI, evidence badge) -- high downstream
- Task 4 unblocks tasks 11, 13 (evidence agent, document CRUD) -- high downstream

## 2026-02-05: Threshold PATCH API (PRD Task 5)

### Completed

- Created `app/api/case/[caseId]/threshold/route.ts` with PATCH handler
- Auth check via `auth()` + ownership verification (same pattern as analysis/route.ts)
- Zod validation: `z.number().int().min(1).max(10)` with 400 on invalid input
- Updates `Case.criteriaThreshold` via `db.case.update`
- Returns `{ success: true, criteriaThreshold }` on success
- Typecheck passes clean

### Notes for Next Dev

- Next priority: Task 6 (case status PATCH) or Task 8 (threshold UI) or Task 4 (S3 utils)
- Task 8 (threshold UI) depends on tasks 1+5 (both done) -- can start now
- Task 6 unblocks task 10 (evidence badge) -- moderate downstream
- Task 4 unblocks tasks 11, 13 (evidence agent, document CRUD) -- high downstream

## 2026-02-05: Auto-Assign ApplicationTypeId (PRD Task 9)

### Completed

- Modified `app/api/analyze/route.ts`: lookups EB-1A ApplicationType before case creation
- Uses `db.applicationType.findUnique({ where: { code: 'EB1A' } })` to fetch
- Spreads `applicationTypeId` into case create data when found
- Graceful degradation: logs warning if EB-1A not found (seed not run), proceeds without it
- Typecheck passes clean, no new lint issues

### Notes for Next Dev

- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, client.tsx, actions.ts)
- Next priority: Task 6 (case status PATCH, unblocks task 10) or Task 4 (S3 utils, unblocks tasks 11, 13) or Task 7 (agent threshold tool) or Task 8 (threshold UI)
