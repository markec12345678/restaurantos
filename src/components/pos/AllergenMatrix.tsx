'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Alergeni matrika (EU 1169/2011 standard)
// Celovit pregled alergenov po menijih
// Obvezno za EU restavracije — EU Reg. 1169/2011
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { authFetch } from '@/components/pos/PinLogin'
import {
  ShieldAlert, Search, Filter, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Edit, Save, X, Info,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'

// ─── EU 14 alergenov (EU Reg. 1169/2011) ───────────────────────
const EU_ALLERGENS = [
  { id: 'gluten', code: '1', label: 'Gluten', labelEn: 'Cereals containing gluten', icon: '🌾', description: 'Pšenica, rž, ječmen, oves, pira, kamut' },
  { id: 'crustaceans', code: '2', label: 'Rakovice', labelEn: 'Crustaceans', icon: '🦐', description: 'Raki, kozice, jastogi' },
  { id: 'eggs', code: '3', label: 'Jajca', labelEn: 'Eggs', icon: '🥚', description: 'Jajca in izdelki iz jajc' },
  { id: 'fish', code: '4', label: 'Ribe', labelEn: 'Fish', icon: '🐟', description: 'Vse vrste rib' },
  { id: 'peanuts', code: '5', label: 'Kikiriki', labelEn: 'Peanuts', icon: '🥜', description: 'Kikiriki in izdelki' },
  { id: 'soybeans', code: '6', label: 'Soja', labelEn: 'Soybeans', icon: '🫘', description: 'Soja in izdelki' },
  { id: 'milk', code: '7', label: 'Mleko', labelEn: 'Milk', icon: '🥛', description: 'Mleko in mlečni izdelki (vključno z laktozo)' },
  { id: 'nuts', code: '8', label: 'Oreški', labelEn: 'Tree nuts', icon: '🌰', description: 'Mandeljni, lešniki, orehi, indijski oreški...' },
  { id: 'celery', code: '9', label: 'Zelena', labelEn: 'Celery', icon: '🥬', description: 'Zelena in izdelki' },
  { id: 'mustard', code: '10', label: 'Gorčica', labelEn: 'Mustard', icon: '🟡', description: 'Gorčica in semena' },
  { id: 'sesame', code: '11', label: 'Sezam', labelEn: 'Sesame', icon: '⚪', description: 'Sezamova semena in izdelki' },
  { id: 'sulphites', code: '12', label: 'Sulfiti', labelEn: 'Sulphites', icon: '🧪', description: 'Žveplov dioksid (>10mg/kg)' },
  { id: 'lupin', code: '13', label: 'Volčji bob', labelEn: 'Lupin', icon: '🫘', description: 'Lupina in izdelki' },
  { id: 'molluscs', code: '14', label: 'Mehkužci', labelEn: 'Molluscs', icon: '🐚', description: 'Školjke, hobotnice, lignji' },
]

interface MenuItem {
  id: string
  name: string
  price: number
  category?: { name: string }
  allergens?: string // JSON string array
  isAvailable: boolean
}

export function AllergenMatrix() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editAllergens, setEditAllergens] = useState<string[]>([])
  const [showOnlyWithAllergens, setShowOnlyWithAllergens] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'allergens'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: ['menu-items-allergens'],
    queryFn: async () => {
      const res = await authFetch('/api/categories')
      const categories = await res.json()

      // Pridobi vse artikle iz kategorij
      const allItems: MenuItem[] = []
      for (const cat of categories) {
        if (cat.menuItems) {
          for (const item of cat.menuItems) {
            allItems.push({
              ...item,
              category: { name: cat.name },
            })
          }
        }
      }
      return allItems
    },
  })

  const updateAllergens = useMutation({
    mutationFn: async ({ itemId, allergens }: { itemId: string; allergens: string[] }) => {
      const res = await authFetch(`/api/categories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, allergens }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Alergeni posodobljeni')
      setEditItem(null)
      queryClient.invalidateQueries({ queryKey: ['menu-items-allergens'] })
    },
    onError: () => {
      toast.error('Napaka pri posodabljanju alergenov')
    },
  })

  // Parse allergens from JSON string
  const parseAllergens = (allergensStr?: string): string[] => {
    if (!allergensStr) return []
    try {
      const parsed = JSON.parse(allergensStr)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  // Filter and sort
  const filteredItems = useMemo(() => {
    let items = menuItems || []

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q))
    }

    if (categoryFilter !== 'all') {
      items = items.filter(i => i.category?.name === categoryFilter)
    }

    if (showOnlyWithAllergens) {
      items = items.filter(i => parseAllergens(i.allergens).length > 0)
    }

    items.sort((a, b) => {
      if (sortField === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      const aLen = parseAllergens(a.allergens).length
      const bLen = parseAllergens(b.allergens).length
      return sortDir === 'asc' ? aLen - bLen : bLen - aLen
    })

    return items
  }, [menuItems, searchQuery, categoryFilter, showOnlyWithAllergens, sortField, sortDir])

  // Categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>()
    ;(menuItems || []).forEach(i => { if (i.category?.name) cats.add(i.category.name) })
    return Array.from(cats).sort()
  }, [menuItems])

  // Stats
  const totalItems = menuItems?.length || 0
  const itemsWithAllergens = (menuItems || []).filter(i => parseAllergens(i.allergens).length > 0).length
  const itemsWithoutAllergens = totalItems - itemsWithAllergens

  // Most common allergens
  const allergenCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(menuItems || []).forEach(item => {
      for (const a of parseAllergens(item.allergens)) {
        counts[a] = (counts[a] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([id, count]) => ({
        ...EU_ALLERGENS.find(a => a.id === id) || { id, label: id, icon: '❓' },
        count,
      }))
  }, [menuItems])

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Matrika alergenov
        </h2>
        <p className="text-sm text-muted-foreground">
          EU Uredba 1169/2011 — Obvezno označevanje 14 alergenov v živilih
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Skupno artiklov</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Z alergeni</p>
            <p className="text-2xl font-bold text-amber-600">{itemsWithAllergens}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-300 dark:border-emerald-800">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Brez alergenov</p>
            <p className="text-2xl font-bold text-emerald-600">{itemsWithoutAllergens}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Najpogostejši alergen</p>
            {allergenCounts[0] && (
              <div className="flex items-center gap-2">
                <span className="text-lg">{allergenCounts[0].icon}</span>
                <div>
                  <p className="text-sm font-bold">{allergenCounts[0].label}</p>
                  <p className="text-[10px] text-muted-foreground">{allergenCounts[0].count} artiklov</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Najpogostejši alergeni vizualizacija */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Pogostost alergenov
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allergenCounts.map(a => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">{a.icon}</span>
                <span className="text-sm w-24 font-medium">{a.label}</span>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${(a.count / totalItems) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{a.count}x</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Išči artikel..."
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kategorija" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse kategorije</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            checked={showOnlyWithAllergens}
            onCheckedChange={setShowOnlyWithAllergens}
          />
          <span className="text-xs text-muted-foreground">Samo z alergeni</span>
        </div>
      </div>

      {/* Allergen Matrix Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 min-w-[200px]">
                    <button
                      className="flex items-center gap-1 font-medium"
                      onClick={() => { setSortField('name'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }}
                    >
                      Artikel
                      {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="text-left p-3 text-xs">Kategorija</th>
                  {EU_ALLERGENS.map(a => (
                    <th key={a.id} className="p-2 text-center" title={`${a.code}. ${a.label} (${a.labelEn})`}>
                      <span className="text-sm">{a.icon}</span>
                    </th>
                  ))}
                  <th className="p-3 text-center">
                    <button
                      className="flex items-center gap-1 font-medium"
                      onClick={() => { setSortField('allergens'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }}
                    >
                      #
                      {sortField === 'allergens' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const itemAllergens = parseAllergens(item.allergens)
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">€{item.price.toFixed(2)}</p>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{item.category?.name || '-'}</td>
                      {EU_ALLERGENS.map(a => {
                        const hasAllergen = itemAllergens.includes(a.id)
                        return (
                          <td key={a.id} className="p-2 text-center">
                            {hasAllergen ? (
                              <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto" title={`${a.code}. ${a.label}`}>
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center mx-auto" title="Brez">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="p-3 text-center">
                        <Badge variant={itemAllergens.length > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
                          {itemAllergens.length}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditItem(item)
                            setEditAllergens(itemAllergens)
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni artiklov za prikaz</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* EU Disclaimer */}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">EU Uredba 1169/2011</p>
            <p className="text-xs text-muted-foreground">
              Vse restavracije v EU morajo označevati 14 alergenov na jedilniku ali zagotoviti informacije osebju.
              Neupoštevanje je kaznivo z globo do 8.000€. Posodabljajte alergene ob vsaki spremembi recepta ali dobavitelja.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Allergens Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Alergeni: {editItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Označite vse alergene, ki jih artikel vsebuje ali lahko vsebuje (sledi).
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EU_ALLERGENS.map(a => {
                const isActive = editAllergens.includes(a.id)
                return (
                  <button
                    key={a.id}
                    className={`p-2 rounded-lg border-2 text-left transition-all ${
                      isActive
                        ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => {
                      setEditAllergens(prev =>
                        prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                      )
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{a.label}</p>
                        <p className="text-[9px] text-muted-foreground">{a.labelEn}</p>
                      </div>
                      {isActive && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              <X className="h-3 w-3 mr-1" /> Prekliči
            </Button>
            <Button
              onClick={() => {
                if (editItem) {
                  updateAllergens.mutate({ itemId: editItem.id, allergens: editAllergens })
                }
              }}
              disabled={updateAllergens.isPending}
            >
              <Save className="h-3 w-3 mr-1" /> Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
