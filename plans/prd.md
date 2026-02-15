# Requirements Extracted from Figma

## Context
Requirements pulled from green comment cards on Figma board showing EB-1A case workflow (Phases 1-4).

---

## R1: Resume handling
- Resume is NOT a hard requirement to start the process
- If user doesn't have a resume at hand: allow them to skip and go straight to the survey
- Survey serves as the alternative input path - applicant fills in all their information there
- Survey also used to identify gaps in the applicant's profile
- New resume creation capability needed (generate from survey/case data)
- User can upload/replace resume at any point during the case (not a one-time choice)
- Updated resume based on case

## R2: Merge top-level tabs (Phase 1)
- Merge Criteria + Strength Eval into a single tab: **"Criteria"**
- Merge Gap Analysis + Strategy into a single tab: **"Planning"**
- These two merged tabs constitute Phase 1

## R3: Criteria-to-evidence mapping
- **Guided evidence drop**: File drop zones on criteria tab should treat dropped docs as actual evidence for that criterion (not just context like today)
- **Evidence status badges**: After initial analysis maps out criteria, each identified potential evidence listing should show a badge:
  - **"Evidence Required"** (orange) - evidence identified but not yet uploaded/provided
  - **"Evidence in Vault"** (green) - evidence document already uploaded and available
- Badges appear inline next to each evidence item within a criterion's expanded view
- This applies to the KEY EVIDENCE / EVIDENCE section within each criterion card
- **Post-drop analysis flow**:
  1. User drops doc on a criterion -> system uploads + tags to that criterion
  2. Background analysis evaluates doc against criterion's requirements
  3. Outcomes:
     - **Relevant**: extract key evidence points, add to KEY EVIDENCE, badge -> "Evidence in Vault"
     - **Partially relevant**: show extracted points + flag gaps (e.g. "proves award exists but missing selection rate")
     - **Not relevant**: warn user, suggest better-fit criteria

## R4: Recommender-to-criteria mapping
- In the **Add Recommender modal**, add criteria checkboxes (multi-select)
- When user adds a recommender, they also tag which criteria that recommender supports
- Recommender should map to their top 4-5 strongest criteria
- This captures the relationship at the point of recommender creation

## R5: Merge Phase 3 tabs
- Merge Consolidation + Strategy into a single tab: **"Consolidation"**

## R6: Document collection with placeholders + auto-categorization
- Show placeholder cards for each required document category so user knows what's missing
- **Drafting ability** (in-app creation/editing):
  - Recommendation Letters
  - Personal Statement
  - Cover Letter
  - New/Updated Resume
- **Upload-only** (forms to be uploaded):
  - G-1450PPU
  - G-1450300
  - G-1450I40
  - G-28
  - I-140
  - I-907
- Each card shows upload status (e.g. "1 File Uploaded" or empty placeholder)
- **Two upload modes**:
  - **Drop anywhere**: file is auto-categorized into the correct card using AI/filename analysis
  - **Drop on specific card**: user manually assigns the category by dropping into that card's zone
- Cards are expandable to show uploaded files with metadata (filename, uploader, date)

## R7: USCIS form filling + E-sign
- Link out to USCIS website to fill forms directly
- E-sign capability across all documents (forms, letters, statements, etc.)

## R8: Final package assembly
- Merge all evidences into one unified package
- Auto-generate page numbers across the full document
- Insert exhibit separators between sections
- Final output: single assembled EB-1A petition package

## R9: Denial engine
- Denial engine overview on overall case
- Referenced in Letters (Draft) section

## R10: Documents to generate (Letters/Draft phase)
- Personal Statement
- Cover Letter
- USCIS Letters
- New/Updated Resume (based on case)

## R11: Recommendation letter capabilities
- Rec letter should auto-generate based on templates
- Ability to send emails and collaborate on shared letter (for recommenders and clients)
- Template inputs support
- Bring in redlining and word capabilities
- Split them into the different letters

---

## Green Card Traceability

| Green Card Text | Mapped To |
|---|---|
| Resume not a must, survey if not. Survey for gaps... | R1: Resume handling |
| Merge the top levels (left, over Criteria / Gap Analysis+Strategy) | R2: Merge Phase 1 tabs |
| Merge the top levels (right, over Consolidation+Strategy) | R5: Merge Phase 3 tabs |
| Criteria mapping to Evidence list | R3: Criteria-to-evidence mapping |
| Recommender list capture + map to strong criteria | R4: Recommender-to-criteria mapping |
| Additional doc capture | R6: Document collection (upload modes) |
| Map recommenders to criteria | R4: Recommender-to-criteria mapping |
| Merge and summary dashboard STOP ability | R5: Merge Phase 3 tabs |
| G1450PPU, G1450300, G1450I40, G28, I-140, I-907 | R6: Upload-only forms |
| Link to USCIS to fill | R7: USCIS form filling |
| Esign | R7: E-sign |
| Ability to send emails and collaborate on shared letter for reco letters and clients | R11: Rec letter capabilities |
| Template inputs | R11: Rec letter capabilities |
| New resume creation | R1: Resume handling |
| Denials engine overview on overall | R9: Denial engine |
| Ability to merge all evidences into one package, with page numbers and exhibit separators | R8: Final package assembly |

---

## Unresolved questions
- Priority/ordering across R1-R11?
- Which requirements are current sprint vs backlog?
