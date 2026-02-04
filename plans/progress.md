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
