import { db } from '@/lib/db'
import { FolderOpen, ListChecks, FileStack } from 'lucide-react'

async function getCounts() {
  const [caseCount, criteriaCount, templateCount] = await Promise.all([
    db.case.count(),
    db.criteriaMapping.count(),
    db.template.count(),
  ])
  return { caseCount, criteriaCount, templateCount }
}

const cards = [
  { key: 'caseCount' as const, label: 'Cases', icon: FolderOpen },
  { key: 'criteriaCount' as const, label: 'Criteria', icon: ListChecks },
  { key: 'templateCount' as const, label: 'Templates', icon: FileStack },
]

export default async function AdminDashboardPage() {
  const counts = await getCounts()

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <card.icon className="size-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className="text-3xl font-semibold">{counts[card.key]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
