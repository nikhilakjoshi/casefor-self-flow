import { createHash } from "crypto"
import type { DetailedExtraction } from "./eb1a-extraction-schema"

const CATEGORY_PREFIXES: Record<string, string> = {
  publications: "pub",
  awards: "awd",
  patents: "pat",
  memberships: "mem",
  media_coverage: "med",
  judging_activities: "jdg",
  speaking_engagements: "spk",
  grants: "grt",
  leadership_roles: "ldr",
  compensation: "cmp",
  exhibitions: "exh",
  commercial_success: "com",
  original_contributions: "org",
}

// Key fields per category used for deterministic hashing
const KEY_FIELDS: Record<string, string[]> = {
  publications: ["title", "venue", "year"],
  awards: ["name", "issuer", "year"],
  patents: ["title", "number"],
  memberships: ["organization", "role"],
  media_coverage: ["outlet", "title"],
  judging_activities: ["type", "organization", "venue"],
  speaking_engagements: ["event", "year"],
  grants: ["title", "funder"],
  leadership_roles: ["title", "organization"],
  compensation: ["amount", "context"],
  exhibitions: ["venue", "title"],
  commercial_success: ["description"],
  original_contributions: ["description"],
}

export function generateItemId(
  category: string,
  item: Record<string, unknown>,
): string {
  const prefix = CATEGORY_PREFIXES[category] ?? "itm"
  const fields = KEY_FIELDS[category] ?? []
  const parts = fields.map((f) => String(item[f] ?? "")).join("|")
  const hash = createHash("sha256").update(parts).digest("hex").slice(0, 8)
  return `${prefix}_${hash}`
}

const EVIDENCE_CATEGORIES = [
  "publications", "awards", "patents", "memberships", "media_coverage",
  "judging_activities", "speaking_engagements", "grants", "leadership_roles",
  "compensation", "exhibitions", "commercial_success", "original_contributions",
] as const

export function ensureItemIds(extraction: DetailedExtraction): boolean {
  let changed = false
  for (const cat of EVIDENCE_CATEGORIES) {
    const arr = extraction[cat] as (Record<string, unknown>)[]
    if (!arr?.length) continue
    for (const item of arr) {
      if (!item.id) {
        item.id = generateItemId(cat, item)
        changed = true
      }
    }
  }
  return changed
}
