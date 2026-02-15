# Evidence Criteria Badges + Vault Verify-as-Evidence

Issue #33: Add physical evidence reference in criteria evaluation

## Problem

Summary tab criteria sections show Strong/Weak/None but no indication of whether actual evidence documents were uploaded and routed. No way to distinguish "mentioned in resume" from "has supporting docs."

Secondary: vault documents had no path to trigger the evidence verification pipeline -- user had to re-upload via Evidence sub-tab.

## Changes Made

### 1. Analysis API - doc counts per criterion
**File**: `app/api/case/[caseId]/analysis/route.ts`
- Added `documentCriterionRouting.groupBy` query counting routed docs per criterion
- Returns `docCountsByCriterion: Record<string, number>` in response

### 2. Summary tab badges
**File**: `app/case/[caseId]/_components/report-panel.tsx`
- Added `docCountsByCriterion` to `Analysis` interface
- `CriterionSection` renders between items count and chevron:
  - **Teal pill** (`{N} docs` + FileText icon) when docs routed -- clickable, navigates to routing sub-tab
  - **Orange pill** (`Mentioned`) when strength is Strong/Weak but no docs
  - Nothing for None-strength criteria

### 3. Evidence-tab -> summary-tab refresh
**Files**: `evidence-list-panel.tsx`, `report-panel.tsx`, `client.tsx`
- `EvidenceListPanel` accepts `onDocumentsRouted` callback, fires after upload/re-verify SSE completes
- Flows through ReportPanel -> client.tsx -> bumps `analysisVersion` -> refetch

### 4. Vault "Verify as Evidence"
**File**: `app/case/[caseId]/_components/documents-panel.tsx`
- `GET /documents` API now returns `evidenceVerificationCount` per doc
- Unverified USER_UPLOADED docs show `ScanSearch` + "Verify" button on hover
- Triggers `POST /evidence-verify/{documentId}` with inline SSE progress strip (10 criterion bars)
- Teal "Verified" badge appears on completion
- Fires `onDocumentsRouted` to refresh summary badges

### 5. Re-verify endpoint: S3 text extraction
**File**: `app/api/case/[caseId]/evidence-verify/[documentId]/route.ts`
- Previously only read `document.content` -- null for vault-uploaded PDFs/DOCXs
- Now falls back to S3 download + text extraction (extractPdfText / parseDocx)
- Persists extracted text to `document.content` for future re-verifies

### 6. Model ID fix
**File**: `lib/document-classifier.ts`
- Updated `FALLBACK_MODEL` from retired `claude-haiku-3-5-20241022` to `claude-haiku-4-5-20251001`

## Known Gaps / Needs Verification

- [ ] **No S3 integration yet** -- the S3 fallback in re-verify endpoint (`getDocumentText`) will return null if S3 isn't configured. Vault PDFs/DOCXs without inline `content` will still 400. Works only for markdown vault docs or when S3 is enabled.
- [ ] Verify teal doc badge click navigates to routing sub-tab correctly
- [ ] Verify orange "Mentioned" badge shows for Strong and Weak but not None
- [ ] Verify inline SSE progress strip in vault renders C1-C10 bars filling in real-time
- [ ] Verify "Verified" badge persists after page reload (relies on `evidenceVerificationCount > 0`)
- [ ] Verify `onDocumentsRouted` callback chain: vault verify -> summary tab badges update without page reload
- [ ] Stale model IDs may exist in `prisma/agent-prompt-seeds.ts` and `app/admin/prompts/[id]/page.tsx` (not fixed)
