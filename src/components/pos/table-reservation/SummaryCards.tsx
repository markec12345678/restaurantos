'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Users, BookOpen, Timer } from 'lucide-react'
import type { SummaryCardsProps } from './constants'

// ============================================
// POVZETEK MIZ IN REZERVACIJ
// STIL R43: akcentni zgornji rob + barvna ikonska plosčica per KPI (isti
// dizajn jezik kot EOD KPI kartice iz runde 42), tabular-nums (številke ne
// poskakujejo ob osvežitvi vsakih 15 s), staggered vstopna animacija,
// hover dvig z senco. Vse spoštuje prefers-reduced-motion iz globals.css.
// ============================================

const KPI_STYLES = [
  { accent: 'border-t-emerald-500', chip: 'bg-emerald-100 dark:bg-emerald-900/40', icon: 'text-emerald-600 dark:text-emerald-400' },
  { accent: 'border-t-rose-500', chip: 'bg-rose-100 dark:bg-rose-900/40', icon: 'text-rose-600 dark:text-rose-400' },
  { accent: 'border-t-sky-500', chip: 'bg-sky-100 dark:bg-sky-900/40', icon: 'text-sky-600 dark:text-sky-400' },
  { accent: 'border-t-amber-500', chip: 'bg-amber-100 dark:bg-amber-900/40', icon: 'text-amber-600 dark:text-amber-400' },
] as const

export const SummaryCards = memo(function SummaryCards({
  availableCount,
  occupiedCount,
  reservedCount,
  pendingCount,
}: SummaryCardsProps) {
  const cards = [
    { Icon: CheckCircle, count: availableCount, label: 'Proste mize', ...KPI_STYLES[0] },
    { Icon: Users, count: occupiedCount, label: 'Zasedene mize', ...KPI_STYLES[1] },
    { Icon: BookOpen, count: reservedCount, label: 'Rezervirane', ...KPI_STYLES[2] },
    { Icon: Timer, count: pendingCount, label: 'Čakajoče rezervacije', ...KPI_STYLES[3] },
  ]
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map(({ Icon, count, label, accent, chip, icon }, i) => (
        <Card
          key={label}
          className={`border-t-2 ${accent} card-lift animate-fade-in-up`}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <CardContent className="p-3 text-center">
            <div className={`h-7 w-7 rounded-md ${chip} flex items-center justify-center mx-auto mb-1.5`}>
              <Icon className={`h-4 w-4 ${icon}`} />
            </div>
            <p className="text-xl font-bold tabular-nums leading-none">{count}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
})
