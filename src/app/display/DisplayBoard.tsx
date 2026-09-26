'use client'

import { memo, useEffect, useState } from 'react'
import { Armchair } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { DisplayOrder } from './types'

// =====================================================================
// Glavni zaslon display tabele (R136-c) — grid kartic aktivnih naročil.
// Responsive: 1 (mobilno) → 2 (sm) → 3 (md) → 4 (lg) → 6 (xl) stolpcev,
// gap-4 — od TV 1920 px do telefona. Dotik NI potreben (samo prikaz).
// Velika številka naročila (text-4xl/5xl font-extrabold) je berljiva na TV
// razdalji; base text-lg+ na karticah (a11y kanon briefa).
// Hardcoded slovenščina (javna stran — kiosk kanon; useI18n ne obstaja tu).
// =====================================================================

// Tip servisiranja — hardcoded preslikave (validations/orders.ts enum)
const TYPE_LABELS: Record<string, string> = {
  'dine-in': 'V lokalu',
  'takeout': 'S seboj',
  'delivery': 'Dostava',
}

function typeLabel(type: string): string {
  const label = TYPE_LABELS[type]
  return label ?? (type || '')
}

/** "oddano X min nazaj"; ≥60 min → "1 h 5 min" (pariteta order-status elapsed) */
export function formatElapsed(createdAt: string, nowMs: number): string {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return ''
  const diffMin = Math.floor((nowMs - created) / 60000)
  if (diffMin < 1) return 'oddano pravkar'
  if (diffMin < 60) return `oddano ${diffMin} min nazaj`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return m === 0 ? `oddano ${h} h nazaj` : `oddano ${h} h ${m} min nazaj`
}

function formatClock(timestamp: string | null): string {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function OrderCard({ order, nowMs }: { order: DisplayOrder; nowMs: number }) {
  const elapsed = formatElapsed(order.createdAt, nowMs)
  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-3 min-h-[180px]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 tabular-nums">
          #{order.orderNumber}
        </p>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-auto flex flex-col gap-1.5 text-lg text-gray-600">
        <p>
          {typeLabel(order.type)}
          {elapsed && <span className="text-gray-500"> · {elapsed}</span>}
        </p>
        {order.tableNumber !== null && (
          <p className="flex items-center gap-1.5 font-semibold text-gray-700">
            <Armchair className="w-5 h-5 shrink-0" aria-hidden="true" />
            Miza {order.tableNumber}
          </p>
        )}
      </div>
    </article>
  )
}

interface DisplayBoardProps {
  orders: DisplayOrder[]
  timestamp: string | null
  connected: boolean
  /** Prikazno ime lokacije (URL ?name=) ali fallback locationId */
  locationLabel: string
}

export const DisplayBoard = memo(function DisplayBoard({
  orders,
  timestamp,
  connected,
  locationLabel,
}: DisplayBoardProps) {
  // Tick vsakih 30 s → "oddano X min nazaj" ostane svež tudi brez novih
  // fetchov (vzor use-order-status; setState v timer callbacku, ne v bodyju)
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  const nowMs = Date.now()

  return (
    <div className="min-h-dvh bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900 flex flex-col">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Naročila{locationLabel ? ` — ${locationLabel}` : ''}
        </h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-2 text-base sm:text-lg font-semibold">
            <span
              aria-hidden="true"
              className={`w-3.5 h-3.5 rounded-full ${connected ? 'bg-green-500' : 'bg-transparent border-2 border-gray-400'}`}
            />
            {connected ? 'Povezano' : 'Trenutno brez povezave'}
          </span>
          <span className="text-sm sm:text-base text-gray-500 tabular-nums">
            Zadnja osvežitev: {formatClock(timestamp)}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4">
        {orders.length === 0 ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
            <span className="text-6xl mb-4" aria-hidden="true">🍽</span>
            {timestamp === null && !connected ? (
              <>
                <p className="text-2xl sm:text-3xl font-bold mb-2">Povezovanje s strežnikom…</p>
                <p className="text-lg text-gray-500">Čakam na prve podatke.</p>
              </>
            ) : (
              <>
                <p className="text-2xl sm:text-3xl font-bold mb-2">Ni aktivnih naročil</p>
                <p className="text-lg text-gray-500">Seznam se samodejno osvežuje.</p>
              </>
            )}
          </div>
        ) : (
          <ul
            aria-label="Aktivna naročila"
            aria-live="polite"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
          >
            {orders.map(o => (
              <li key={`${o.orderNumber}-${o.createdAt}`}>
                <OrderCard order={o} nowMs={nowMs} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
})
