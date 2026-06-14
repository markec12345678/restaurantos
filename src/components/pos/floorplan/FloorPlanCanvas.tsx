'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, LayoutGrid } from 'lucide-react'
import type { FloorPlanCanvasProps } from './constants'
import { areaLabels, statusLabels } from './constants'
import { FloorTableItem } from './FloorTableItem'

// Platno tlorisa z mrežo, oznakami območij in mizami
export const FloorPlanCanvas = memo(function FloorPlanCanvas({
  tables,
  isLoading,
  dragState,
  selectedTableId,
  zoom,
  groupedByArea,
  containerRef,
  onDragStart,
  onDragEnd,
  onDrag,
  onTableClick,
  onOpenCreate,
}: FloorPlanCanvasProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div
        ref={containerRef}
        className="relative w-full bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-xl min-h-[500px]"
        style={{ aspectRatio: '16/10' }}
      >
        {/* Mrežne črte za poravnavo */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(10)].map((_, i) => (
            <div key={`v${i}`} className="absolute top-0 bottom-0 border-r border-muted-foreground" style={{ left: `${(i + 1) * 10}%` }} />
          ))}
          {[...Array(10)].map((_, i) => (
            <div key={`h${i}`} className="absolute left-0 right-0 border-b border-muted-foreground" style={{ top: `${(i + 1) * 10}%` }} />
          ))}
        </div>
        {/* Oznake območij */}
        {Object.entries(groupedByArea).map(([area, areaTables]) => {
          if (areaTables.length === 0) return null
          const minX = Math.min(...areaTables.map(t => t.posX))
          const minY = Math.min(...areaTables.map(t => t.posY))
          return (
            <div
              key={area}
              className="absolute text-xs font-semibold text-muted-foreground/40 pointer-events-none z-0"
              style={{ left: `${minX}%`, top: `${Math.max(0, minY - 3)}%` }}
            >
              {areaLabels[area] || area}
            </div>
          )
        })}
        {/* Mize */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <LayoutGrid className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium">Tloris je prazen</p>
              <p className="text-sm">Dodajte mize in jih razporedite z vlečenjem</p>
            </div>
            <Button onClick={onOpenCreate}><Plus className="h-4 w-4 mr-2" />Dodaj prvo mizo</Button>
          </div>
        ) : (
          tables.map(table => (
            <TooltipProvider key={table.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <FloorTableItem
                      table={table}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDrag={onDrag}
                      onClick={onTableClick}
                      isDragging={dragState?.id === table.id}
                      isSelected={selectedTableId === table.id}
                      zoom={zoom}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-bold">Miza {table.number}</p>
                    <p>{table.capacity} mest · {statusLabels[table.status]}</p>
                    <p className="text-muted-foreground">{areaLabels[table.area] || table.area} · {table.shape}</p>
                    <p className="text-muted-foreground mt-1">Kliknite za urejanje · Povlecite za premik</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))
        )}
      </div>
    </div>
  )
})
