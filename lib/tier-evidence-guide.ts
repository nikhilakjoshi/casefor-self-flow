/**
 * Static tier evidence definitions per EB-1A criterion.
 * Extracted from agent-prompt-seeds.ts scoring rubrics.
 */

export interface TierDefinition {
  tier: number
  label: string
  examples: string
}

export const TIER_EVIDENCE_GUIDE: Record<string, TierDefinition[]> = {
  C1: [
    { tier: 1, label: "Exceptional", examples: "Nobel, Pulitzer, Oscar, Fields Medal, Turing Award, MacArthur Fellowship" },
    { tier: 2, label: "Strong", examples: "Major professional society awards (IEEE Fellow award, ACM prizes), NSF CAREER, PECASE" },
    { tier: 3, label: "Moderate", examples: "Competitive fellowships (NSF GRFP, Rhodes, Fulbright), multi-university awards" },
    { tier: 4, label: "Weak", examples: "Single-university awards without external validation" },
    { tier: 5, label: "Disqualifying", examples: "Employee of Month, Dean's List, participation certificates" },
  ],
  C2: [
    { tier: 1, label: "Exceptional", examples: "National Academy membership (NAS, NAE, NAM), Royal Society Fellow. <1% acceptance" },
    { tier: 2, label: "Strong", examples: "Fellow-level in major society (IEEE Fellow, ACM Fellow, AAAS Fellow). <5% acceptance" },
    { tier: 3, label: "Moderate", examples: "Senior member with documented selective process. 5-15% acceptance" },
    { tier: 4, label: "Weak", examples: "Standard professional membership with some selection" },
    { tier: 5, label: "Disqualifying", examples: "Basic IEEE/ACM membership, dues-based, automatic" },
  ],
  C3: [
    { tier: 1, label: "Exceptional", examples: "Top-tier outlets (NYT, WSJ, BBC, Nature News) specifically about applicant. Circulation >1M" },
    { tier: 2, label: "Strong", examples: "Major national media. 3+ independent outlets. Substantial discussion" },
    { tier: 3, label: "Moderate", examples: "Regional media or niche trade publications. 2-3 outlets" },
    { tier: 4, label: "Weak", examples: "Local media, brief mentions" },
    { tier: 5, label: "Disqualifying", examples: "Press releases, marketing materials, self-published, social media" },
  ],
  C4: [
    { tier: 1, label: "Exceptional", examples: "Editor for major journal AND 200+ reviews. OR Senior conference role at top venue" },
    { tier: 2, label: "Strong", examples: "Editorial board OR 100+ reviews. OR Conference senior PC" },
    { tier: 3, label: "Moderate", examples: "PC member AND 50+ reviews" },
    { tier: 4, label: "Weak", examples: "<50 reviews. Low-impact journals only" },
    { tier: 5, label: "Disqualifying", examples: "Grading students, internal code reviews, predatory journals" },
  ],
  C5: [
    { tier: 1, label: "Exceptional", examples: "4+ major significance indicators: widespread adoption, commercial validation, research impact, field transformation" },
    { tier: 2, label: "Strong", examples: "3 indicators met: e.g. 100+ citations growing 20%+ YoY, independent adoption by 2+ companies, expert validation" },
    { tier: 3, label: "Moderate", examples: "2 indicators met: e.g. $1M+ licensing revenue, 100M+ end users" },
    { tier: 4, label: "Weak", examples: "1 indicator met with limited documentation" },
    { tier: 5, label: "Disqualifying", examples: "No indicators of major significance. Routine work without field impact" },
  ],
  C6: [
    { tier: 1, label: "Exceptional", examples: "h-index >=15, citations >=800, publications in Nature/Science/Cell, first author at top venues" },
    { tier: 2, label: "Strong", examples: "h-index >=10, citations >=400, top 10% journals by impact factor, A* conference papers" },
    { tier: 3, label: "Moderate", examples: "h-index >=5, citations >=100, mid-tier peer-reviewed journals" },
    { tier: 4, label: "Weak", examples: "Sporadic publications, long gaps, low-impact venues" },
    { tier: 5, label: "Disqualifying", examples: "Predatory journals (pay-to-publish), unpublished manuscripts, non-peer-reviewed" },
  ],
  C7: [
    { tier: 1, label: "Exceptional", examples: "Solo exhibition at major museum (MoMA, Tate, Guggenheim), Venice/Whitney Biennale" },
    { tier: 2, label: "Strong", examples: "Curated group show at recognized museum, major film festival selection (Cannes, Sundance)" },
    { tier: 3, label: "Moderate", examples: "Juried exhibition with <10% acceptance, established regional gallery with national reach" },
    { tier: 4, label: "Weak", examples: "Non-juried group shows, galleries without established reputation" },
    { tier: 5, label: "Disqualifying", examples: "Self-organized exhibitions, pay-to-display, community center/coffee shop shows" },
  ],
  C8: [
    { tier: 1, label: "Exceptional", examples: "C-suite at Fortune 500, PI at top research university, founding engineer at unicorn ($1B+)" },
    { tier: 2, label: "Strong", examples: "VP/Director at well-known company, lab lead at R1 university, CTO at funded startup ($10M+)" },
    { tier: 3, label: "Moderate", examples: "Senior role at mid-size company, critical technical role with documented project impact" },
    { tier: 4, label: "Weak", examples: "Junior/mid-level role, organization lacks documented reputation" },
    { tier: 5, label: "Disqualifying", examples: "Unknown organization without reputation, self-employment without distinguished clients" },
  ],
  C9: [
    { tier: 1, label: "Exceptional", examples: ">=95th percentile with multi-source data (BLS + DOL + 2 surveys), multi-year W-2 pattern" },
    { tier: 2, label: "Strong", examples: ">=90th percentile with BLS + one additional source. Prospective salary from established company" },
    { tier: 3, label: "Moderate", examples: "Above average but <90th percentile, or adequate salary with insufficient comparative data" },
    { tier: 4, label: "Weak", examples: "No comparative data, wrong geographic comparison, one-time bonus only" },
    { tier: 5, label: "Disqualifying", examples: "Below field average, no documentation, benefits counted as salary" },
  ],
  C10: [
    { tier: 1, label: "Exceptional", examples: "Billboard #1/Top 10, $100M+ box office, platinum album, 500M+ streams" },
    { tier: 2, label: "Strong", examples: "Gold album, $50M+ box office, major streaming platform special, 100M+ streams" },
    { tier: 3, label: "Moderate", examples: "5M-50M streams, $1M-5M tour gross, moderate box office with documented ROI" },
    { tier: 4, label: "Weak", examples: "Moderate commercial activity without comparative context, small venues" },
    { tier: 5, label: "Disqualifying", examples: "No financial documentation, social media metrics only, amateur performances" },
  ],
}

// Legacy criterion ID aliases
TIER_EVIDENCE_GUIDE.awards = TIER_EVIDENCE_GUIDE.C1
TIER_EVIDENCE_GUIDE.membership = TIER_EVIDENCE_GUIDE.C2
TIER_EVIDENCE_GUIDE.published_material = TIER_EVIDENCE_GUIDE.C3
TIER_EVIDENCE_GUIDE.judging = TIER_EVIDENCE_GUIDE.C4
TIER_EVIDENCE_GUIDE.original_contributions = TIER_EVIDENCE_GUIDE.C5
TIER_EVIDENCE_GUIDE.scholarly_articles = TIER_EVIDENCE_GUIDE.C6
TIER_EVIDENCE_GUIDE.exhibitions = TIER_EVIDENCE_GUIDE.C7
TIER_EVIDENCE_GUIDE.leading_role = TIER_EVIDENCE_GUIDE.C8
TIER_EVIDENCE_GUIDE.high_salary = TIER_EVIDENCE_GUIDE.C9
TIER_EVIDENCE_GUIDE.commercial_success = TIER_EVIDENCE_GUIDE.C10

export const TIER_LABELS: Record<number, string> = {
  1: "Exceptional",
  2: "Strong",
  3: "Moderate",
  4: "Weak",
  5: "Disqualifying",
}
