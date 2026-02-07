# Product Requirements Document

## Overview

This PRD covers 4 open GitHub issues for CaseFor AI, prioritized as: Bug fix (#3) > Multiple uploads (#1) > File formats (#2) > Recommender details (#4).

---

## Issue #3: Document Sharing Bug (Priority 1)

### Problem
Documents uploaded in Analysis phase not accessible in Evidence phase. Evidence agent says "I don't have access to documents from other chats."

### Root Cause
Evidence Agent has NO RAG integration. Case Agent queries Pinecone + injects context; Evidence Agent doesn't. RAG layer already filters by `caseId` only (not phase) - sharing is correct at data layer.

### Solution
Add `searchDocuments` tool to Evidence Agent (active search only, no passive injection).

### Implementation

**File: `lib/evidence-agent.ts`**
1. Import `queryContext` from `./rag`
2. Add `searchDocuments` tool to `createEvidenceAgentTools`:
```typescript
searchDocuments: tool({
  description: "Search uploaded documents and case materials for relevant information",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    topK: z.number().optional().default(5),
  }),
  execute: async ({ query, topK }) => {
    const results = await queryContext(caseId, query, topK);
    return { results };
  },
})
```
3. Update system prompt to mention document search capability

### Verification
- Upload document in Analysis chat
- Enter Evidence phase
- Ask Evidence agent about uploaded document content
- Agent should use searchDocuments tool and find content

---

## Issue #1: Multiple File Uploads (Priority 2)

### Requirements
- Drag/drop multiple files at once
- Parallel processing with per-file status
- Per-file analysis (not combined)
- Progress/status indicator per file
- Handle partial failures gracefully

### Implementation

**Backend: `app/api/case/[caseId]/upload/route.ts`**
1. Change `formData.get("file")` to `formData.getAll("files")`
2. Process files with `Promise.allSettled()` for parallel processing
3. Run `runIncrementalAnalysis` per file (return analysis status per file)
4. Return batch response:
```typescript
interface BatchUploadResponse {
  results: Array<{
    fileName: string
    success: boolean
    chunksCreated?: number
    analysisStatus?: 'queued' | 'completed' | 'failed'
    error?: string
  }>
  totalSuccess: number
  totalFailed: number
}
```

**Frontend: `app/case/[caseId]/_components/upload-zone.tsx`**
- Use `frontend-design` skill for polished UI
- Remove `maxFiles: 1` constraint
- Track per-file state: pending/uploading/analyzing/success/error
- Show file list with individual progress indicators
- Allow removing files before upload
- Display per-file analysis progress
- Handle partial failures (some succeed, some fail)

### Verification
- Upload 3+ files simultaneously
- Verify parallel processing (all start together)
- Verify individual status indicators update
- Verify partial failure handling (fail 1 file, others succeed)

---

## Issue #2: Additional File Formats (Priority 3)

### Requirements
- Add: Markdown (.md), Excel (.xlsx, .xls), CSV (.csv)
- Preserve table structure for Excel/CSV (output as markdown tables)
- PDF and DOCX already supported

### Implementation

**Dependencies**
```bash
pnpm add xlsx
```

**File: `lib/file-parser.ts`**

Add parsers:
```typescript
// Markdown - return as-is
export async function parseMarkdown(buffer: ArrayBuffer): Promise<string> {
  return new TextDecoder('utf-8').decode(buffer).trim()
}

// CSV - convert to markdown table
export async function parseCsv(buffer: ArrayBuffer): Promise<string> {
  const csv = new TextDecoder('utf-8').decode(buffer)
  const rows = csv.split('\n').map(row => row.split(',').map(cell => cell.trim()))
  if (!rows.length) throw new FileParseError('CSV is empty')

  const headers = rows[0]
  const headerRow = `| ${headers.join(' | ')} |`
  const separator = `| ${headers.map(() => '---').join(' | ')} |`
  const dataRows = rows.slice(1).map(row => `| ${row.join(' | ')} |`)

  return [headerRow, separator, ...dataRows].join('\n')
}

// Excel - convert each sheet to markdown table
export async function parseExcel(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const tables: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
    if (!data.length) continue

    tables.push(`## ${sheetName}\n`)
    const headers = data[0]
    tables.push(`| ${headers.join(' | ')} |`)
    tables.push(`| ${headers.map(() => '---').join(' | ')} |`)
    data.slice(1).forEach(row => tables.push(`| ${row.join(' | ')} |`))
    tables.push('\n')
  }

  if (!tables.length) throw new FileParseError('Excel file is empty')
  return tables.join('\n')
}
```

Update type and switch:
```typescript
export type SupportedFileType = 'docx' | 'txt' | 'pdf' | 'md' | 'csv' | 'xlsx' | 'xls'
```

**File: `app/api/case/[caseId]/upload/route.ts`**
- Add cases for md, csv, xlsx, xls calling new parsers

**Frontend files**
- Update accept MIME types in upload-zone.tsx and dropzone.tsx:
```typescript
accept: {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}
```

### Verification
- Upload .md file - verify raw text extracted
- Upload .csv file - verify markdown table output
- Upload .xlsx with multiple sheets - verify all sheets converted to tables

---

## Issue #4: Recommender Details (Priority 4)

### Requirements
- Capture recommender info before drafting letters
- Per-case storage (not global)
- Hybrid UI: form for basics, chat for context
- Essential fields: Name, Title, Relationship Type, Context
- Optional: Email, Phone, LinkedIn, Bio, Credentials, Timeline

### Implementation

**Prisma Schema: `prisma/schema.prisma`**
```prisma
enum RelationshipType {
  ACADEMIC_ADVISOR
  RESEARCH_COLLABORATOR
  INDUSTRY_COLLEAGUE
  SUPERVISOR
  MENTEE
  CLIENT
  PEER_EXPERT
  OTHER
}

model Recommender {
  id                  String           @id @default(cuid())
  caseId              String

  // Essential
  name                String
  title               String
  relationshipType    RelationshipType
  relationshipContext String

  // Optional contact
  email               String?
  phone               String?
  linkedIn            String?
  countryRegion       String?

  // Optional professional
  organization        String?
  bio                 String?
  credentials         String?

  // Optional timeline
  startDate           DateTime?
  endDate             DateTime?
  durationYears       Int?

  // Agent-captured context (JSON)
  contextNotes        Json?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  case                Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  documents           Document[]

  @@index([caseId])
}
```

Add to Case model: `recommenders Recommender[]`
Add to Document model: `recommenderId String?` + relation

**API Routes**

`app/api/case/[caseId]/recommenders/route.ts`:
- GET: List recommenders for case
- POST: Create recommender (validate essential fields only)

`app/api/case/[caseId]/recommenders/[recommenderId]/route.ts`:
- GET: Fetch single recommender
- PATCH: Update recommender
- DELETE: Remove recommender

**Agent Tools: `lib/evidence-agent.ts`**

Add tools:
- `saveRecommender` - Create/update recommender from chat context
- `listRecommenders` - List saved recommenders
- `getRecommender` - Get full recommender details

Update `draftRecommendationLetter`:
- Add optional `recommenderId` parameter
- Link generated document to recommender
- Use recommender.contextNotes for richer personalization

**UI Components**

`app/case/[caseId]/_components/recommender-form.tsx`:
- Form with collapsible sections (Contact, Professional, Relationship)
- Only validate essential fields
- Use `frontend-design` skill for polished form UI

`app/case/[caseId]/_components/documents-panel.tsx`:
- Add "Recommenders" tab alongside documents
- Show recommender cards with name, title, relationship badge
- Actions: Edit, Delete, Generate Letter

**System Prompt Update**
Add instructions for recommender-aware letter generation

### Verification
- Create recommender via form - verify essential field validation
- Have Evidence agent extract recommender from chat - verify tool usage
- Generate letter using saved recommender - verify document linked

---

## Critical Files Summary

| Issue | Files to Modify |
|-------|-----------------|
| #3 Bug | `lib/evidence-agent.ts` |
| #1 Multi-upload | `app/api/case/[caseId]/upload/route.ts`, `app/case/[caseId]/_components/upload-zone.tsx` |
| #2 Formats | `lib/file-parser.ts`, `app/api/case/[caseId]/upload/route.ts`, upload-zone.tsx, dropzone.tsx |
| #4 Recommenders | `prisma/schema.prisma`, `lib/evidence-agent.ts`, new API routes, new UI components |

---

## Open Questions

1. Max file count for multi-upload? (suggest 10)
2. CSV delimiter detection needed? (comma vs semicolon vs tab)
3. Recommender can write multiple letters for different criteria?
4. contextNotes schema - freeform JSON or define expected structure?
