'use client'

// ============================================
// COMMAND PALETTE (Cmd+K / Ctrl+K) — Globalna navigacija + akcije
//
// Trigger: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
//
// Funkcije:
// 1. Hitra navigacija med moduli (orders, kitchen, tables, inventory, ...)
// 2. Hitre akcije (nov naročilo, plačaj, počisti košarico, ...)
// 3. Iskanje ARTIKLOV — ime + kategorija + OPIS + alergeni (runda 33)
// 4. 🕘 Nedavno — zadnjih 5 dodanih artiklov na vrhu (Square Recents vzorec)
//
// Inspiracija: Linear, Vercel, GitHub, Raycast — vsi imajo global Cmd+K.
// ============================================

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCommandState } from 'cmdk'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { navItems } from '@/components/pos/sidebar/navItems'
import { usePOSStore } from '@/lib/store'
import { useRecentsStore } from '@/lib/recents-store'
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
  History,
  ListEnd,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
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

/** NOVO (runda 33): dinamično prazno stanje — pokaže tipano iskanje
 *  (isto vzorci kot MenuItemsGrid "Ni zadetkov za 'xyz'").
 *  FIX (E2E QA runda 33): gate na filtered.count — cmdk CommandEmpty to
 *  počne interni, naš custom renderer NE (kot je bilo v prvi verziji, se je
 *  "Ni rezultatov." prikazoval tudi nad polnim seznamom). */
function PaletteEmpty() {
  const search = useCommandState((state) => state.search)
  const count = useCommandState((state) => state.filtered.count)
  if (count > 0) return null
  return (
    <div className="py-6 text-center text-sm text-muted-foreground" role="status">
      {search ? (
        <>
          Ni zadetkov za{' '}
          <span className="font-semibold text-foreground">&quot;{search}&quot;</span>.
        </>
      ) : (
        'Ni rezultatov.'
      )}
    </div>
  )
}

/** NOVO (runda 33, E2E QA): Nedavno skupina SAMO pri praznem iskanju.
 *  cmdk sortira znotraj skupin, skupine pa ostanejo v DOM vrstnem redu —
 *  recents z šibkimi fuzzy matchi bi plavali nad relevatnejšimi zadetki
 *  v Artikli skupini. Square vzorec: recents = hitri re-add ob odprtju,
 *  iskanje = čisto po relevanci. */
function RecentsGroup({
  items,
  renderItem,
}: {
  items: MenuItemType[]
  renderItem: (item: MenuItemType, opts: { recent?: boolean }) => ReactNode
}) {
  const search = useCommandState((state) => state.search)
  if (search) return null
  return (
    <>
      <CommandGroup heading={`🕘 Nedavno (${items.length})`}>
        {items.map((item) => renderItem(item, { recent: true }))}
      </CommandGroup>
      <CommandSeparator />
    </>
  )
}

/** RUNDA 41: okno upodabljanja Artiklov (virtualizacija brez virtual lib).
 *  useCommandState mora živeti v OTROKU Command-a — zato ločena komponenta.
 *  Prazno iskanje: prvih emptyWindow artiklov + onemogočen namig vrstica
 *  ("Še N artiklov — tipkaj za iskanje") — DOM pade s ~5000 na ~600 vozlišč.
 *  Iskanje: substring po imenu/kategoriji/opisu/alergenih, okno searchWindow.
 *  Ko self-filter najde nič, skupina NI upodobljena (PaletteEmpty gate na
 *  cmdk filtered.count ostane točen — šteje samo odprte item-e). */
function ArtikliGroup({
  articles,
  renderItem,
  emptyWindow,
  searchWindow,
}: {
  articles: MenuItemType[]
  renderItem: (item: MenuItemType, opts: { recent?: boolean }) => ReactNode
  emptyWindow: number
  searchWindow: number
}) {
  const search = useCommandState((state) => state.search)
  const q = search.trim().toLowerCase()

  const matches = useMemo(() => {
    if (!q) return articles.slice(0, emptyWindow)
    const hit: MenuItemType[] = []
    for (const item of articles) {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.category?.name ?? '').toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.allergens ?? '').toLowerCase().includes(q)
      ) {
        hit.push(item)
        if (hit.length >= searchWindow) break
      }
    }
    return hit
  }, [articles, q, emptyWindow, searchWindow])

  if (q && matches.length === 0) return null // pusti PaletteEmpty govoriti

  const remaining = q ? 0 : articles.length - matches.length
  return (
    <>
      <CommandGroup
        heading={q ? `🍽️ Artikli — zadetki (${matches.length})` : `🍽️ Artikli (${articles.length})`}
      >
        {matches.map((item) => renderItem(item, {}))}
        {remaining > 0 && (
          <CommandItem
            disabled
            className="gap-2 opacity-60"
            value="__okno_namig__" // ne tekmuje s pravimi artikli
          >
            <ListEnd className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              Še <span className="font-semibold tabular-nums">{remaining}</span> artiklov — tipkaj za iskanje
            </span>
            <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl+K</kbd>
          </CommandItem>
        )}
      </CommandGroup>
      <CommandSeparator />
    </>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { setActiveModule, activeModule, setPendingItemClickId } = usePOSStore()

  // RUNDA 41: okno upodabljanja Artiklov — 437+ artiklov = 5000+ DOM vozlišč
  // (merjeno 509 cmdk-itemov / 5302 vozlišča na prod), kar upočasni odpiranje
  // na slabših tablicah. SELF-FILTER (substring po imenu/kategoriji/opisu/
  // alergenih) + okno: prazno iskanje = prvih EMPTY_WINDOW artiklov + namig,
  // iskanje = prvih SEARCH_WINDOW zadetkov. cmdk fuzzy filter ostane za
  // akcijami/moduli/recents (majhne skupine); R33 lekcija (value brez UUID,
  // keywords kanal) ostaja veljavna — substring je PREDVIDLJIVEJŠI od fuzzy.
  const EMPTY_WINDOW = 40
  const SEARCH_WINDOW = 50

  // (runda 32): artikli v paleti — deli query cache s POS gridom (isti
  // queryKey) → brez dodatnih klicev; fetch šele ob prvem odprtju (enabled).
  const { data: menuItems } = useQuery({
    queryKey: queryKeys.menuItems.all,
    enabled: open,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      const json = await res.json()
      return Array.isArray(json) ? json : (json.menuItems ?? json.items ?? [])
    },
  })

  // NOVO (runda 33): recents iz persist store-a (pos-recents-v1).
  // skipHydration: ročna rehidracija — paleta se lahko odpre neodvisno od
  // grid monta, rehydrate je idempotenten in poceni.
  const recentIds = useRecentsStore((s) => s.ids)
  useEffect(() => {
    void useRecentsStore.persist.rehydrate()
  }, [])

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

  // Artikli za paletu: samo razpoložljivi (BREZ slice-cap — cap 12 bi search
  // naredil slepega za artikle pozicionirane kasneje v meniju; cmdk filtrira
  // čez celoten seznam, ~30 itemov je za dialog zanemarljivo)
  const paletteArticles: MenuItemType[] = useMemo(() => {
    if (!Array.isArray(menuItems)) return []
    return (menuItems as MenuItemType[])
      .filter((i) => i.isAvailable !== false)
  }, [menuItems])

  // NOVO (runda 33): zadnjih 5 nedavno dodanih artiklov (Square Recents) —
  // lookup čez razpoložljive (izgubljeni/izprodani id-ji tiho spusti).
  const recentArticles: MenuItemType[] = useMemo(() => {
    if (recentIds.length === 0 || paletteArticles.length === 0) return []
    const byId = new Map(paletteArticles.map((i) => [i.id, i]))
    return recentIds
      .map((id) => byId.get(id))
      .filter((i): i is MenuItemType => Boolean(i))
      .slice(0, 5)
  }, [recentIds, paletteArticles])

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

  // NOVO (runda 33): skupen renderer za artikel (recents + glavni seznam).
  // FIX (E2E QA runda 33): value NE SME vsebovati UUID-ja — cmdk default
  // fuzzy filter seže čez value+keywords, naključne črke v ID-ju
  // (art-cmtpkdbh700ex8qy90…) so povzročile JUNK matche za gibberish
  // iskanja ("xyzabc" je zadelo 7 naključnih artiklov). Value = samo
  // human-readable besedilo; recents dobi "nedavno" priponek za unikatnost
  // (cmdk selekcija highlighta po value nizu). Opis+alergeni živijo v
  // keywords, ki jih filter enakovredno upošteva.
  const articleSearchValue = (item: MenuItemType, recent?: boolean) =>
    `${item.name} ${item.category?.name ?? ''} artikel${recent ? ' nedavno' : ''}`

  const renderArticleItem = (item: MenuItemType, opts: { recent?: boolean }) => (
    <CommandItem
      key={`${opts.recent ? 'recent' : 'art'}-${item.id}`}
      value={articleSearchValue(item, opts.recent)}
      keywords={[item.description ?? '', item.allergens ?? '']}
      onSelect={() => handleArticleSelect(item)}
      className="cursor-pointer"
    >
      {opts.recent ? (
        <History className="mr-2 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <UtensilsCrossed className="mr-2 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{item.name}</span>
        {item.description && (
          <span className="truncate text-[11px] leading-tight text-muted-foreground">
            {item.description}
          </span>
        )}
      </span>
      {item.category?.name && (
        <span className="mr-2 hidden text-xs text-muted-foreground sm:inline">{item.category.name}</span>
      )}
      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{formatEUR(item.price)}</span>
    </CommandItem>
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Išči artikel, modul ali akcijo..." />
      <CommandList>
        <PaletteEmpty />

        {/* NOVO (runda 33): Nedavno — hitri ponovni dodatek (Square Recents),
            SAMO pri praznem iskanju (glej RecentsGroup) */}
        {recentArticles.length > 0 && (
          <RecentsGroup items={recentArticles} renderItem={renderArticleItem} />
        )}

        {/* (runda 32) Artikli — ⌘K išče ime + kategorijo; (runda 33) + OPIS
            in alergene; (runda 41) okno upodabljanja — glej ArtikliGroup */}
        {paletteArticles.length > 0 && (
          <ArtikliGroup
            articles={paletteArticles}
            renderItem={renderArticleItem}
            emptyWindow={EMPTY_WINDOW}
            searchWindow={SEARCH_WINDOW}
          />
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
