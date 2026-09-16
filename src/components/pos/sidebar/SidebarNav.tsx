'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { NavItem } from './navItems'

interface SidebarNavProps {
  visibleNavItems: NavItem[]
  activeModule: string
  activeOrderCount: number
  /** P1-15/P1-16: število offline konfliktov (CONFLICT/MANUAL_REVIEW) za badge */
  offlineReviewCount?: number
  onModuleClick: (_id: string) => void
  onModuleHover: (_id: string) => void
}

export const SidebarNav = memo(function SidebarNav({
  visibleNavItems,
  activeModule,
  activeOrderCount,
  offlineReviewCount = 0,
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
              // QA 2026-09-17 (tablet): na dotikalnih napravah 44px tarča (WCAG 2.5.5)
              'relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:py-2.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isActive
                ? item.highlight ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground active:bg-accent'
            )}
          >
            {/* Aktiven indikator — levi barvni trak (subtilen, izrazit na tablici) */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary"
              />
            )}
            <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary', item.highlight && isActive && 'text-primary-foreground')} />
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
            {/* P1-15/P1-16: offline konflikti čakajo ročni pregled — rdeč badge */}
            {item.id === 'offline-queue' && offlineReviewCount > 0 && (
              <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 animate-pulse" aria-label={`${offlineReviewCount} offline vnosov za ročni pregled`}>
                {offlineReviewCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
})
