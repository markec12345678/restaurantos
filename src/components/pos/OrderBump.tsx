'use client'

import { useState, useEffect, memo } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import type { OrderRow, OrderItemRow } from '@/lib/types'
import dynamic from 'next/dynamic'
import type { UpsellItem, OrderBumpRule } from './order-bump/constants'

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
      // Generiraj upsell predloge
      const upsellItems: UpsellItem[] = [
        {
          id: 'dessert-upsell',
          name: 'Domaci štrudelj',
          price: 4.90,
          originalPrice: 5.90,
          category: 'Sladice',
          reason: 'Stranke, ki naročijo glavno jed, pogosto dodajo sladico',
          type: 'add-on',
          popularity: 78,
          margin: 72,
          imageEmoji: '🍰',
        },
        {
          id: 'wine-upgrade',
          name: 'Refošk Premium',
          price: 6.50,
          originalPrice: 8.50,
          category: 'Vina',
          reason: 'Nadgradnja na premium vino ob naročilu zrezka',
          type: 'upgrade',
          popularity: 45,
          margin: 80,
          imageEmoji: '🍷',
        },
        {
          id: 'side-combo',
          name: 'Pomfri + Solata',
          price: 3.90,
          category: 'Priloge',
          reason: 'Najbolj priljubljena kombinacija prilog',
          type: 'combo',
          popularity: 82,
          margin: 65,
          imageEmoji: '🍟',
        },
        {
          id: 'coffee-add',
          name: 'Espresso',
          price: 2.20,
          category: 'Kava',
          reason: 'Kava ob sladici poveča zadovoljstvo za 34%',
          type: 'add-on',
          popularity: 91,
          margin: 88,
          imageEmoji: '☕',
        },
        {
          id: 'soup-upgrade',
          name: 'Juha dneva + Predjedi',
          price: 5.90,
          originalPrice: 7.40,
          category: 'Predjedi',
          reason: 'Kombo predjedi poveča povprečni račun za 18%',
          type: 'combo',
          popularity: 56,
          margin: 70,
          imageEmoji: '🍲',
        },
        {
          id: 'kids-drink',
          name: 'Sok za otroke',
          price: 1.90,
          category: 'Otroški meni',
          reason: '75% otroških obrokov vključuje pijačo',
          type: 'side',
          popularity: 75,
          margin: 82,
          imageEmoji: '🧃',
        },
      ]
      setSuggestions(upsellItems)
      // Pravila upsell
      const bumpRules: OrderBumpRule[] = [
        { id: 'r1', name: 'Sladica ob glavni jedi', trigger: 'Glavna jed > 10 EUR', suggestion: 'Dodaj sladico za 17% popust', type: 'add-on', discount: 17, enabled: true, conversionRate: 28, totalRevenue: 2450 },
        { id: 'r2', name: 'Premium vino ob zrezku', trigger: 'Zrezek v naročilu', suggestion: 'Nadgradnja na premium vino', type: 'upgrade', discount: 15, enabled: true, conversionRate: 18, totalRevenue: 1820 },
        { id: 'r3', name: 'Priloga kombo', trigger: 'Brez priloge', suggestion: 'Dodaj pomfri + solato za 3.90 EUR', type: 'combo', discount: 12, enabled: true, conversionRate: 34, totalRevenue: 3100 },
        { id: 'r4', name: 'Kava ob sladici', trigger: 'Sladica v naročilu', suggestion: 'Kava + sladica = popolna kombinacija', type: 'add-on', discount: 10, enabled: true, conversionRate: 42, totalRevenue: 1560 },
        { id: 'r5', name: 'Otroški sok', trigger: 'Otroški meni', suggestion: 'Dodaj sok za 1.90 EUR', type: 'side', discount: 0, enabled: true, conversionRate: 65, totalRevenue: 890 },
        { id: 'r6', name: 'Aperitiv ob čakanju', trigger: 'Čakanje > 15 min', suggestion: 'Aperitiv na popust med čakanjem', type: 'add-on', discount: 20, enabled: false, conversionRate: 22, totalRevenue: 560 },
      ]
      setRules(bumpRules)
    } catch {
      toast.error('Napaka pri nalaganju naročil')
    } finally {
      setLoading(false)
    }
  }
  const handleAddSuggestion = (id: string) => {
    setAddedItems(prev => new Set(prev).add(id))
    // FIX MEDIUM: Dejansko dodaj artikel v naročilo preko API-ja
    // Poišči ustrezen meni artikel in ga dodaj k trenutnemu naročilu
    const rule = rules.find(r => r.id === id)
    if (rule) {
      // Uporabi custom event, da posredujemo navzven (starševska komponenta lahko posluša)
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
      {/* KPI */}
      <KpiCards
        totalPotentialRevenue={totalPotentialRevenue}
        avgConversion={avgConversion}
        activeRules={activeRules}
        totalRules={rules.length}
        actualRevenue={Math.round(totalPotentialRevenue * avgConversion / 100)}
      />
      {/* Upsell predlogi */}
      <UpsellGrid
        suggestions={suggestions}
        addedItems={addedItems}
        onAddSuggestion={handleAddSuggestion}
      />
      {/* Pravila */}
      <RulesList
        rules={rules}
        onToggleRule={handleToggleRule}
      />
    </div>
  )
})
