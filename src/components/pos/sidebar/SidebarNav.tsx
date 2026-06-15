'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { NavItem } from './navItems'

interface SidebarNavProps {
  visibleNavItems: NavItem[]
  activeModule: string
  activeOrderCount: number
  onModuleClick: (_id: string) => void
  onModuleHover: (_id: string) => void
}

export const SidebarNav = memo(function SidebarNav({
  visibleNavItems,
  activeModule,
  activeOrderCount,
  onModuleClick,
  onModuleHover,
}: SidebarNavProps) {
  return (
    <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto custom-scrollbar" aria-label="Glavna navigacija">
      {visibleNavItems.map((item) => {
        const Icon = item.icon
        const isActive = activeModule === item.id
        return (
          <button
            key={item.id}
            onClick={() => onModuleClick(item.id)}
            onMouseEnter={() => onModuleHover(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={t(item.labelKey)}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? item.highlight ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
            {item.id === 'orders' && activeOrderCount > 0 && (
              <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1" aria-label={`${activeOrderCount} aktivnih naročil`}>
                {activeOrderCount}
              </span>
            )}
            {item.id === 'kitchen' && activeOrderCount > 0 && (
              <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold px-1" aria-label={`${activeOrderCount} v pripravi`}>
                {activeOrderCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
})
