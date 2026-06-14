'use client'

import { memo } from 'react'
import { Users } from 'lucide-react'
import type { FloorTableItemProps } from './constants'
import { statusColors, statusLabels } from './constants'

// Komponenta za posamezno mizo na tlorisu
export const FloorTableItem = memo(function FloorTableItem({
  table,
  onDragStart,
  onDragEnd: _onDragEnd,
  onDrag: _onDrag,
  onClick: _onClick,
  isDragging,
  isSelected,
  zoom: _zoom,
}: FloorTableItemProps) {
  const colors = statusColors[table.status] || statusColors.available
  const shapeClass = table.shape === 'round' ? 'rounded-full' : table.shape === 'booth' ? 'rounded-2xl' : 'rounded-lg'
  return (
    <div
      className={`absolute cursor-move touch-manipulation select-none transition-shadow ${shapeClass} ${colors.bg} border-2 ${colors.border} ${isDragging ? 'shadow-2xl z-50 opacity-90' : 'shadow-md hover:shadow-lg z-10'} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} flex flex-col items-center justify-center`}
      style={{
        left: `${table.posX}%`,
        top: `${table.posY}%`,
        width: `${table.width}%`,
        height: `${table.height}%`,
        transform: `rotate(${table.rotation}deg)`,
        minWidth: '60px',
        minHeight: '50px',
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        onDragStart(table.id, e)
      }}
      onMouseUp={_onDragEnd}
      onClick={() => _onClick(table)}
    >
      {/* Statusna pika */}
      <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${colors.dot} ${table.status === 'occupied' ? 'animate-pulse' : ''} z-20`} />
      {/* Številka mize */}
      <span className={`text-lg font-bold ${colors.text} leading-none`}>{table.number}</span>
      {/* Kapaciteta */}
      <span className={`text-[10px] ${colors.text} opacity-70 flex items-center gap-0.5`}>
        <Users className="h-2.5 w-2.5" />
        {table.capacity}
      </span>
      {/* Oznaka statusa za zasedene/rezervirane */}
      {(table.status === 'occupied' || table.status === 'reserved') && (
        <span className={`text-[8px] font-semibold ${colors.text} mt-0.5`}>
          {statusLabels[table.status]}
        </span>
      )}
    </div>
  )
})
