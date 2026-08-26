'use client'

// ─── Tabela za Menu Engineering ───────────────────────────────

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QUADRANT_COLORS, QUADRANT_LABELS, QUADRANT_ORDER, getProfitWeightClass, type TableViewProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export const TableView = memo(function TableView({ filteredItems }: TableViewProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold">Artikel</th>
                <th className="text-left p-3 font-semibold">Kategorija</th>
                <th className="text-right p-3 font-semibold">Cena</th>
                <th className="text-right p-3 font-semibold">Strosek</th>
                <th className="text-right p-3 font-semibold">Bruto %</th>
                <th className="text-right p-3 font-semibold">Prodano</th>
                <th className="text-right p-3 font-semibold">Prihodek</th>
                <th className="text-center p-3 font-semibold">Kvadrant</th>
                <th className="text-left p-3 font-semibold">Priporocilo</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems
                .sort((a, b) => QUADRANT_ORDER[a.quadrant] - QUADRANT_ORDER[b.quadrant])
                .map(item => (
                  <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-muted-foreground">{item.category}</td>
                    <td className="p-3 text-right">{'\u20AC'}{safeToFixed(item.price, 2)}</td>
                    <td className="p-3 text-right">{'\u20AC'}{safeToFixed(item.foodCost, 2)}</td>
                    <td className="p-3 text-right">
                      <span className={getProfitWeightClass(item.grossProfitPercent)}>
                        {safeToFixed(item.grossProfitPercent, 1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right">{item.quantitySold}x</td>
                    <td className="p-3 text-right font-medium">{'\u20AC'}{safeToFixed(item.revenue, 2)}</td>
                    <td className="p-3 text-center">
                      <Badge style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] + '20', color: QUADRANT_COLORS[item.quadrant] }} className="text-[10px]">
                        {QUADRANT_LABELS[item.quadrant]}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px]">
                      {item.quadrant === 'star' && 'Ohrani kakovost, promoviraj'}
                      {item.quadrant === 'puzzle' && 'Izpostavi na meniju, znisaj ceno'}
                      {item.quadrant === 'plowhorse' && 'Povisaj ceno ali zmanjsaj porcijo'}
                      {item.quadrant === 'dog' && 'Premisli o odstranitvi'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})
