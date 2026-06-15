'use client'

import { useState, useEffect, memo } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import type { OrderRow, OrderItemRow } from '@/lib/types'
import dynamic from 'next/dynamic'
import type { UpsellItem, OrderBumpRule } from './order-bump/constants'
import { DEFAULT_UPSELL_ITEMS, DEFAULT_BUMP_RULES } from './OrderBumpData'

// Lazy-loaded podkomponente
const KpiCards = dynamic(() => import('./order-bump/KpiCards').then(m => ({ default: m.KpiCards })), { ssr: false })
const UpsellGrid = dynamic(() => import('./order-bump/UpsellGrid').then(m => ({ default: m.UpsellGrid })), { ssr: false })
const RulesList = dynamic(() => import('./order-bump/RulesList').then(m => ({ default: m.RulesList })), { ssr: false })

export const OrderBump = memo(function OrderBump() {
  const [suggestions, setSuggestions] = useState<UpsellItem[]>([])
  const [rules, setRules] = useState<OrderBumpRule[]>([])
  const [_loading, setLoading] = useState(true)
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [menuRes, ordersRes] = await Promise.all([
        authFetch('/api/menu-items'),
        authFetch('/api/orders?status=completed&limit=50'),
      ])
      if (!menuRes.ok || !ordersRes.ok) throw new Error('Napaka pri nalaganju')
      const _menuData = await menuRes.json()
      const ordersData = await ordersRes.json()
      // Analiziraj pogoste kombinacije
      const pairCounts: Record<string, number> = {}
      ;(ordersData || []).forEach((order: OrderRow) => {
        const items = order.items || order.orderItems || []
        const names = items.map((i: OrderItemRow) => i.itemName || i.name || '')
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const key = [names[i], names[j]].sort().join('|||')
            pairCounts[key] = (pairCounts[key] || 0) + 1
          }
        }
      })
      setSuggestions(DEFAULT_UPSELL_ITEMS)
      setRules(DEFAULT_BUMP_RULES)
    } catch {
      toast.error('Napaka pri nalaganju naročil')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSuggestion = (id: string) => {
    setAddedItems(prev => new Set(prev).add(id))
    const rule = rules.find(r => r.id === id)
    if (rule) {
      const event = new CustomEvent('order-bump-add', {
        detail: { ruleId: id, name: rule.suggestion, type: rule.type }
      })
      window.dispatchEvent(event)
      toast.success(`Dodano: ${rule.suggestion}`)
    }
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2000)
  }

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ))
  }

  const totalPotentialRevenue = rules.filter(r => r.enabled).reduce((s, r) => s + r.totalRevenue, 0)
  const avgConversion = rules.filter(r => r.enabled).length > 0
    ? Math.round(rules.filter(r => r.enabled).reduce((s, r) => s + r.conversionRate, 0) / rules.filter(r => r.enabled).length)
    : 0
  const activeRules = rules.filter(r => r.enabled).length

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
            <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Order Bump & Upsell</h2>
            <p className="text-sm text-muted-foreground">Pametni predlogi za povečanje povprečnega računa</p>
          </div>
        </div>
      </div>
      <KpiCards
        totalPotentialRevenue={totalPotentialRevenue}
        avgConversion={avgConversion}
        activeRules={activeRules}
        totalRules={rules.length}
        actualRevenue={Math.round(totalPotentialRevenue * avgConversion / 100)}
      />
      <UpsellGrid
        suggestions={suggestions}
        addedItems={addedItems}
        onAddSuggestion={handleAddSuggestion}
      />
      <RulesList
        rules={rules}
        onToggleRule={handleToggleRule}
      />
    </div>
  )
})
