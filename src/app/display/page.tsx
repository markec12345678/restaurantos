'use client'

import { useEffect, useState } from 'react'

// =====================================================================
// RESTAURANTOS DISPLAY — gostovski zaslon tabla (R136-c, epic #115 P1-12)
// READ-only, guest-safe tabla aktivnih naročil za TV/presežnico.
//
// Kontekst: deep link /display?loc=<locationId> [&name=<prikazno ime>]
// (loc OBVEZEN; sessionStorage 'display-context' ohrani kontekst pri
// refreshu — vzorec kiosk-context). Manjkajoč/neveljaven loc ALI 404
// (fail-closed lokacija) → ConfigError zaslon z navodilom skrbniku.
//
// RAZLIKA od kioska: BREZ idle-reset (tabla teče nedoločeno — nasprotje
// kiosk kanonu); self-heal (reload) rešuje 5 zaporednih napak.
// i18n: hardcoded slovenščina (javna stran — kiosk kanon).
// NEXT_DYNAMIC NI potreben: stran je statičen client shell, SSR-safe
// (sessionStorage/window šele v useEffect / po mountu).
// =====================================================================

import type { DisplayContext } from './display-context'
import { resolveDisplayContext } from './display-context'
import { useDisplayBoard } from './useDisplayBoard'
import { DisplayBoard } from './DisplayBoard'
import { ConnectingScreen, ConfigErrorScreen, DisplayErrorBoundary } from './StatusScreens'

export default function DisplayPage() {
  // --- Kontekst (URL → sessionStorage), resolucija po mountu (SSR-safe) ---
  const [ctx, setCtx] = useState<DisplayContext | null>(null)
  const [ctxResolved, setCtxResolved] = useState(false)
  useEffect(() => {
    // v setTimeout(0) — da ne sproži kaskadnega re-renderja iz effect bodyja
    // (react-hooks/set-state-in-effect kanon, ist vzorec kot kiosk/page.tsx)
    const t = window.setTimeout(() => {
      setCtx(resolveDisplayContext())
      setCtxResolved(true)
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  // --- Polling tabla (10 s, seq-guard, stale-while-error, self-heal) ---
  const board = useDisplayBoard(ctx?.locationId ?? null, ctxResolved)

  // --- Render: Connecting → DisplayBoard / ConfigError ---
  if (!ctxResolved) return <ConnectingScreen />
  if (ctx === null || board.configError) return <ConfigErrorScreen />
  if (board.isLoading) return <ConnectingScreen />

  return (
    <DisplayErrorBoundary>
      <DisplayBoard
        orders={board.orders}
        timestamp={board.timestamp}
        connected={board.connected}
        locationLabel={ctx.name ?? ctx.locationId}
      />
    </DisplayErrorBoundary>
  )
}
