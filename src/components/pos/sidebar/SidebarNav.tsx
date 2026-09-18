'use client'

import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { ChevronDown } from 'lucide-react'
import type { NavItem } from './navItems'
import { navGroups } from './navItems'

interface SidebarNavProps {
  visibleNavItems: NavItem[]
  activeModule: string
  activeOrderCount: number
  /** P1-15/P1-16: število offline konfliktov (CONFLICT/MANUAL_REVIEW) za badge */
  offlineReviewCount?: number
  onModuleClick: (_id: string) => void
  onModuleHover: (_id: string) => void
}

const GROUPS_STORAGE_KEY = 'pos-sidebar-groups'

/** QA runda 5 (styling): privzeto so odprte sekcije, ki vsebujejo aktivni
    modul + "Prodaja" (domači pogled natakarja). Ostale so zložene — 69
    elementov v enem seznamu je bilo preveliko vizualno breme na tablici. */
function defaultExpandedGroups(activeModule: string): string[] {
  const activeGroup = navGroups.find(g => g.itemIds.includes(activeModule))?.id
  return Array.from(new Set(['sales', ...(activeGroup ? [activeGroup] : [])]))
}

export const SidebarNav = memo(function SidebarNav({
  visibleNavItems,
  activeModule,
  activeOrderCount,
  offlineReviewCount = 0,
  onModuleClick,
  onModuleHover,
}: SidebarNavProps) {
  // Komponenta je dynamic({ ssr: false }) → localStorage je varno berljiv
  // že v lazy initializerju (brez hidracijskega nesoglasja).
  const [expanded, setExpanded] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(GROUPS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(g => navGroups.some(gr => gr.id === g))
          if (valid.length > 0) return valid
        }
      }
    } catch { /* localStorage ni na voljo */ }
    return defaultExpandedGroups('orders')
  })

  // "Prilagodi stanje med renderjanjem" (React pattern namesto setState-v-effectu):
  // ko uporabnik zamenja modul, zagotovi da je njegova sekcija odprta.
  const [prevActiveModule, setPrevActiveModule] = useState(activeModule)
  if (prevActiveModule !== activeModule) {
    setPrevActiveModule(activeModule)
    const activeGroup = navGroups.find(g => g.itemIds.includes(activeModule))?.id
    if (activeGroup && !expanded.includes(activeGroup)) {
      setExpanded([...expanded, activeGroup])
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpanded(prev => {
      const next = prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
      try { localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Grupiraj vidne elemente; elementi brez skupine gredo v "razno" na konec
  const grouped = useMemo(() => {
    const byId = new Map(visibleNavItems.map(i => [i.id, i]))
    const sections = navGroups
      .map(g => ({ group: g, items: g.itemIds.map(id => byId.get(id)).filter((x): x is NavItem => !!x) }))
      .filter(s => s.items.length > 0)
    const assigned = new Set(sections.flatMap(s => s.group.itemIds))
    const rest = visibleNavItems.filter(i => !assigned.has(i.id))
    return { sections, rest }
  }, [visibleNavItems])

  const renderItem = (item: NavItem) => {
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
          <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1" title={`${activeOrderCount} aktivnih naročil (čakajoča + v pripravi)`} aria-label={`${activeOrderCount} aktivnih naročil`}>
            {activeOrderCount}
          </span>
        )}
        {item.id === 'kitchen' && activeOrderCount > 0 && (
          <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold px-1" title={`${activeOrderCount} naročil v pripravi v kuhinji`} aria-label={`${activeOrderCount} v pripravi`}>
            {activeOrderCount}
          </span>
        )}
        {/* P1-15/P1-16: offline konflikti čakajo ročni pregled — rdeč badge */}
        {item.id === 'offline-queue' && offlineReviewCount > 0 && (
          <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 animate-pulse" title={`${offlineReviewCount} offline vnosov čaka ročni pregled (konflikti)`} aria-label={`${offlineReviewCount} offline vnosov za ročni pregled`}>
            {offlineReviewCount}
          </span>
        )}
      </button>
    )
  }

  const renderGroupHeader = (groupId: string, label: string, count: number) => {
    const isOpen = expanded.includes(groupId)
    return (
      <button
        key={`header-${groupId}`}
        onClick={() => toggleGroup(groupId)}
        aria-expanded={isOpen}
        aria-controls={`nav-group-${groupId}`}
        className="flex w-full items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn('h-3 w-3 shrink-0 transition-transform duration-200', !isOpen && '-rotate-90')}
        />
        {label}
        <span className="ml-auto text-[9px] font-semibold text-muted-foreground/60 tabular-nums" aria-hidden="true">{count}</span>
      </button>
    )
  }

  return (
    <nav className="flex-1 px-2 pb-3 overflow-y-auto custom-scrollbar" aria-label="Glavna navigacija">
      {grouped.sections.map(({ group, items }) => (
        <div key={group.id}>
          {renderGroupHeader(group.id, group.label, items.length)}
          {expanded.includes(group.id) && (
            <div id={`nav-group-${group.id}`} className="space-y-0.5 pl-1.5">
              {items.map(renderItem)}
            </div>
          )}
        </div>
      ))}
      {grouped.rest.length > 0 && (
        <div className="space-y-0.5 pt-2">{grouped.rest.map(renderItem)}</div>
      )}
    </nav>
  )
})
