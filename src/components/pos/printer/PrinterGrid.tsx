'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Printer } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { PrinterGridProps } from './constants'

// Lazy-loaded podkomponenta
const PrinterCard = dynamic(
  () => import('./PrinterCard').then(m => ({ default: m.PrinterCard })),
  { ssr: false },
)

// ============================================
// SEZNAM TISKALNIKOV S ISKANJEM
// ============================================

export const PrinterGrid = memo(function PrinterGrid({
  printers,
  search,
  isLoading,
  printerStatus,
  onSearchChange,
  onEdit,
  onDelete,
  onTestConnectivity,
  onToggleActive,
}: PrinterGridProps) {
  // Filtriranje
  const filteredPrinters = printers.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase()) ||
    p.ipAddress.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* Iskanje */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči tiskalnike..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="text-xs">
          {filteredPrinters.length} {filteredPrinters.length === 1 ? 'zapis' : filteredPrinters.length === 2 ? 'zapisa' : (filteredPrinters.length < 5 ? 'zapisi' : 'zapisov')}
        </Badge>
      </div>

      {/* Seznam tiskalnikov */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filteredPrinters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Printer className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Ni najdenih tiskalnikov</p>
          <p className="text-sm">Kliknite &quot;Dodaj tiskalnik&quot; za ustvarjanje novega vnosa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPrinters.map(printer => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              printerStatus={printerStatus}
              onEdit={onEdit}
              onDelete={onDelete}
              onTestConnectivity={onTestConnectivity}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </>
  )
})
