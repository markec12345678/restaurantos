'use client'

// ============================================
// COMMAND PALETTE (Cmd+K / Ctrl+K) — Globalna navigacija + akcije
//
// Trigger: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
//
// Funkcije:
// 1. Hitra navigacija med moduli (orders, kitchen, tables, inventory, ...)
// 2. Hitre akcije (nov naročilo, plačaj, počisti košarico, ...)
// 3. Iskanje po modulih (fuzzy)
//
// Inspiracija: Linear, Vercel, GitHub, Raycast — vsi imajo global Cmd+K.
// ============================================

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { navItems } from '@/components/pos/sidebar/navItems'
import { usePOSStore } from '@/lib/store'
import { haptic } from '@/lib/haptic'
import { t } from '@/lib/i18n'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { formatEUR } from '@/lib/safe-format'
import {
  Search,
  Plus,
  LayoutDashboard,
  Settings,
  UtensilsCrossed,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { MenuItemType } from '@/components/pos/order/types'

type IconType = ComponentType<{ className?: string }>

interface CommandAction {
  id: string
  label: string
  icon: IconType
  shortcut?: string
  action: () => void
  group: 'actions'
}

interface CommandNav {
  id: string
  label: string
  icon: IconType
  moduleId: string
  group: 'navigation'
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { setActiveModule, activeModule, setPendingItemClickId } = usePOSStore()

  // NOVO (runda 32): artikli v paleti — ⌘K napoveduje "Išči artikel" in TAUTI
  // obljubi. Deli query cache s POS gridom (isti queryKey) → brez dodatnih
  // klicev; fetch šele ob prvem odprtju (enabled: open).
  const { data: menuItems } = useQuery({
    queryKey: queryKeys.menuItems.all,
    enabled: open,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      const json = await res.json()
      return Array.isArray(json) ? json : (json.menuItems ?? json.items ?? [])
    },
  })

  // Registriraj globalni keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K (Mac) / Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Ne odpri če je trenutno v input polju (shortcut konflikt — npr. iskanje artiklov)
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return // Pusti originalni Ctrl+K za iskanje artiklov (ShortcutsDialog)
        }
        setOpen((prev) => !prev)
        haptic('light')
      }
      // Esc zapre
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Akcije
  const actions: CommandAction[] = [
    {
      id: 'new-order',
      label: 'Novo naročilo',
      icon: Plus,
      shortcut: 'F2',
      action: () => {
        setActiveModule('orders')
        haptic('medium')
        setOpen(false)
      },
      group: 'actions',
    },
    {
      id: 'go-dashboard',
      label: 'Pojdi na Dashboard',
      icon: LayoutDashboard,
      action: () => {
        setActiveModule('dashboard')
        haptic('light')
        setOpen(false)
      },
      group: 'actions',
    },
    {
      id: 'go-settings',
      label: 'Pojdi na Nastavitve',
      icon: Settings,
      action: () => {
        setActiveModule('settings')
        haptic('light')
        setOpen(false)
      },
      group: 'actions',
    },
  ]

  // Navigacijski elementi iz navItems
  const navCommands: CommandNav[] = navItems
    .filter((item) => item.id !== activeModule) // skrij trenutni
    .map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      icon: item.icon,
      moduleId: item.id,
      group: 'navigation' as const,
    }))

  // Artikli za paletu: samo razpoložljivi, kap 12 (perf — cmdk render)
  const paletteArticles: MenuItemType[] = useMemo(() => {
    if (!Array.isArray(menuItems)) return []
    return (menuItems as MenuItemType[])
      .filter((i) => i.isAvailable !== false)
      .slice(0, 12)
  }, [menuItems])

  // NOVO (runda 32): izbira artikla v paleti = IDENTIČNA pot kot klik na
  // kartico (modifier dialog ali direkten dodatek) prek pendingItemClickId
  // signala, ki ga MenuBrowser prevzame ko je Prodaja vidna.
  const handleArticleSelect = (item: MenuItemType) => {
    setActiveModule('orders')
    setPendingItemClickId(item.id)
    haptic('light')
    setOpen(false)
  }

  const handleSelect = (cmd: CommandAction | CommandNav) => {
    if ('action' in cmd) {
      cmd.action()
    } else {
      setActiveModule(cmd.moduleId)
      haptic('light')
      setOpen(false)
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Išči artikel, modul ali akcijo..." />
      <CommandList>
        <CommandEmpty>Ni najdenih rezultatov.</CommandEmpty>

        {/* NOVO (runda 32): Artikli — ⌘K zdaj RES išče artikle */}
        {paletteArticles.length > 0 && (
          <>
            <CommandGroup heading="🍽️ Artikli — tapni za dodajanje">
              {paletteArticles.map((item) => (
                <CommandItem
                  key={`art-${item.id}`}
                  value={`${item.name} ${item.category?.name ?? ''} artikel`}
                  onSelect={() => handleArticleSelect(item)}
                  className="cursor-pointer"
                >
                  <UtensilsCrossed className="mr-2 h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.category?.name && (
                    <span className="mr-2 hidden text-xs text-muted-foreground sm:inline">{item.category.name}</span>
                  )}
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">{formatEUR(item.price)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="⚡ Hitre akcije">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={action.label}
              onSelect={() => handleSelect(action)}
              className="cursor-pointer"
            >
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
              {action.shortcut && (
                <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {action.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="🧭 Moduli">
          {navCommands.map((nav) => (
            <CommandItem
              key={nav.id}
              value={nav.label}
              onSelect={() => handleSelect(nav)}
              className="cursor-pointer"
            >
              <nav.icon className="mr-2 h-4 w-4" />
              <span>{nav.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="💡 Nasvet">
          <CommandItem disabled className="opacity-60">
            <Search className="mr-2 h-4 w-4" />
            <span>Pritisni Esc za zapiranje • Cmd+K za ponovno odpiranje</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
