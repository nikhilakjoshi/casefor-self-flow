# Pipeline Gap Analysis: Mermaid Spec vs Codebase

Comparing `visagenius_pipeline_1.mermaid` (18-step, 6-phase pipeline) against current codebase.

## Phase-by-Phase Mapping

### PHASE 1: INITIAL ASSESSMENT -- Fully Implemented

| Step | Spec | Status | Notes |
|------|------|--------|-------|
| U1 | Upload Resume (PDF/TXT/DOC) | DONE | `/onboard` dropzone, `/api/case/[caseId]/analyze` |
| U2 | 5 Intake Questions | DONE | intake form + survey modal (8 steps, more than 5) |
| S1 | Document Classification (type detection, 99% confidence) | DONE | `lib/document-classifier.ts` -- Claude Haiku classifies into 14 categories w/ confidence (0-1). Called async post-upload. |
| S2 | Resume Parsing & Criteria Mapping (69 items) | DONE | `eb1a-agent.ts` `extractAndEvaluate()` with `DetailedExtractionSchema` |
| S3 | Criteria Strength Evaluation (tier 1-5, approval prob) | DONE | `strength-evaluation.ts` with AAO thresholds |
| S4 | Gap Analysis & Action Plan | DONE | `gap-analysis.ts` with filing decision |
| S5 | Case Strategy & Filing Plan (recommended criteria, filing plan) | DONE | `lib/case-strategy.ts` -- dedicated agent recommending criteria (w/ effort levels), filing timeline, budget, letter strategy, risk mitigation, merits narrative |

**Missing:** None. Phase 1 fully implemented.

### PHASE 2: EVIDENCE VERIFICATION -- Mostly Implemented

| Step | Spec | Status | Notes |
|------|------|--------|-------|
| U3 | Upload 10-50+ evidence docs | DONE | `evidence-verify/route.ts` -- multi-file upload (up to 10), creates Document records + Pinecone vectors |
| S6 | Evidence Classification (batch classify all docs) | DONE | Evidence-verify route calls `classifyDocument()` async on each uploaded file (14 categories + confidence) |
| S7 | Criteria Routing (auto-assign docs to C1-C10, manual reassign) | PARTIAL | Docs verified against all C1-C10 with scores, but no auto-routing/assignment to best-fit criterion. Document model has `criterionId` but not auto-populated. |
| D1 | User reviews routing & clicks "Verify" | PARTIAL | `evidence-list-panel.tsx` shows results per doc, re-verify button exists. No manual criterion reassignment UI. |
| S8 | Evidence Verification per criterion (deep verify, red flags, INCLUDE/EXCLUDE) | DONE | `lib/evidence-verification.ts` -- 10 parallel agents (C1-C10), tier scoring, red flags, STRONG/INCLUDE_WITH_SUPPORT/NEEDS_MORE_DOCS/EXCLUDE recommendations |
| O2 | Verification outputs (criteria verified count, red flags, doc strength) | DONE | `EvidenceVerification` model stores per-criterion results w/ score, recommendation, full agent JSON. UI shows score bars, tier badges, red flags, claims lists. |

**Remaining gap:** S7 auto-routing (assign docs to best-fit criterion) + D1 manual reassignment UI.

### PHASE 3: CASE CONSOLIDATION -- Missing

| Step | Spec | Status | Notes |
|------|------|--------|-------|
| S9 | Case Consolidation & Prioritization (master synthesis, PRIMARY/BACKUP/DROP, Kazarian narrative) | MISSING | No consolidation agent. Strength eval + gap analysis cover some but no unified synthesis w/ criteria ranking or petition structure |
| O3 | Consolidation outputs (primary/backup/drop, letter count, petition structure, gap priorities) | MISSING | |

### PHASE 4: RECOMMENDATION LETTERS -- Partial

| Step | Spec | Status | Notes |
|------|------|--------|-------|
| S10 | Recommender Input + Portfolio Health Scorecard (independence, diversity, coverage) | PARTIAL | Recommender CRUD exists. Missing: Portfolio Health Scorecard. |
| S11 | Recommender Bio Research (AI researches credentials, suitability) | MISSING | No AI research of recommender bios. User provides manually. |
| S12 | Letter Draft Generation & Iteration | DONE | `evidence-agent.ts` `draftRecommendationLetter` + `lib/drafting-agent.ts` tool-loop agent for drafting/revising docs |

### PHASE 5: DOCUMENT GENERATION -- Partial

| Step | Spec | Status | Notes |
|------|------|--------|-------|
| S13 | Personal Statement (Exhibit A, 2-4 pages, first person) | DONE | `evidence-agent.ts` `draftPersonalStatement` tool |
| S14 | Petition Cover Letter (I-140, Kazarian two-prong, per-criterion evidence) | PARTIAL | Template system + `generateFromTemplate` exist, but no dedicated Kazarian-structured petition gen |
| S15 | Executive Resume (Exhibit B, USCIS-optimized, criterion-mapped) | MISSING | No USCIS-optimized resume generator |
| S16 | Exhibit List (standard order: A->B->C+->Evidence->Identity) | MISSING | No exhibit list generator |

### PHASE 6: FINAL REVIEW & FILING -- Mostly Missing

| Step | Spec | Status | Notes |
|------|------|--------|-------|
| S17 | Final Review & Filing Checklist (completeness, consistency, regulatory compliance) | PARTIAL | `document-verifier.ts` + `getChecklist` do basic checks. Missing: cross-doc consistency, regulatory compliance, pipeline status |
| S18 | Denial Probability Engine (AAO patterns 2015-2025, field-specific rates, risk mitigation) | PARTIAL | `strength-evaluation.ts` has approval prob + Kazarian assessment. Missing: dedicated denial engine w/ AAO pattern matching |

## Summary

### Fully Missing (no code)
| # | Step | Description |
|---|------|-------------|
| 1 | S9 | Case Consolidation -- PRIMARY/BACKUP/DROP ranking, Kazarian narrative |
| 2 | S11 | Recommender Bio Research |
| 3 | S15 | Executive Resume (Exhibit B) |
| 4 | S16 | Exhibit List |

### Partially Built (core exists, incomplete)
| # | Step | Description |
|---|------|-------------|
| 1 | S7 | Criteria Routing -- docs verified against all C1-C10 but no auto-assign to best-fit criterion |
| 2 | D1 | Routing Review UI -- results shown, no manual criterion reassignment |
| 3 | S10 | Portfolio Health Scorecard -- recommender CRUD exists, no health scoring |
| 4 | S14 | Petition Cover Letter -- template system exists, no Kazarian structure |
| 5 | S17 | Final Review -- basic checks exist, no cross-doc consistency |
| 6 | S18 | Denial Probability Engine -- approval prob exists, no dedicated denial engine |

### Fully Built
| # | Step | Description |
|---|------|-------------|
| 1 | U1 | Resume Upload |
| 2 | U2 | Intake Questions |
| 3 | S1 | Document Classification (14 categories + confidence) |
| 4 | S2 | Resume Parsing & Criteria Mapping |
| 5 | S3 | Criteria Strength Evaluation |
| 6 | S4 | Gap Analysis |
| 7 | S5 | Case Strategy & Filing Plan |
| 8 | U3 | Bulk Evidence Upload (multi-file) |
| 9 | S6 | Batch Evidence Classification |
| 10 | S8 | Per-Criterion Evidence Verification (C1-C10, red flags, INCLUDE/EXCLUDE) |
| 11 | O2 | Verification Outputs (scores, recommendations, UI) |
| 12 | S12 | Letter Draft Generation + Drafting Agent |
| 13 | S13 | Personal Statement |
