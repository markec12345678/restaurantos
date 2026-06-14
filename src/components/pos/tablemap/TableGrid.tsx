'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Trash2, Users } from 'lucide-react'
import { type TableData, statusColors, statusDot, statusLabels, areaLabels } from './constants'

// --- Props ---

interface TableGridProps {
  isLoading: boolean
  groupedTables: Record<string, TableData[]>
  onTableClick: (_table: TableData) => void
  onEdit: (_table: TableData) => void
  onDelete: (_table: TableData) => void
}

// --- Komponenta: Mreža miz po območjih ---

export const TableGrid = memo(function TableGrid({
  isLoading,
  groupedTables,
  onTableClick,
  onEdit,
  onDelete,
}: TableGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <>
      {Object.entries(groupedTables).map(([area, areaTables]) => (
        <div key={area}>
          <h3 className="text-lg font-semibold mb-3">{areaLabels[area] || area}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {areaTables.map((table) => (
              <Card
                key={table.id}
                className={`cursor-pointer border-2 hover:shadow-md transition-all ${statusColors[table.status] || ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onTableClick(table)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTableClick(table) } }}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`h-3 w-3 rounded-full ${statusDot[table.status] || ''}`} />
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Uredi mizo"
                        className="h-6 w-6"
                        onClick={() => onEdit(table)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Izbriši mizo"
                        className="h-6 w-6 text-destructive"
                        onClick={() => onDelete(table)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{String(table.number)}</div>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {String(table.capacity)} mest
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {statusLabels[String(table.status)] || String(table.status)}
                  </Badge>
                  {table.status === 'occupied' && (
                    <p className="text-[10px] text-primary font-medium">
                      Klikni za naročila →
                    </p>
                  )}
                  {table.status === 'available' && (
                    <p className="text-[10px] text-emerald-600 font-medium">
                      Klikni za novo naročilo
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </>
  )
})
