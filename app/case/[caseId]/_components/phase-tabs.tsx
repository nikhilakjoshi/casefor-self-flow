'use client'

import { cn } from '@/lib/utils'

type Phase = 'analysis' | 'evidence'

interface PhaseTabsProps {
  activeTab: Phase
  onTabChange: (tab: Phase) => void
}

const tabs: { value: Phase; label: string }[] = [
  { value: 'analysis', label: 'Analysis' },
  { value: 'evidence', label: 'Evidence' },
]

export function PhaseTabs({ activeTab, onTabChange }: PhaseTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all',
            activeTab === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
