'use client'

// ============================================
// R129 (P1-07) — Badge statusa predloga naročila
// Barvna paleta BREZ modrih/indigo tonov (hišno pravilo):
// rdeča (kritično), amber (nizko), emerald (OK), nevtralna (pokrito z NO)
// ============================================

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReorderStatus } from './helpers'

const STATUS_STYLES: Record<ReorderStatus, { label: string; className: string }> = {
  critical: {
    label: 'Kritično',
    className: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  },
  low: {
    label: 'Nizko',
    className: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  ok: {
    label: 'Zaloga OK',
    className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  'covered-by-po': {
    label: 'Pokrito z naročilnico',
    className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
  },
}

export function StatusBadge({ status, className }: { status: ReorderStatus; className?: string }) {
  const cfg = STATUS_STYLES[status] ?? STATUS_STYLES.ok
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', cfg.className, className)}>
      {cfg.label}
    </Badge>
  )
}
