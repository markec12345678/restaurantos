'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import { marginColor, marginBadge } from './constants'
import type { MarginItem } from './constants'

interface MarginTableProps {
  data: MarginItem[]
}

export const MarginTable = memo(function MarginTable({ data }: MarginTableProps) {
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
