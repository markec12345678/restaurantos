'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Edit, ShieldAlert } from 'lucide-react'
import { EU_ALLERGENS, parseAllergens } from './constants'
import type { AllergenTableProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// MATRIKA ALERGENOV — TABELA
// ============================================

export const AllergenTable = memo(function AllergenTable({
  filteredItems,
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirToggle,
  onEditItem,
}: AllergenTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 min-w-[200px]">
                  <button
                    className="flex items-center gap-1 font-medium"
                    onClick={() => { onSortFieldChange('name'); onSortDirToggle() }}
                    aria-label="Razvrsti po imenu"
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
                    onClick={() => { onSortFieldChange('allergens'); onSortDirToggle() }}
                    aria-label="Razvrsti po številu alergenov"
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
                        <p className="text-xs text-muted-foreground">{'\u20AC'}{safeToFixed(item.price, 2)}</p>
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
                        onClick={() => onEditItem(item)}
                        aria-label={`Uredi alergene za ${item.name}`}
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
  )
})
