# EB1A Resume Analyzer PRD

## Overview

Single-page feature (`/onboard`) enabling users to upload resumes for automated EB1A visa eligibility evaluation. System extracts text, stores embeddings in Pinecone, and uses AI to analyze against all 10 EB1A criteria.

**Why it matters**: Provides instant preliminary assessment for potential EB1A applicants, helping them understand their qualification strength before engaging legal services.

---

## Goals

- Enable resume upload via drag-and-drop (PDF, DOCX, TXT)
- Extract and chunk text for vector storage
- Store embeddings in Pinecone for future retrieval
- AI-powered evaluation against all 10 EB1A criteria
- Display results in modal with Strong/Weak/None ratings per criterion

## Non-Goals

- Multiple file uploads per session
- User authentication on `/onboard` (public access)
- Resume editing or improvement suggestions
- Full case management (deferred to post-login flow)

---

## User Stories

1. **As a potential EB1A applicant**, I want to upload my resume and see which criteria I qualify for, so I can decide whether to pursue the application.

2. **As a user**, I want clear Strong/Weak/None ratings with explanations, so I understand my eligibility gaps.

3. **As a user**, I want the analysis to complete quickly (<30s), so I get immediate feedback.

---

## Functional Requirements

### FR1: File Upload
- Accept PDF, DOCX, TXT files via React Dropzone
- Max file size: 10MB
- Show file name after selection
- Single file per session (refresh to restart)

### FR2: Text Extraction
- PDF: Send directly to LLM (Gemini supports PDF input natively)
- DOCX: Use `mammoth` library
- TXT: Direct UTF-8 read
- Handle extraction failures gracefully

### FR3: Vector Storage
- Chunk extracted text: 500 characters with 50 character overlap
- Generate embeddings via Google `text-embedding-004`
- Upsert to Pinecone index `caseforai-index`
- Store `caseId` in vector metadata for association

### FR4: Database Records

**Case** (new entity):
- `id` (cuid)
- `status` (enum: SCREENING, ACTIVE, CLOSED)
- `createdAt`
- `updatedAt`

**ResumeUpload** (linked to Case):
- `id` (cuid)
- `caseId` (FK to Case)
- `fileName`
- `fileSize`
- `pineconeVectorIds[]`
- `createdAt`

**EB1AAnalysis** (linked to Case):
- `id` (cuid)
- `caseId` (FK to Case)
- `criteria` (JSON array of results)
- `strongCount`
- `weakCount`
- `createdAt`

### FR5: AI Evaluation
- Use Vercel AI SDK `generateObject` with Google Gemini
- System prompt: Immigration attorney persona
- Evaluate all 10 EB1A criteria:
  1. Major awards/prizes for excellence
  2. Membership in associations requiring outstanding achievement
  3. Published material about the person
  4. Judging work of others
  5. Original scientific/scholarly/artistic contributions
  6. Authorship of scholarly articles
  7. Display at artistic exhibitions
  8. Leading/critical role in distinguished organizations
  9. High salary/remuneration
  10. Commercial success in performing arts
- Output per criterion: `{ strength: Strong|Weak|None, reason, evidence[] }`

### FR6: Results Display
- Show results in modal dialog
- Summary: count of Strong/Weak criteria
- Note: USCIS requires 3+ criteria
- List all 10 criteria with:
  - Name
  - Badge (Strong=green, Weak=yellow, None=gray)
  - Reason (1-2 sentences)
  - Evidence quotes from resume

### FR7: States
- Empty: Dropzone with instructions
- Selected: File name shown, "Analyze" button
- Processing: Spinner with "Analyzing..." text
- Complete: Modal with results
- Error: Red error message with retry option

---

## Technical Considerations

### Architecture
- Next.js 16 App Router with server actions
- Single server action `processResume(formData)` handles full pipeline
- Client components for upload UI and modal

### Dependencies (to install)
```
prisma @prisma/client
ai @ai-sdk/google
@pinecone-database/pinecone
react-dropzone
mammoth
zod
```
Note: No `pdf-parse` needed - Gemini handles PDF natively.

### Existing Infrastructure
- PostgreSQL via Railway (DATABASE_URL configured)
- Pinecone API key and index configured
- Google AI API key configured
- shadcn/ui component library available

### File Structure
```
app/onboard/
  page.tsx
  actions.ts
  _components/
    dropzone.tsx
    results-modal.tsx
    criterion-card.tsx
lib/
  db.ts
  pinecone.ts
  embeddings.ts
  file-parser.ts           # DOCX/TXT only; PDF goes direct to LLM
  chunker.ts
  eb1a-criteria.ts
  eb1a-agent.ts
prisma/
  schema.prisma            # Case, ResumeUpload, EB1AAnalysis models
```

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| File >10MB | Reject with "File too large" before upload |
| Invalid file type | Reject with "Unsupported format" |
| Empty/corrupted PDF | "Unable to extract text from file" |
| Pinecone upsert fails | Retry 3x, then show error |
| AI timeout (>60s) | Show timeout error with retry button |
| Non-English resume | Process anyway, note in results if detection fails |
| Very short resume (<100 chars) | Warn "Resume appears incomplete" |

---

## Decisions (Resolved)

| Question | Answer |
|----------|--------|
| Auth on /onboard | Public (no auth required) |
| Results persistence | Yes - create Case + EB1AAnalysis records |
| Vector cleanup | Retain vectors, store caseId in metadata |
| PDF extraction | Send PDF directly to Gemini (native support) |

## Future Work (Not in Scope)

- User login flow post-analysis
- Case management dashboard
- Additional document uploads per case
- Lawyer matching based on results
