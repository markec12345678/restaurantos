'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KioskMenu, KioskMenuItem } from './types'

// =====================================================================
// HOOK: meni kioska — GET /api/public/kiosk?locationId=<loc> (relativen fetch)
// 404 → 'not-found' (neznana/tuja/neaktivna lokacija) → config error zaslon.
// Odgovor se NORMALIZIRA na meji (Defenzivno, ist vzorec kot qr-menu
// api-helpers): Prisma Decimal pride prek JSON kot STRING — cena/DDV se
// prisilno Number(), allergens je v DB vejica-niz ("1,3,7") → string[],
// modifierji cene Number(). Nadaljnja aritmetika je tako vedno number.
// =====================================================================

export type MenuFetchStatus = 'loading' | 'ok' | 'not-found' | 'error'

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return Number.isNaN(n) ? 0 : n
  }
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber()
  }
  return 0
}

/** Alergeni: DB shrani vejica-niz "1,3,7"; kontrakt dovoljuje tudi string[] */
function parseAllergens(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(a => String(a).trim()).filter(Boolean)
  if (typeof val === 'string') return val.split(',').map(a => a.trim()).filter(Boolean)
  return []
}

function parseStockStatus(val: unknown): KioskMenuItem['stockStatus'] {
  return val === 'low' || val === 'out' ? val : 'ok'
}

function normalizeItem(raw: unknown): KioskMenuItem | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.id !== 'string' || typeof rec.name !== 'string') return null

  const groups: KioskMenuItem['modifierGroups'] = Array.isArray(rec.modifierGroups)
    ? (rec.modifierGroups as unknown[]).flatMap(gRaw => {
        if (!gRaw || typeof gRaw !== 'object') return []
        const g = gRaw as Record<string, unknown>
        const mg = g.modifierGroup as Record<string, unknown> | undefined
        if (!mg || typeof mg.id !== 'string' || typeof mg.name !== 'string') return []
        const modifiers = Array.isArray(mg.modifiers)
          ? (mg.modifiers as unknown[]).flatMap(mRaw => {
              if (!mRaw || typeof mRaw !== 'object') return []
              const m = mRaw as Record<string, unknown>
              if (typeof m.id !== 'string' || typeof m.name !== 'string') return []
              return [{
                id: m.id,
                name: m.name,
                price: toNumber(m.price),
                allergens: parseAllergens(m.allergens),
              }]
            })
          : []
        return [{
          sortOrder: toNumber(g.sortOrder),
          modifierGroup: {
            id: mg.id,
            name: mg.name,
            required: mg.required === true,
            minSelect: typeof mg.minSelect === 'number' ? mg.minSelect : null,
            maxSelect: typeof mg.maxSelect === 'number' ? mg.maxSelect : null,
            modifiers,
          },
        }]
      })
    : []

  return {
    id: rec.id,
    name: rec.name,
    description: typeof rec.description === 'string' ? rec.description : '',
    price: toNumber(rec.price),
    vatRate: toNumber(rec.vatRate),
    allergens: parseAllergens(rec.allergens),
    image: typeof rec.image === 'string' && rec.image ? rec.image : null,
    modifierGroups: groups,
    stockStatus: parseStockStatus(rec.stockStatus),
    stockAvailable: typeof rec.stockAvailable === 'number' ? rec.stockAvailable : null,
    stockUnit: typeof rec.stockUnit === 'string' && rec.stockUnit ? rec.stockUnit : null,
  }
}

function normalizeMenus(data: unknown): KioskMenu[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).menus)) return []
  return ((data as Record<string, unknown>).menus as unknown[]).flatMap(mRaw => {
    if (!mRaw || typeof mRaw !== 'object') return []
    const m = mRaw as Record<string, unknown>
    if (typeof m.id !== 'string' || typeof m.name !== 'string') return []
    const categories = Array.isArray(m.categories)
      ? (m.categories as unknown[]).flatMap(cRaw => {
          if (!cRaw || typeof cRaw !== 'object') return []
          const c = cRaw as Record<string, unknown>
          if (typeof c.id !== 'string' || typeof c.name !== 'string') return []
          const items = Array.isArray(c.menuItems)
            ? (c.menuItems as unknown[]).flatMap(iRaw => {
                const item = normalizeItem(iRaw)
                return item ? [item] : []
              })
            : []
          return [{
            id: c.id,
            name: c.name,
            sortOrder: toNumber(c.sortOrder),
            menuItems: items,
          }]
        })
      : []
    return [{ id: m.id, name: m.name, categories }]
  })
}

export function useKioskMenu(locationId: string | null, enabled: boolean) {
  const [menus, setMenus] = useState<KioskMenu[]>([])
  const [fetchStatus, setFetchStatus] = useState<MenuFetchStatus>('loading')
  const fetchSeq = useRef(0)

  // Izpeljan status za degradirane vhode (brez setState v effect body —
  // react-hooks/set-state-in-effect kanon): enabled=false → še nalagamo,
  // brez lokacije → 404 ekvivalent (config error zaslon).
  const status: MenuFetchStatus = !enabled ? 'loading' : !locationId ? 'not-found' : fetchStatus

  // Vsi setState klici šele PO await-u (async continuation — brez kaskadnega
  // re-renderja iz effect bodyja). Med refreshom status NE utripne na
  // 'loading' (prejšnji meni/zaslon ostane viden do odgovora).
  const refreshMenu = useCallback(async (): Promise<MenuFetchStatus> => {
    const seq = ++fetchSeq.current
    if (!locationId) return 'not-found'
    try {
      // Relativen fetch (hišno pravilo) — brez absolutnih URL-jev
      const res = await fetch(`/api/public/kiosk?locationId=${encodeURIComponent(locationId)}`)
      if (seq !== fetchSeq.current) return 'ok'
      if (res.status === 404) {
        setFetchStatus('not-found')
        return 'not-found'
      }
      if (!res.ok) {
        setFetchStatus('error')
        return 'error'
      }
      const data: unknown = await res.json()
      if (seq !== fetchSeq.current) return 'ok'
      setMenus(normalizeMenus(data))
      setFetchStatus('ok')
      return 'ok'
    } catch {
      if (seq !== fetchSeq.current) return 'error'
      setFetchStatus('error')
      return 'error'
    }
  }, [locationId])

  useEffect(() => {
    if (!enabled) return
    // await znotraj async IIFE — vsi setState so v async continuation
    // (react-hooks/set-state-in-effect kanon)
    void (async () => {
      await refreshMenu()
    })()
  }, [enabled, refreshMenu])

  return { menus, status, refreshMenu }
}
