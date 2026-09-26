'use client'
// ============================================
// R141-c (epic #115 P2-28) — skupni gradniki sekcij dnevnega pregleda
// (Card kanon po reorder/Dashboard vzorcu; BUG-04 BadgeChip z LITERAL
// razredi iz constants.ts lookup map; max-h-96 + custom-scrollbar po
// reorder FactorsList hišnem pravilu za dolge sezname).
// ============================================

import type { ComponentType, ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { BriefingBadgeConfig } from './constants'
import { usePOSStore } from '@/lib/store'

/** Kartica sekcije: ikona + naslov (semantični h3) + števec + opcijska akcija */
export function SectionCard({
  icon: Icon,
  title,
  count,
  action,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold leading-none">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {title}
            {typeof count === 'number' && count > 0 && (
              <Badge variant="outline" className="text-[10px]">{count}</Badge>
            )}
          </h3>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

/**
 * Badge iz BUG-04 lookup mape: celoten razred je literal (nikoli konkatenacija),
 * neznan status → UNKNOWN config (prejme ga klicatelj prek `?? `).
 */
export function BadgeChip({ cfg, className }: { cfg: BriefingBadgeConfig; className?: string }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', cfg.className, className)}>
      {cfg.label}
    </Badge>
  )
}

/** Iskreno prazno stanje sekcije (hardcoded sl, brez izmišljanja podatkov) */
export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/**
 * Dolgi seznami — max-h-96 + drsenje (hišno pravilo iz reorder FactorsList)
 * + custom-scrollbar iz globals.css.
 */
export function ScrollList({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return (
    <ul aria-label={ariaLabel} className="custom-scrollbar max-h-96 space-y-2 overflow-y-auto pr-1">
      {children}
    </ul>
  )
}

/**
 * Ikonski globoko-povezovalni gumb (setActiveModule) — vedno z aria-label
 * (dostopnost: ikona samo). Sledi Dashboard onNavigateInventory vzorcu.
 */
export function DeepLinkButton({
  moduleId,
  label,
}: {
  moduleId: string
  label: string
}) {
  const setActiveModule = usePOSStore((s) => s.setActiveModule)
  return (
    <button
      type="button"
      onClick={() => setActiveModule(moduleId)}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
