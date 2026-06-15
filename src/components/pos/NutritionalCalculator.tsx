'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Nutritional Calculator
// EU 1169/2011 compliance — alergeni, kalorije, makrohranila
// ═══════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, ShieldCheck, Search, X, Info } from 'lucide-react'
import { memo } from 'react'
import { ALLERGEN_MAP } from './nutrition/constants'
import { NutritionalStatsCards } from './nutrition/NutritionalStatsCards'
import { NutritionalItemCard } from './nutrition/NutritionalItemCard'
import { useNutritionalCalc } from './nutrition/useNutritionalCalc'

export const NutritionalCalculator = memo(function NutritionalCalculator() {
  const {
    search, setSearch, allergenFilter, setAllergenFilter,
    filtered, stats, isLoading,
  } = useNutritionalCalc()

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-green-500" />
          Nutritivni kalkulator
        </h2>
        <p className="text-muted-foreground">EU 1169/2011 skladnost — alergeni in nutritivni podatki</p>
      </div>

      <NutritionalStatsCards total={stats.total} withAllergens={stats.withAllergens} />

      {/* Iskanje */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči jedi po imenu ali kategoriji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {allergenFilter && (
          <Button variant="outline" size="sm" onClick={() => setAllergenFilter(null)}>
            <X className="h-3 w-3 mr-1" />
            Počisti filter
          </Button>
        )}
      </div>

      {/* Alergeni filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> EU Alergeni (14 kategorij)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ALLERGEN_MAP).map(([num, cfg]) => {
              const Icon = cfg.icon
              const count = stats.allergenCounts[num] || 0
              return (
                <Badge
                  key={num}
                  className={`cursor-pointer transition-all ${cfg.color} ${allergenFilter === num ? 'ring-2 ring-offset-1 ring-purple-400' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAllergenFilter(allergenFilter === num ? null : num)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAllergenFilter(allergenFilter === num ? null : num) } }}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {num}. {cfg.label}
                  {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Jedilnik z alergeni */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.slice(0, 30).map((item) => (
          <NutritionalItemCard key={item.id} item={item} />
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <ShieldCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ni rezultatov</h3>
            <p className="text-muted-foreground">Poskusite drugačen iskalni niz ali filter</p>
          </CardContent>
        </Card>
      )}

      {/* EU compliance info */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <div className="font-semibold text-blue-700 dark:text-blue-400">EU Uredba 1169/2011</div>
              <div className="text-blue-600 dark:text-blue-300">
                Vse jedi, ki vsebujejo kateri koli od 14 EU alergenov, morajo biti ustrezno označene.
                Stranke morajo biti obveščene o prisotnosti alergenov pred naročilom.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
