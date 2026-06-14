'use client'

import { memo } from 'react'
import { StatsCard } from '@/components/pos/StatsCard'
import { Printer, Wifi, ChefHat, Receipt } from 'lucide-react'
import type { StatsCardsProps } from './constants'

// ============================================
// POVZETEK KARTIC — STATISTIKA TISKALNIKOV
// ============================================

export const StatsCards = memo(function StatsCards({ total, active, kitchen, receipt }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatsCard
        title="Skupaj tiskalnikov"
        value={total}
        icon={Printer}
        subtitle={`${total === 1 ? 'tiskalnik' : total === 2 ? 'tiskalnika' : (total < 5 ? 'tiskalniki' : 'tiskalnikov')}`}
      />
      <StatsCard
        title="Aktivni"
        value={active}
        icon={Wifi}
        subtitle={`${active === 1 ? 'tiskalnik' : active === 2 ? 'tiskalnika' : (active < 5 ? 'tiskalniki' : 'tiskalnikov')}`}
      />
      <StatsCard
        title="Kuhinja"
        value={kitchen}
        icon={ChefHat}
        subtitle="Naročila v kuhinjo"
      />
      <StatsCard
        title="Računi"
        value={receipt}
        icon={Receipt}
        subtitle="Tiskanje računov"
      />
    </div>
  )
})
