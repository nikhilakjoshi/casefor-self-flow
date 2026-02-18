import { db } from './db'
import { getCriteriaForCase } from './criteria'

// --- Types ---

export interface PackageDocument {
  documentId: string
  name: string
  source: 'SYSTEM_GENERATED' | 'USER_UPLOADED'
  category: string | null
}

export interface PackageExhibit {
  label: string
  title: string
  type: 'fixed' | 'criterion'
  criterionKey?: string
  criterionName?: string
  documents: PackageDocument[]
}

export interface PackageStructure {
  generatedAt: string
  exhibits: PackageExhibit[]
  letterSnapshots?: Record<string, string>
}

// --- Category groupings for fixed exhibits ---

const EXHIBIT_A_CATEGORIES = ['COVER_LETTER', 'PETITION_LETTER']
const EXHIBIT_B_CATEGORIES = ['I140', 'G28', 'I907', 'G1450PPU', 'G1450300', 'G1450I40', 'G1450', 'G1145']
const EXHIBIT_C_CATEGORIES = ['PASSPORT_ID', 'VISA_STAMP', 'I797_APPROVAL', 'I94', 'I20', 'DEGREE_CERTIFICATE']
const EXHIBIT_D_CATEGORIES = ['RESUME_CV', 'EXECUTIVE_RESUME']
const EXHIBIT_E_CATEGORIES = ['PERSONAL_STATEMENT']
const EXHIBIT_F_CATEGORIES = ['RECOMMENDATION_LETTER']

const FIXED_EXHIBITS: { title: string; categories: string[] }[] = [
  { title: 'Cover/Petition Letter', categories: EXHIBIT_A_CATEGORIES },
  { title: 'USCIS Forms', categories: EXHIBIT_B_CATEGORIES },
  { title: 'Identity & Immigration Docs', categories: EXHIBIT_C_CATEGORIES },
  { title: 'Resume / CV', categories: EXHIBIT_D_CATEGORIES },
  { title: 'Personal Statement', categories: EXHIBIT_E_CATEGORIES },
  { title: 'Expert Testimony', categories: EXHIBIT_F_CATEGORIES },
]

// All categories claimed by fixed exhibits
const FIXED_CATEGORY_SET = new Set([
  ...EXHIBIT_A_CATEGORIES,
  ...EXHIBIT_B_CATEGORIES,
  ...EXHIBIT_C_CATEGORIES,
  ...EXHIBIT_D_CATEGORIES,
  ...EXHIBIT_E_CATEGORIES,
  ...EXHIBIT_F_CATEGORIES,
])

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Assemble the live package structure for a case.
 * Queries all documents + criterion routings, builds exhibits A-F (fixed) + G+ (per criterion).
 */
export async function assemblePackage(caseId: string): Promise<PackageStructure> {
  const [documents, routings, criteria] = await Promise.all([
    db.document.findMany({
      where: { caseId },
      select: {
        id: true,
        name: true,
        source: true,
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.documentCriterionRouting.findMany({
      where: { document: { caseId } },
      select: {
        documentId: true,
        criterion: true,
        score: true,
      },
      orderBy: { criterion: 'asc' },
    }),
    getCriteriaForCase(caseId),
  ])

  const exhibits: PackageExhibit[] = []
  const usedDocIds = new Set<string>()

  // Build fixed exhibits A-F
  for (const def of FIXED_EXHIBITS) {
    const catSet = new Set(def.categories)
    const docs = documents
      .filter((d) => d.category && catSet.has(d.category))
      .map((d) => {
        usedDocIds.add(d.id)
        return toPackageDoc(d)
      })
    if (docs.length === 0) continue
    exhibits.push({
      label: '', // assigned below
      title: def.title,
      type: 'fixed',
      documents: docs,
    })
  }

  // Build criterion exhibits (G+)
  // Group routings by criterion, only include docs not already in fixed exhibits
  const routingsByCriterion = new Map<string, string[]>()
  for (const r of routings) {
    if (usedDocIds.has(r.documentId)) continue
    // Only include strong routings
    if (r.score < 5.0) continue
    const existing = routingsByCriterion.get(r.criterion) || []
    existing.push(r.documentId)
    routingsByCriterion.set(r.criterion, existing)
  }

  const docMap = new Map(documents.map((d) => [d.id, d]))

  // Sort criteria by displayOrder
  const sortedCriteria = [...criteria].sort((a, b) => a.displayOrder - b.displayOrder)

  for (const crit of sortedCriteria) {
    const docIds = routingsByCriterion.get(crit.key)
    if (!docIds || docIds.length === 0) continue

    // Also include any uncategorized docs or docs whose category isn't in fixed exhibits
    const docs = docIds
      .map((id) => docMap.get(id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map(toPackageDoc)

    if (docs.length === 0) continue

    exhibits.push({
      label: '',
      title: `${crit.name} Evidence`,
      type: 'criterion',
      criterionKey: crit.key,
      criterionName: crit.name,
      documents: docs,
    })
  }

  // Assign sequential labels
  for (let i = 0; i < exhibits.length; i++) {
    exhibits[i].label = i < LABELS.length ? LABELS[i] : `${i + 1}`
  }

  return {
    generatedAt: new Date().toISOString(),
    exhibits,
  }
}

function toPackageDoc(d: {
  id: string
  name: string
  source: string
  category: string | null
}): PackageDocument {
  return {
    documentId: d.id,
    name: d.name,
    source: d.source as 'SYSTEM_GENERATED' | 'USER_UPLOADED',
    category: d.category,
  }
}
