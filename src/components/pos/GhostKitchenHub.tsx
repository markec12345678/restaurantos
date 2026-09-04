// ============================================
// GHOST KITCHEN ORDER HUB — UI Dashboard
// ============================================
// Prikazuje naročila iz vseh virtualnih znamk v enem pogledu.
// Uporabno za ghost kitchene, ki upravljajo več blagovnih znamk
// iz ene same kuhinje.
//
// Funkcije:
//   - Real-time seznam aktivnih naročil (grouped by brand)
//   - Statistika: naročila na uro, povprečni čas, promet po znamki
//   - Filter po znamki, statusu, tipu (dostava/nalog)
//   - Order detail preview
// ============================================

'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Store, TrendingUp, Clock, Package, Truck,
  ChefHat, Loader2, ShoppingBag,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

// --- Tipi ---
interface VirtualBrand {
  id: string
  name: string
  code: string
  color: string
  isActive: boolean
  deliveryEnabled: boolean
  pickupEnabled: boolean
  orderPrefix: string
  _count?: { orders: number }
}

interface HubOrder {
  id: string
  orderNumber: number
  status: string
  type: string // delivery, pickup, dine_in
  total: number
  createdAt: string
  virtualBrandId: string | null
  virtualBrand?: { name: string; code: string; color: string }
  customerName?: string
}

interface BrandStat {
  brandId: string
  brandName: string
  brandCode: string
  color: string
  totalOrders: number
  activeOrders: number
  completedOrders: number
  revenue: number
  avgOrderValue: number
}

// --- Status config ---
const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Na čakanju' },
  confirmed: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Potrjeno' },
  preparing: { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'V pripravi' },
  ready: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Pripravljeno' },
  delivered: { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'Dostavljeno' },
  completed: { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'Zaključeno' },
  cancelled: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Preklicano' },
}

// --- Komponenta ---
export function GhostKitchenHub() {
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // Fetch brands
  const { data: brandsData, isLoading: brandsLoading } = useQuery<{ virtualBrands: VirtualBrand[] }>({
    queryKey: ['virtual-brands'],
    queryFn: async () => {
      const res = await fetch('/api/virtual-brands')
      if (!res.ok) throw new Error('Failed to fetch brands')
      return res.json()
    },
  })

  // Fetch recent orders (with virtualBrandId)
  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: HubOrder[] }>({
    queryKey: ['hub-orders', selectedBrand, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' })
      if (selectedBrand !== 'all') params.set('virtualBrandId', selectedBrand)
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) throw new Error('Failed to fetch orders')
      return res.json()
    },
    refetchInterval: 15_000, // Auto-refresh vsakih 15s
  })

  const brands = brandsData?.virtualBrands || []
  const orders = ordersData?.orders || []

  // Statistika po znamkah
  const brandStats = useMemo<BrandStat[]>(() => {
    if (!brands.length) return []
    return brands.map((brand) => {
      const brandOrders = orders.filter((o) => o.virtualBrandId === brand.id)
      const activeOrders = brandOrders.filter((o) =>
        ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
      )
      const completedOrders = brandOrders.filter((o) => o.status === 'completed' || o.status === 'delivered')
      const revenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)
      return {
        brandId: brand.id,
        brandName: brand.name,
        brandCode: brand.code,
        color: brand.color,
        totalOrders: brandOrders.length,
        activeOrders: activeOrders.length,
        completedOrders: completedOrders.length,
        revenue,
        avgOrderValue: completedOrders.length > 0 ? revenue / completedOrders.length : 0,
      }
    })
  }, [brands, orders])

  // Filtriraj naročila
  const filteredOrders = useMemo(() => {
    let result = orders
    if (selectedBrand !== 'all') {
      result = result.filter((o) => o.virtualBrandId === selectedBrand)
    }
    if (statusFilter === 'active') {
      result = result.filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))
    } else if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter)
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [orders, selectedBrand, statusFilter])

  // Skupna statistika
  const totalActive = orders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
  ).length
  const totalRevenue = orders
    .filter((o) => ['completed', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + (o.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            Ghost Kitchen Hub
          </h2>
          <p className="text-sm text-muted-foreground">
            Centraliziran pregled naročil iz vseh virtualnih znamk
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          title="Aktivna naročila"
          value={totalActive}
          icon={Clock}
          color="bg-blue-50 border-blue-200 text-blue-800"
        />
        <SummaryCard
          title="Skupni promet"
          value={`€${totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="bg-green-50 border-green-200 text-green-800"
        />
        <SummaryCard
          title="Aktivne znamke"
          value={brands.filter((b) => b.isActive).length}
          icon={Store}
          color="bg-purple-50 border-purple-200 text-purple-800"
        />
        <SummaryCard
          title="Naročila danes"
          value={orders.filter((o) => {
            const today = new Date()
            const created = new Date(o.createdAt)
            return created.toDateString() === today.toDateString()
          }).length}
          icon={Package}
          color="bg-orange-50 border-orange-200 text-orange-800"
        />
      </div>

      {/* Brand filter + stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {brandsLoading ? (
          <div className="col-span-full flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          brands.map((brand) => {
            const stat = brandStats.find((s) => s.brandId === brand.id)
            const isSelected = selectedBrand === brand.id
            return (
              <Card
                key={brand.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedBrand(isSelected ? 'all' : brand.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: brand.color }}
                    />
                    <span className="font-semibold text-sm truncate">{brand.name}</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Aktivna:</span>
                      <span className="font-medium text-blue-600">{stat?.activeOrders || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Promet:</span>
                      <span className="font-medium text-green-600">€{(stat?.revenue || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Povp. vrednost:</span>
                      <span className="font-medium">€{(stat?.avgOrderValue || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Status:</span>
        {['active', 'pending', 'preparing', 'ready', 'completed', 'all'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'active' ? 'Aktivna' : s === 'all' ? 'Vse' : orderStatusConfig[s]?.label || s}
          </Button>
        ))}
      </div>

      {/* Orders grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Naročila ({filteredOrders.length})
            </span>
            {selectedBrand !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedBrand('all')}>
                Počisti filter
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Ni naročil s tem filtrom
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredOrders.map((order) => {
                  const cfg = orderStatusConfig[order.status] || orderStatusConfig.pending
                  const brand = brands.find((b) => b.id === order.virtualBrandId)
                  const isDelivery = order.type === 'delivery'
                  const isPickup = order.type === 'pickup'
                  const minutesAgo = Math.floor(
                    (Date.now() - new Date(order.createdAt).getTime()) / 60000
                  )
                  return (
                    <div
                      key={order.id}
                      className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {brand && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: brand.color }}
                            />
                          )}
                          <span className="font-semibold text-sm">#{order.orderNumber}</span>
                        </div>
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {isDelivery ? <Truck className="h-3 w-3" /> : isPickup ? <Package className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                          <span>
                            {isDelivery ? 'Dostava' : isPickup ? 'Prevzem' : 'Lokal'}
                            {brand ? ` · ${brand.name}` : ''}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Znesek:</span>
                          <span className="font-semibold text-foreground">€{(order.total || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Čas:</span>
                          <span>{minutesAgo}min nazaj</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- SummaryCard podkomponenta ---
interface SummaryCardProps {
  title: string
  value: string | number
  icon: typeof Clock
  color: string
}

function SummaryCard({ title, value, icon: Icon, color }: SummaryCardProps) {
  return (
    <Card className={`border-2 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium opacity-80">{title}</span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
