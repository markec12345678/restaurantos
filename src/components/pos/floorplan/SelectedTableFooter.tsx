'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, RotateCw, Trash2 } from 'lucide-react'
import type { SelectedTableFooterProps } from './constants'
import { statusColors, statusLabels } from './constants'

// Noga z dejanji za izbrano mizo
export const SelectedTableFooter = memo(function SelectedTableFooter({
  tables,
  selectedTableId,
  onOpenEdit,
  onRotateTable,
  onDeleteTable,
  onDeselect,
}: SelectedTableFooterProps) {
  if (!selectedTableId) return null

  const sel = tables.find(t => t.id === selectedTableId)
  if (!sel) return null

  const colors = statusColors[sel.status] || statusColors.available

  return (
    <div className="flex-shrink-0 border-t bg-card px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Badge className={`${colors.bg} ${colors.border} ${colors.text} border`}>
          Miza {sel.number}
        </Badge>
        <span className="text-sm text-muted-foreground">{sel.capacity} mest · {statusLabels[sel.status]}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenEdit(sel)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Uredi
        </Button>
        <Button variant="outline" size="sm" onClick={() => onRotateTable(sel)}>
          <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Zavrti
        </Button>
        <Button variant="destructive" size="sm" onClick={() => { onDeleteTable(selectedTableId); onDeselect() }}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Izbriši
        </Button>
      </div>
    </div>
  )
})
