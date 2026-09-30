'use client'

import { memo } from 'react'
import { Store, Clock } from 'lucide-react'
// IA runda R174 (epic #144 P0 korak 4): moduleConfig divergenca odstranjena —
// tabi berijo metadata iz centralnega registra (§6) + i18n labelKey.
// Prej: hardcoded 3-vnosna mapa (orders/kitchen/tables, SL labele) — 2. vir
// resnice, ki ni sledil ni registerju ni jezikom.
import { getModuleMeta } from '@/lib/modules/registry'
import { NAV_ICONS } from '@/components/pos/sidebar/navItems'
import { useI18n } from '@/hooks/useI18n'

// ============================================
// MODULE TABS SUB-COMPONENT
// ============================================
interface ModuleTabsProps {
  activeModule: string
  onModuleChange: (_moduleId: string) => void
  // R153: readonly — page.tsx poda resolveAllowedModules (readonly tuple)
  allowedModules: readonly string[]
}

export const ModuleTabs = memo(function ModuleTabs({ activeModule, onModuleChange, allowedModules }: ModuleTabsProps) {
  // R154 (#44): reaktiven t prek useI18n hooka (locale iz zustand store-a)
  const { t } = useI18n()
  return (
    <div className="flex gap-0.5 ml-1">
      {allowedModules.map((moduleId) => {
        // §6 (R174): metadata iz registerja; neznani modul → tiho spusti
        // (isti kontrakt kot prejšnji moduleConfig lookup miss)
        const meta = getModuleMeta(moduleId)
        if (!meta) return null
        const Icon = NAV_ICONS[meta.icon]
        if (!Icon) return null
        const isActive = activeModule === moduleId
        return (
          <button
            key={moduleId}
            onClick={() => onModuleChange(moduleId)}
            className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-semibold transition-colors touch-manipulation ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(meta.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
})

// ============================================
// KIOSK CLOCK SUB-COMPONENT
// ============================================
interface KioskClockProps {
  currentTime: string
}

export const KioskClock = memo(function KioskClock({ currentTime }: KioskClockProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>{currentTime}</span>
    </div>
  )
})

// ============================================
// KIOSK BRAND SUB-COMPONENT
// ============================================
export const KioskBrand = memo(function KioskBrand() {
  return (
    <div className="flex items-center gap-1.5 mr-2">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
        <Store className="h-3.5 w-3.5" />
      </div>
      <span className="text-xs font-bold hidden sm:inline">RestaurantOS</span>
    </div>
  )
})
