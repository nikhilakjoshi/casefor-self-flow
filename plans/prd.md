# PRD: Evidence Phase, Configurable Threshold, DB-Driven Criteria & Document Management

## 1. Overview

casefor-ai currently supports a single-phase flow: upload resume, screen against 10 hardcoded EB-1A criteria, chat with agent to strengthen criteria. This PRD covers expansion into a multi-phase system with configurable thresholds, a dedicated evidence-gathering phase, S3-backed document management, DB-driven criteria/templates, and admin tooling.

## 2. Goals & Non-Goals

### Goals
- Per-case configurable criteria threshold (DB field + UI + agent tool)
- Evidence phase accessible via tab toggle on case page
- Dedicated evidence agent with document-drafting tools
- Replace `lib/eb1a-criteria.ts` with DB-driven `ApplicationType` + `CriteriaMapping`
- `Template` table for generation instructions (personal statements, rec letters, petitions, USCIS forms)
- S3-backed `Document` table with preview/download
- Admin UI for CRUD on templates and criteria
- Seed script for initial EB-1A data

### Non-Goals
- Full admin RBAC (just email-list auth)
- Rich text template editor
- O-1 or other visa type UI (schema ready only)
- DOCX/PDF rendering/export engine
- Payment/billing

## 3. User Stories

| ID | Story |
|----|-------|
| US-1 | As an applicant, I change my criteria threshold from 3 to 4 via report panel |
| US-2 | As an applicant, I tell the agent "set threshold to 5" and it updates |
| US-3 | As an applicant, I see a "Start evidence phase" badge when threshold is met |
| US-4 | As an applicant, I switch between Analysis and Evidence tabs |
| US-5 | As an applicant, I chat with the evidence agent to draft rec letters and personal statements |
| US-6 | As an applicant, I see all my documents (generated + uploaded) in the evidence panel |
| US-7 | As an applicant, I upload evidence docs to S3 and preview/download them |
| US-8 | As an admin, I CRUD criteria mappings for EB-1A |
| US-9 | As an admin, I CRUD instruction templates |

## 4. Functional Requirements

### 4.1 Schema Changes

**New enums:**
```prisma
enum ChatPhase { ANALYSIS EVIDENCE }
enum TemplateType { PERSONAL_STATEMENT RECOMMENDATION_LETTER PETITION USCIS_FORM OTHER }
enum DocumentType { MARKDOWN DOCX PDF }
enum DocumentSource { SYSTEM_GENERATED USER_UPLOADED }
enum DocumentStatus { DRAFT FINAL }
```

**Extend `CaseStatus`:** add `EVIDENCE`

**New models:**

```prisma
model ApplicationType {
  id               String   @id @default(cuid())
  code             String   @unique    // "EB1A", "O1"
  name             String
  defaultThreshold Int      @default(3)
  active           Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  criteria         CriteriaMapping[]
  templates        Template[]
  cases            Case[]
}

model CriteriaMapping {
  id                String  @id @default(cuid())
  applicationTypeId String
  criterionKey      String
  name              String
  description       String
  displayOrder      Int     @default(0)
  active            Boolean @default(true)
  applicationType   ApplicationType @relation(fields: [applicationTypeId], references: [id])
  documents         Document[]
  @@unique([applicationTypeId, criterionKey])
}

model Template {
  id                String       @id @default(cuid())
  name              String
  type              TemplateType
  applicationTypeId String
  content           String       // instruction text
  version           Int          @default(1)
  active            Boolean      @default(true)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  applicationType   ApplicationType @relation(fields: [applicationTypeId], references: [id])
  documents         Document[]
}

model Document {
  id          String         @id @default(cuid())
  caseId      String
  name        String
  type        DocumentType
  source      DocumentSource
  s3Key       String?
  s3Url       String?
  criterionId String?
  templateId  String?
  content     String?        // markdown drafts inline
  status      DocumentStatus @default(DRAFT)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  case        Case             @relation(fields: [caseId], references: [id], onDelete: Cascade)
  criterion   CriteriaMapping? @relation(fields: [criterionId], references: [id])
  template    Template?        @relation(fields: [templateId], references: [id])
  @@index([caseId])
}
```

**Modified models:**
- `Case`: add `criteriaThreshold Int @default(3)`, `applicationTypeId String?`, relation to `ApplicationType`, relation to `Document[]`
- `ChatMessage`: add `phase ChatPhase @default(ANALYSIS)`

### 4.2 Configurable Threshold

**Threshold data flow:**
```
DB (Case.criteriaThreshold) -> page.tsx -> client.tsx -> ReportPanel (display) + ChatPanel (badge)
                             -> case-agent.ts system prompt ("need N+ Strong")
                             -> agent updateThreshold tool (allows chat-based updates)
```

**Files to change:**
- `app/case/[caseId]/page.tsx` -- fetch `criteriaThreshold`, pass to client
- `app/case/[caseId]/client.tsx` -- accept threshold prop, thread to children
- `app/case/[caseId]/_components/report-panel.tsx` -- replace hardcoded `3` on lines 185/203 with prop
- `app/onboard/_components/results-modal.tsx` -- replace hardcoded `3` on line 214
- `lib/case-agent.ts` -- dynamic threshold in `buildSystemPrompt` line 46; fetch `case.criteriaThreshold` in `runCaseAgent`

**New agent tool** in `case-agent.ts`:
```typescript
updateThreshold: tool({
  description: "Update criteria threshold for this case (1-10)",
  inputSchema: z.object({ threshold: z.number().int().min(1).max(10) }),
  execute: async ({ threshold }) => {
    await db.case.update({ where: { id: caseId }, data: { criteriaThreshold: threshold } });
    return { success: true, newThreshold: threshold };
  },
})
```

**New API route:** `PATCH /api/case/[caseId]/threshold` for UI stepper control on report panel.

**UI control:** Number stepper next to threshold badge in report panel header. Calls PATCH route, updates local state.

### 4.3 Evidence Phase Indicator

- In `client.tsx`: when `strongCount >= criteriaThreshold`, render floating badge above `ChatInput`: "Start evidence phase"
- Clicking badge: `PATCH /api/case/[caseId]` sets `status: EVIDENCE`, auto-switches to Evidence tab
- Badge uses `position: absolute` above input area, styled as pill/chip

### 4.4 Phase Tabs

- New `phase-tabs.tsx`: "Analysis" | "Evidence" tab toggle at top of content area
- `client.tsx` manages `activeTab: 'analysis' | 'evidence'` state
- Analysis tab: current `ChatPanel` + `ReportPanel` (60/40)
- Evidence tab: `EvidenceChatPanel` + `DocumentsPanel` (60/40)
- Both tabs accessible regardless of case status

### 4.5 Evidence Agent

**New file:** `lib/evidence-agent.ts`

Separate `ToolLoopAgent` (Claude Sonnet 4, same model as case agent). System prompt focused on evidence gathering, document drafting, template-driven generation. Templates use mustache `{{var}}` syntax for variable interpolation.

**Tools:**

| Tool | Purpose |
|------|---------|
| `draftRecommendationLetter` | Generate rec letter from template + profile + criteria context. Saves as Document (MARKDOWN, SYSTEM_GENERATED, DRAFT) |
| `draftPersonalStatement` | Generate personal statement section/full. Saves as Document |
| `generateFromTemplate` | Generate doc from specific template ID + mustache `{{var}}` variables |
| `listDocuments` | List all documents for case |
| `getProfile` | Fetch case profile |
| `getAnalysis` | Fetch latest criteria analysis |

**New API route:** `POST /api/case/[caseId]/evidence-chat/route.ts` -- supports both text messages and file uploads (same pattern as analysis chat). Filters `phase: EVIDENCE` messages.

**Chat separation:** `ChatMessage.phase` field (ANALYSIS/EVIDENCE). Each route filters by phase. `page.tsx` loads both sets separately.

**Generated docs:** Uploaded to S3 immediately on generation. If S3 upload fails, show shadcn Sonner toast error but don't block user journey. Document record still created w/ inline content as fallback.

### 4.6 Document Management

**S3 setup:**
- New `lib/s3.ts`: `uploadToS3(key, body, contentType)`, `getSignedDownloadUrl(key)`, `deleteFromS3(key)`
- Deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Env vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`
- Key convention: `cases/{caseId}/documents/{documentId}/{filename}`

**API routes:**
- `POST /api/case/[caseId]/documents` -- upload file to S3, create Document record
- `GET /api/case/[caseId]/documents` -- list documents for case
- `GET /api/case/[caseId]/documents/[docId]` -- detail (inline content or signed URL)
- `PATCH /api/case/[caseId]/documents/[docId]` -- update content/status
- `DELETE /api/case/[caseId]/documents/[docId]` -- delete record + S3 object

**Documents panel (`documents-panel.tsx`):**
- List view with: name, type icon (MD/DOCX/PDF), source badge (System/Uploaded), status badge (Draft/Final), date
- Preview: markdown rendered inline, PDF/DOCX via signed URL download
- Upload button: accepts PDF/DOCX/MD
- Each doc row has download button (signed URL) and delete option

### 4.7 Seed Script

**File:** `prisma/seed.ts`

1. Upsert `ApplicationType` for EB-1A (code: "EB1A", defaultThreshold: 3)
2. Upsert 10 `CriteriaMapping` rows from current `eb1a-criteria.ts` data
3. Upsert starter `Template` rows:
   - Recommendation Letter template (RECOMMENDATION_LETTER)
   - Personal Statement template (PERSONAL_STATEMENT)
   - Petition template (PETITION)
   - USCIS Form template (USCIS_FORM)

Add to `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }`

### 4.8 DB-Driven Criteria (replace eb1a-criteria.ts)

**New file:** `lib/criteria.ts`
- `getCriteriaForCase(caseId)` -- joins Case -> ApplicationType -> CriteriaMapping
- `getCriteriaForType(code)` -- fetches by application type code
- Used by: `case-agent.ts`, `eb1a-agent.ts`, `report-panel.tsx`, `results-modal.tsx`

`lib/eb1a-criteria.ts` deprecated. All consumers switch to `lib/criteria.ts` helpers.

### 4.9 Admin UI

**Auth:** Open access for now -- no auth guard. Add auth later.

**Pages:**
- `app/admin/layout.tsx` -- admin shell w/ sidebar nav
- `app/admin/page.tsx` -- counts dashboard
- `app/admin/criteria/page.tsx` -- criteria table, grouped by app type. Inline edit name/description/displayOrder/active.
- `app/admin/templates/page.tsx` -- template list
- `app/admin/templates/[id]/page.tsx` -- edit form w/ textarea for content

**API routes:**
- `GET/POST /api/admin/criteria`
- `PATCH/DELETE /api/admin/criteria/[id]`
- `GET/POST /api/admin/templates`
- `PATCH/DELETE /api/admin/templates/[id]`
- `GET/POST /api/admin/application-types`

## 5. Technical Considerations

- **Migration of existing cases:** Backfill `applicationTypeId` to EB-1A's ID, `criteriaThreshold` defaults to 3 automatically
- **ChatMessage migration:** Default `phase: ANALYSIS` means existing messages need no migration
- **Existing EB1AAnalysis rows:** Store criteria JSON inline, no FK change needed. They continue working as-is.
- **Agent criteria loading:** `case-agent.ts` and `eb1a-agent.ts` switch from importing `EB1A_CRITERIA` to calling `getCriteriaForCase()` / `getCriteriaForType()`
- **S3 graceful degradation:** If env vars missing, document upload disabled in UI. Agent tools return descriptive errors.
- **Threshold validation:** Clamp 1-10 in API and agent tool

## 6. Edge Cases

- **Threshold 0 or >10:** Reject with 400
- **Missing applicationTypeId on case:** Fallback to EB-1A criteria
- **Evidence tab without meeting threshold:** Accessible but badge not shown
- **S3 upload failure:** Document record still created w/ inline content as fallback. Sonner toast shown. Don't block user journey.
- **Deleted criteria still in analyses:** Stored inline in JSON, renders fine. Agent stops using deactivated criteria.
- **Large markdown content:** Use S3 for large docs, `content` column for small drafts
- **Concurrent threshold updates:** Last write wins (acceptable for single-user-per-case)

## 7. Resolved Questions

| Question | Decision |
|----------|----------|
| Evidence agent model | Claude Sonnet 4 (same as case agent) |
| Evidence chat file uploads | Yes, drag-and-drop (same pattern as analysis chat) |
| Admin auth | Open access for now, add auth later |
| Template variables | Mustache `{{var}}` syntax |
| `/api/analyze` auto-assign applicationTypeId | Yes, auto-assign EB-1A on case creation |
| Existing EB1AAnalysis rows | Leave as-is (criteria stored inline, no FK migration) |
| Generated docs S3 timing | Immediate on generation. S3 failure: toast error, don't block, create record w/ inline content fallback |

## 8. Open Questions

- Admin auth long-term: env var email list vs `isAdmin` field on User model?
