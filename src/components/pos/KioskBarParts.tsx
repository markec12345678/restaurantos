'use client'

import { memo } from 'react'
import { ShoppingCart, ChefHat, BarChartBig, Store, Clock } from 'lucide-react'

// ============================================
// IKONE ZA MODULE
// ============================================
export const moduleConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  orders: { label: 'Prodaja', icon: <ShoppingCart className="h-4 w-4" /> },
  kitchen: { label: 'Kuhinja', icon: <ChefHat className="h-4 w-4" /> },
  tables: { label: 'Mize', icon: <BarChartBig className="h-4 w-4" /> },
}

// ============================================
// MODULE TABS SUB-COMPONENT
// ============================================
interface ModuleTabsProps {
  activeModule: string
  onModuleChange: (_moduleId: string) => void
  allowedModules: string[]
}

export const ModuleTabs = memo(function ModuleTabs({ activeModule, onModuleChange, allowedModules }: ModuleTabsProps) {
  return (
    <div className="flex gap-0.5 ml-1">
      {allowedModules.map((moduleId) => {
        const config = moduleConfig[moduleId]
        if (!config) return null
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
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
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
