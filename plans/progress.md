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
- Set maxSize: 10MB (10 * 1024 * 1024)
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
