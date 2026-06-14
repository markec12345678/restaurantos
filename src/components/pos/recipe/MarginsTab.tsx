'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ChevronRight, AlertTriangle } from 'lucide-react'
import type { MarginItem, MarginStats } from './constants'
import { marginColor, marginBadge } from './constants'

// ============================================
// TIPI PROPS
// ============================================
interface MarginsTabProps {
  /** Iskalni niz */
  search: string
  /** Posodobi iskalni niz */
  onSearchChange: (_value: string) => void
  /** Filter po meniju */
  filterMenu: string
  /** Posodobi filter po meniju */
  onFilterMenuChange: (_value: string) => void
  /** Filtrirani podatki o maržah */
  filteredMarginData: MarginItem[]
  /** Statistika marž */
  marginStats: MarginStats | null
}

// ============================================
// STATISTIKA MARŽ
// ============================================
interface MarginStatsCardsProps {
  stats: MarginStats
}

const MarginStatsCards = memo(function MarginStatsCards({ stats }: MarginStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Povprečna marža</p>
          <p className={`text-2xl font-bold ${marginColor(stats.avgMargin)}`}>
            {stats.avgMargin.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Artikli z maržo &lt;40%</p>
          <p className="text-2xl font-bold text-red-600">{stats.below40}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Brez recepta/normativa</p>
          <p className="text-2xl font-bold text-amber-600">{stats.noRecipe}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Skupaj artiklov</p>
          <p className="text-2xl font-bold">{stats.totalItems}</p>
        </CardContent>
      </Card>
    </div>
  )
})

// ============================================
// TABELA MARŽ
// ============================================
interface MarginTableProps {
  data: MarginItem[]
}

const MarginTable = memo(function MarginTable({ data }: MarginTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold">Artikel</th>
                <th className="text-left p-3 font-semibold">Kategorija</th>
                <th className="text-right p-3 font-semibold">Prodajna cena</th>
                <th className="text-right p-3 font-semibold">Nabavni strošek</th>
                <th className="text-right p-3 font-semibold">Marža (€)</th>
                <th className="text-right p-3 font-semibold">Marža (%)</th>
                <th className="text-center p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id} className={`border-b hover:bg-accent/30 transition-colors ${!item.hasRecipe ? 'opacity-60' : ''}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.category}</td>
                  <td className="p-3 text-right font-medium">€{item.price.toFixed(2)}</td>
                  <td className="p-3 text-right text-red-600">€{item.cost.toFixed(2)}</td>
                  <td className={`p-3 text-right font-semibold ${marginColor(item.marginPct)}`}>
                    €{item.marginEur.toFixed(2)}
                  </td>
                  <td className={`p-3 text-right font-bold ${marginColor(item.marginPct)}`}>
                    {item.cost > 0 ? `${item.marginPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="p-3 text-center">
                    {item.cost > 0 ? (
                      <Badge className={`text-[10px] ${marginBadge(item.marginPct)}`}>
                        {item.marginPct >= 60 ? 'Odlična' : item.marginPct >= 40 ? 'Zadostna' : 'Nizka'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Brez podatka
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">Ni najdenih artiklov</p>
        )}
      </CardContent>
    </Card>
  )
})

// ============================================
// LEGENDA
// ============================================
const MarginLegend = memo(function MarginLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500"><span className="sr-only">Visoka marža</span></span> Odlična marža (≥60%)</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500"><span className="sr-only">Srednja marža</span></span> Zadostna marža (40-60%)</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500"><span className="sr-only">Nizka marža</span></span> Nizka marža (&lt;40%)</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-300"><span className="sr-only">Brez podatka</span></span> Brez podatka</span>
    </div>
  )
})

// ============================================
// GLAVNI TAB: PREGLED MARŽ
// ============================================
export const MarginsTab = memo(function MarginsTab({
  search,
  onSearchChange,
  filterMenu,
  onFilterMenuChange,
  filteredMarginData,
  marginStats,
}: MarginsTabProps) {
  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči artikle..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Išči artikle"
          />
        </div>
        <Select value={filterMenu} onValueChange={onFilterMenuChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse kategorije</SelectItem>
            <SelectItem value="Hrana">Hrana</SelectItem>
            <SelectItem value="Pijača">Pijača</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Statistika */}
      {marginStats && <MarginStatsCards stats={marginStats} />}

      {/* Tabela marž */}
      <MarginTable data={filteredMarginData} />

      {/* Legenda */}
      <MarginLegend />
    </div>
  )
})
