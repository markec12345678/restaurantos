'use client'

import { memo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import type { OrderKDS } from './types'
import { OrderCard } from './OrderCard'

// ─── Mrežni/seznamski pogled naročil ──────────────────────────
// Task 21: AnimatePresence exit animacija — ko kuhar bumpa naročilo,
// kartica gladko "izstopi" (opacity + scale) namesto trdega izginotja.
// useReducedMotion (WCAG 2.3.3): izklop animacij.

interface KDSOrderGridProps {
  isLoading: boolean
  orders: OrderKDS[]
  viewMode: 'grid' | 'list'
  onBump: (_orderId: string) => void
  onBumpItem: (_orderId: string, _itemId: string) => void
  getElapsed: (_d: string | null) => number
}

const exitAnim = (reduceMotion: boolean | null) =>
  reduceMotion ? { duration: 0 } : {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.18, ease: 'easeOut' as const } },
    transition: { type: 'spring' as const, stiffness: 260, damping: 26 },
  }

export const KDSOrderGrid = memo(function KDSOrderGrid({
  isLoading,
  orders,
  viewMode,
  onBump,
  onBumpItem,
  getElapsed,
}: KDSOrderGridProps) {
  const reduceMotion = useReducedMotion()
  // Razvrsti: prednostna naročila prva, nato po firedAt
  const sortedOrders = [...orders].sort((a, b) => {
    if (a.priority && !b.priority) return -1
    if (!a.priority && b.priority) return 1
    return (a.firedAt || a.createdAt).localeCompare(b.firedAt || b.createdAt)
  })

  if (isLoading) {
    return (
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <div className="w-28 h-28 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 opacity-50" />
        </div>
        <p className="text-2xl font-bold">Kuhinja je prosta</p>
        <p className="text-sm mt-2">Čakam na nova naročila...</p>
      </div>
    )
  }

  const card = (order: OrderKDS) => (
    <motion.div key={order.id} {...exitAnim(reduceMotion)} className={viewMode === 'list' ? 'w-full' : undefined}>
      <OrderCard order={order} onBump={onBump} onBumpItem={onBumpItem} getElapsed={getElapsed} />
    </motion.div>
  )

  if (viewMode === 'grid') {
    return (
      <AnimatePresence mode="popLayout">
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto h-full custom-scrollbar">
          {sortedOrders.map(card)}
        </div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence mode="popLayout">
      <div className="p-3 space-y-2 overflow-y-auto h-full custom-scrollbar">
        {sortedOrders.map(card)}
      </div>
    </AnimatePresence>
  )
})
