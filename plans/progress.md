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

## 2026-02-05: Case Status PATCH API (PRD Task 6)

### Completed

- Created `app/api/case/[caseId]/route.ts` with PATCH handler
- Auth check via `auth()` + ownership verification (same pattern as threshold/route.ts)
- Zod validation: `z.enum(['SCREENING', 'ACTIVE', 'EVIDENCE', 'CLOSED'])` with 400 on invalid
- Updates `Case.status` via `db.case.update`
- Returns `{ success: true, status }` on success
- Typecheck passes clean, no new lint issues

### Notes for Next Dev

- Pre-existing lint errors unchanged
- Next priority: Task 8 (threshold UI, deps met) or Task 7 (agent threshold tool, deps met) or Task 11 (evidence agent, deps met) or Task 4 (S3 utils, no deps)

## 2026-02-05: Agent Threshold Tool + Dynamic Prompt (PRD Task 7)

### Completed

- Added `updateThreshold` tool to `createCaseAgentTools()` in `lib/case-agent.ts`
  - Zod schema: `z.number().int().min(1).max(10)`
  - Executes `db.case.update` on `criteriaThreshold`, returns `{ success, newThreshold }`
- `runCaseAgent()` now fetches `case.criteriaThreshold` in parallel Promise.all
  - Uses `db.case.findUnique` with `select: { criteriaThreshold: true }`
  - Falls back to 3 if case not found
- `buildSystemPrompt()` accepts `threshold` param, replaces hardcoded "3+ Strong" with dynamic `${threshold}+ Strong`
- Typecheck passes clean, no new lint issues (pre-existing lint errors unchanged)

### Notes for Next Dev

- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, client.tsx, actions.ts)
- Next priority: Task 8 (threshold UI, deps 1+5 met) or Task 4 (S3 utils, no deps, unblocks 11+13) or Task 11 (evidence agent, deps 1+2+3 met)
- Task 8 unblocks task 10 (evidence badge); Task 4 unblocks tasks 11+13 (evidence agent, document CRUD)

## 2026-02-05: S3 Utilities (PRD Task 4)

### Completed

- Installed `@aws-sdk/client-s3` (3.983.0) and `@aws-sdk/s3-request-presigner` (3.983.0)
- Created `lib/s3.ts` with globalThis singleton pattern (matches pinecone.ts pattern)
- `isS3Configured()`: checks AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
- `uploadToS3(key, body, contentType)`: PutObjectCommand, returns `{ key, url }`
- `getSignedDownloadUrl(key, expiresIn?)`: presigned GET URL, default 1hr expiry
- `deleteFromS3(key)`: DeleteObjectCommand
- `buildDocumentKey(caseId, documentId, filename)`: helper for key convention `cases/{caseId}/documents/{documentId}/{filename}`
- Added AWS env vars to `.env.example`: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
- Typecheck + lint pass clean

### Notes for Next Dev

- S3 is optional: `isS3Configured()` returns false when env vars missing; all ops throw descriptive error if not configured
- Document CRUD (task 13) should use `buildDocumentKey()` for consistent key paths
- Pre-existing lint errors unchanged
- Next priority: Task 11 (evidence agent, deps 1+2+3 met, unblocks 12) or Task 13 (document CRUD, deps 1+4 met, unblocks 14) or Task 8 (threshold UI, deps 1+5 met, unblocks 10)

## 2026-02-05: Evidence Agent (PRD Task 11)

### Completed

- Created `lib/evidence-agent.ts` with ToolLoopAgent (Claude Sonnet 4) -- mirrors case-agent.ts pattern
- Evidence-focused system prompt: role is evidence gathering specialist, knows templates, document drafting, criteria context
- 6 tools implemented:
  - `getProfile`: fetches CaseProfile.data for case
  - `getAnalysis`: fetches latest EB1AAnalysis, returns criteria w/ strengths
  - `listDocuments`: queries Document where caseId, returns list w/ name/type/source/status
  - `draftRecommendationLetter`: accepts recommender info + criterionKeys, fetches template + profile + analysis, creates Document (MARKDOWN, SYSTEM_GENERATED, DRAFT), uploads to S3 if configured
  - `draftPersonalStatement`: accepts optional focusCriteria, same pattern as rec letter with PERSONAL_STATEMENT template
  - `generateFromTemplate`: accepts templateId + variables, replaces {{var}} mustache placeholders, creates Document
- `runEvidenceAgent(opts)` gathers context in parallel (criteria, threshold, profile, analysis, templates), builds prompt, returns streaming response
- All tools create Document records and optionally upload to S3 via `buildDocumentKey()`
- Typecheck + lint pass clean (no new issues)

### Notes for Next Dev

- Evidence agent does NOT use LLM to generate document content -- it creates structured draft templates with context sections. The LLM (agent itself) uses the tool results conversationally to guide the user.
- Document drafts are markdown-format templates with profile/criteria context embedded. The agent should be enhanced later to use LLM generation for actual prose.
- `createEvidenceAgentTools` doesn't take `criteria` param (unlike case-agent) since evidence tools don't need enum validation on criterion keys
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, client.tsx, actions.ts)
- Next priority: Task 12 (evidence chat API, deps 1+11 now met, unblocks 14) or Task 13 (document CRUD, deps 1+4 met, unblocks 14) or Task 8 (threshold UI, deps 1+5 met, unblocks 10)

## 2026-02-05: Evidence Chat API (PRD Task 12)

### Completed

- Created `app/api/case/[caseId]/evidence-chat/route.ts` with POST handler
- Auth check via `auth()` + ownership verification (same pattern as chat/route.ts)
- Multipart (file upload) path: processes PDF/DOCX/TXT, chunks + embeds to Pinecone, saves ChatMessage with `phase: 'EVIDENCE'`
- JSON (text message) path: saves user ChatMessage with `phase: 'EVIDENCE'`
- Loads full evidence-phase message history from DB (`where: { caseId, phase: 'EVIDENCE' }`) as authoritative message list for agent
- Calls `runEvidenceAgent` instead of `runCaseAgent`, passes evidence-phase messages
- Saves assistant response to ChatMessage with `phase: 'EVIDENCE'` in onFinish callback
- Returns streaming response via `result.toTextStreamResponse()`
- Typecheck + lint pass clean (no new issues)

### Notes for Next Dev

- Evidence chat does NOT support `action: 'initiate'` (no AI-initiated evidence conversations); only user-initiated messages
- File upload processing reuses same PDF extraction (Gemini 2.5 Flash) + chunking + Pinecone upsert pipeline as analysis chat
- DB history is loaded fresh on each request as authoritative source (not relying on client-sent messages array for history)
- Pre-existing lint errors unchanged
- Next priority: Task 13 (document CRUD, deps 1+4 met, unblocks 14) or Task 8 (threshold UI, deps 1+5 met, unblocks 10)

## 2026-02-05: Document CRUD API (PRD Task 13)

### Completed

- Created `app/api/case/[caseId]/documents/route.ts` with POST and GET handlers
  - GET: auth + ownership check, returns documents list (id, name, type, source, status, createdAt) ordered by createdAt desc
  - POST: multipart/form-data, accepts PDF/DOCX/MD files, creates Document record, uploads to S3 if configured, falls back to inline content for markdown
- Created `app/api/case/[caseId]/documents/[docId]/route.ts` with GET, PATCH, DELETE handlers
  - GET: auth + ownership check, returns document detail + signed S3 download URL if s3Key present
  - PATCH: accepts { content?, status?, name? } via Zod validation, updates Document record
  - DELETE: auth + ownership, deletes S3 object if present, deletes Document record
- Shared `verifyOwnership` helper in [docId]/route.ts to reduce auth boilerplate
- S3 operations wrapped in try/catch for graceful degradation (signed URL generation, S3 deletion)
- Typecheck + lint pass clean (no new issues)

### Notes for Next Dev

- POST accepts file extensions: .pdf, .docx, .md, .markdown -- maps to DocumentType enum
- Non-markdown files without S3 configured create a record with no stored content (metadata only)
- Document record created before S3 upload so we have the ID for buildDocumentKey()
- GET list uses `select` to minimize data transfer (no content/s3Key in list view)
- Pre-existing lint errors unchanged
- Next priority: Task 14 (evidence tab UI, deps 1+12+13 now met) or Task 8 (threshold UI, deps 1+5 met, unblocks 10) or Task 15-18 (admin pages)

## 2026-02-05: Threshold UI (PRD Task 8)

### Completed

- `app/case/[caseId]/page.tsx`: fetches `criteriaThreshold` from case record, passes as `initialThreshold` prop to CasePageClient
- `app/case/[caseId]/client.tsx`: accepts `initialThreshold` prop, manages `threshold` state, passes to ReportPanel w/ `onThresholdChange` callback
- `app/case/[caseId]/_components/report-panel.tsx`: accepts `threshold` + `onThresholdChange` props, replaces hardcoded `3` w/ dynamic threshold, adds +/- stepper buttons next to threshold badge, PATCHes `/api/case/[caseId]/threshold` on change w/ optimistic update + rollback
- `app/onboard/_components/results-modal.tsx`: accepts optional `threshold` prop (default 3), replaces hardcoded `3` in comparison + display text
- `app/api/case/[caseId]/analysis/route.ts`: now includes `criteriaThreshold` in response so ReportPanel refetches pick up threshold changes from agent tool calls
- Typecheck + lint pass clean (no new issues, pre-existing unchanged)

### Notes for Next Dev

- Threshold stepper is inline in the badge area (compact); +/- buttons w/ min 1, max 10
- Optimistic update: state changes immediately, reverts on API failure
- Analysis API response now includes `criteriaThreshold` so threshold stays in sync across refetches
- Onboard flow uses default threshold=3 (no case record yet to fetch from)
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, client.tsx, actions.ts)
- Next priority: Task 10 (evidence badge, deps 1+8 now met) or Task 14 (evidence tab UI, deps 1+12+13 met) or Task 15-18 (admin pages)

## 2026-02-05: Evidence Tab UI (PRD Task 14)

### Completed

- Created `app/case/[caseId]/_components/phase-tabs.tsx`: Analysis | Evidence toggle w/ pill-style tabs, bg-muted container
- Created `app/case/[caseId]/_components/evidence-chat-panel.tsx`: standalone chat panel for evidence agent
  - Own message state, streaming, file upload (drag-drop + attach button)
  - POSTs to `/api/case/[caseId]/evidence-chat`
  - Drop zone overlay, typing indicator, empty state placeholder
- Created `app/case/[caseId]/_components/documents-panel.tsx`: document list + preview
  - List view: type icon (MD/DOCX/PDF), source badge (System/Uploaded), status badge (Draft/Final), date
  - Detail view: markdown rendered inline via markdown-to-jsx, download button for S3-backed files
  - Upload button for PDF/DOCX/MD files, delete with hover reveal
  - Fetches from `/api/case/[caseId]/documents` API
- Updated `app/case/[caseId]/page.tsx`: loads evidence-phase ChatMessages separately (`where: { phase: 'EVIDENCE' }`), passes as `initialEvidenceMessages` prop
  - Analysis messages now filtered with `where: { phase: 'ANALYSIS' }` (was unfiltered before)
- Updated `app/case/[caseId]/client.tsx`: `activeTab` state ('analysis' | 'evidence'), PhaseTabs rendered in top bar
  - Analysis tab: existing ChatPanel + ReportPanel (60/40)
  - Evidence tab: EvidenceChatPanel + DocumentsPanel (60/40)
  - Accepts `initialEvidenceMessages` prop, threads to EvidenceChatPanel
- Typecheck + lint pass clean (no new issues; pre-existing unchanged)

### Notes for Next Dev

- EvidenceChatPanel manages its own messages/loading/dropzone state (not shared w/ analysis ChatPanel)
- DocumentsPanel list view uses compact row items; detail view uses X button to go back (no router)
- Analysis messages query now explicitly filters `phase: 'ANALYSIS'` -- old messages without phase field default to ANALYSIS in DB so this is backward-compatible
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, actions.ts)
- Next priority: Task 10 (evidence badge, deps 1+8+14 now met) or Task 15-18 (admin pages)

## 2026-02-05: Evidence Phase Indicator Badge (PRD Task 10)

### Completed

- Added `strongCount` state to `client.tsx`, initialized from `initialAnalysis.strongCount`
- Added `onStrongCountChange` callback prop to `ReportPanel` -- propagates strongCount up to client.tsx on each analysis refetch
- Floating emerald pill badge appears above ChatInput when `strongCount >= threshold` and user is on analysis tab
- Badge click: PATCHes `/api/case/[caseId]` with `{ status: 'EVIDENCE' }`, switches to evidence tab, dismisses badge
- `badgeDismissed` state prevents badge from re-appearing after user dismisses it (within session)
- Typecheck passes clean, no new lint issues (pre-existing unchanged)

### Notes for Next Dev

- Badge is positioned `bottom-20` inside the chat panel column (above ChatInput area), centered horizontally
- Badge auto-hides on evidence tab (only shown on analysis tab)
- `badgeDismissed` is session-only state; badge will reappear on page reload if threshold still met (intentional -- user may want to re-enter evidence phase)
- PATCH to update case status is fire-and-forget; tab switch happens regardless of API success
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, actions.ts)
- Next priority: Tasks 15-18 (admin layout, criteria API+UI, templates API+UI, application-types API)

## 2026-02-05: Admin Layout + Dashboard (PRD Task 15)

### Completed

- Created `components/admin-sidebar.tsx`: client component w/ static nav links (Dashboard, Criteria, Templates, Application Types), "Back to App" footer link
  - Uses same Sidebar variant="inset" pattern as AppSidebar
  - Active state detection: exact match for /admin, startsWith for sub-pages
- Created `app/admin/layout.tsx`: SidebarProvider + AdminSidebar + SidebarInset shell, mirrors case layout pattern (h-12 header, overflow handling)
- Created `app/admin/page.tsx`: server component, fetches counts via parallel Promise.all (db.case.count, db.criteriaMapping.count, db.template.count), renders 3 dashboard cards w/ icons + counts
- No auth guard (open access per PRD resolved decisions)
- Typecheck + lint pass clean (no new issues; pre-existing unchanged)

### Notes for Next Dev

- AdminSidebar nav includes /admin/application-types link (for task 18) even though that page doesn't exist yet
- Dashboard cards use bg-card + border pattern consistent w/ existing card styles
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, actions.ts)
- Next priority: Task 16 (admin criteria API+UI, deps 1+2 met) or Task 17 (admin templates API+UI, deps 1+2 met) or Task 18 (admin application-types API, dep 1 met)

## 2026-02-05: Admin Criteria API + UI (PRD Task 16)

### Completed

- Created `app/api/admin/criteria/route.ts` with GET and POST handlers
  - GET: returns all CriteriaMapping with ApplicationType included, ordered by applicationTypeId + displayOrder
  - POST: creates new CriteriaMapping from { applicationTypeId, criterionKey, name, description, displayOrder }, validates applicationTypeId exists, handles P2002 unique constraint violation (409)
- Created `app/api/admin/criteria/[id]/route.ts` with PATCH and DELETE handlers
  - PATCH: accepts { name?, description?, displayOrder?, active? } via Zod validation, returns updated record w/ applicationType
  - DELETE: removes CriteriaMapping by id, returns { success: true }
- Created `app/admin/criteria/page.tsx`: client component w/ criteria table grouped by ApplicationType
  - Columns: criterionKey (mono), name, description, displayOrder, active toggle
  - Inline edit mode: pencil icon -> edit all fields inline -> check/X to save/cancel
  - Active toggle: clickable pill switch, PATCHes immediately on click (outside edit mode)
  - Delete: trash icon per row, deletes via DELETE API
  - Empty state: message suggesting seed script
- No auth guard (open access per PRD resolved decisions, consistent w/ admin layout)
- Typecheck + lint pass clean (no new issues; pre-existing unchanged)

### Notes for Next Dev

- Admin criteria API has no auth guard (consistent w/ admin layout from task 15)
- POST returns 409 on duplicate criterionKey for same applicationTypeId (Prisma P2002)
- Active toggle works both in edit mode and in normal view (different click handlers)
- Used useRef didFetch pattern to avoid react-hooks/set-state-in-effect lint rule on useEffect data fetch
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, actions.ts)
- Next priority: Task 17 (admin templates API+UI, deps 1+2 met) or Task 18 (admin application-types API, dep 1 met)

## 2026-02-05: Admin Templates API + UI (PRD Task 17)

### Completed

- Created `app/api/admin/templates/route.ts` with GET and POST handlers
  - GET: returns all Templates with ApplicationType included, ordered by type + name
  - POST: creates new Template from { name, type, applicationTypeId, content }, validates applicationTypeId exists
- Created `app/api/admin/templates/[id]/route.ts` with GET, PATCH, DELETE handlers
  - GET: returns template by id with ApplicationType included
  - PATCH: accepts { name?, type?, content?, active?, version? } via Zod validation, returns updated record w/ applicationType
  - DELETE: removes Template by id, returns { success: true }
- Created `app/admin/templates/page.tsx`: client component w/ templates list table
  - Columns: name (link to edit page), type badge, application type name, version, active toggle
  - Delete button per row
  - Active toggle: clickable pill switch, PATCHes immediately
  - Empty state: message suggesting seed script
- Created `app/admin/templates/[id]/page.tsx`: edit form
  - Fields: name (input), type (select dropdown), active (toggle), content (textarea w/ mono font)
  - Application type shown as read-only text (not editable)
  - Save navigates back to list; Cancel link to list
  - Error display for save failures
  - Back arrow navigation to list
- No auth guard (consistent w/ admin layout from task 15)
- Typecheck + lint pass clean (no new issues; pre-existing unchanged)

### Notes for Next Dev

- Added GET handler to [id]/route.ts (not in PRD steps but needed for edit page fetch)
- Template type uses native `<select>` element (no shadcn Select component needed)
- Content textarea uses mono font for template instruction editing
- Application type is read-only on edit page (changing it would break template-appType relationship)
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, actions.ts)
- Next priority: Task 18 (admin application-types API, dep 1 met) -- last remaining task

## 2026-02-05: Admin Application-Types API (PRD Task 18)

### Completed

- Created `app/api/admin/application-types/route.ts` with GET and POST handlers
  - GET: returns all ApplicationTypes ordered by code, includes `_count` of criteria and cases
  - POST: creates new ApplicationType from { code, name, defaultThreshold, active }, validates code uniqueness (409 on P2002)
- No auth guard (consistent w/ admin layout + criteria + templates open-access decision)
- Typecheck + lint pass clean (no new issues; pre-existing unchanged)

### Notes for Next Dev

- All 18 PRD tasks are now complete
- POST catches Prisma P2002 to return 409 on duplicate code (same pattern as criteria API)
- `_count` includes criteria and cases counts (not templates; PRD only asked for criteria + cases)
- defaultThreshold validated 1-10 (consistent w/ threshold PATCH API from task 5)
- Pre-existing lint errors unchanged (case-agent.ts x4 no-explicit-any, results-modal.tsx x2 unescaped entities + 1 unused caseId, plus warnings in upload/route.ts, upload-zone.tsx, actions.ts)

## 2026-02-07: Evidence Agent RAG Search Tool

### Completed

- Added `searchDocuments` tool to Evidence Agent in `lib/evidence-agent.ts`
- Imports `queryContext` from `lib/rag.ts` for vector search
- Tool schema: `{ query: string, topK?: number (default 5) }`
- Returns RAG results with text and relevance scores
- Updated system prompt with DOCUMENT SEARCH section explaining usage
- Typecheck passes; no new lint issues (pre-existing unchanged)

### Notes for Next Dev

- `searchDocuments` enables agent to search uploaded docs (resume, supporting materials) during evidence gathering
- Results include `text` (chunk content) and `score` (similarity score)
- Agent prompt instructs to use searchDocuments before drafting to ground docs in real materials
- Pre-existing lint errors unchanged
