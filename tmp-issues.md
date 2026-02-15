# Open Issues (pulled 2026-02-12)

## #36 - Recommender CSV upload and UI issue
(screenshot only - no text body)

## #35 - Thoughts on the Evidence Checklist page - needs restructuring and reframing
- Should not be "Evidence Checklist" -- needs to be "Case Documents"
- Cannot have a generic checklist since evidence is unique per case/candidate
- Instead of "MISSING" say "To be drafted" or similar
- Evidence checklist should be dynamically built per candidate based on case, resume assessment, and survey answers

## #34 - Need a reference to the "Start Evidence" page somewhere on the screen
- Where does this fit in the workflow?
- No reference to it on the case page

## #33 - Add a physical evidence reference in the criteria evaluation
- 2 levels of criteria evaluation:
  1. Level 1 - candidate just mentioned they have this (orange)
  2. Level 2 - candidate has supplied evidentiary documents to prove it

## #32 - Functionality of "Add Context"
- Should say "Add or Remove Evidence context to this criteria"
- Need ability to remove wrongly picked evidence (prompt-based or trash icon per evidence)

## #30 - "Start Evidence" button change
- Rename "Start Evidence" to "Start Evidence Collection"

## #29 - Change to guide the user rather than ask them for next steps
- After "Build Case" analysis, suggest next steps instead of asking candidate what to do
- Proposed flow:
  1. Start collecting evidence
  2. Assess strength of each criteria based on evidence, iterate until strong in 4+ criteria
  3. In parallel start recommendation letter workflow
  4. Once evidence + reco letters done, start drafting documents
  5. Compile case and check against denial engine
  6. Iterate on weak aspects

## #28 - Application error while waiting for analysis page to load
- Error on initial load of analysis page
- Clicking back then "Build Case" again works

## #27 - Blank analysis page after initial assessment
- Blank analysis page after resume analysis + clicking "Build Case"
- No interaction possible in agent chat window

## #26 - "Sign in" visible after logging in and when case assessment is running
- Sign in button still visible after auth
