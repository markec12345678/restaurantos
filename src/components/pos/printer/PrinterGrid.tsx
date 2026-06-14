'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Printer, Pencil, Trash2, Wifi, WifiOff, ScrollText, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { PrinterGridProps } from './constants'
import { typeLabels, typeBadgeClasses, getRulesSummary } from './constants'

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
            <Card
              key={printer.id}
              className={`hover:shadow-md transition-shadow ${!printer.isActive ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Vrsta in ime */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{printer.name}</p>
                      <Badge className={typeBadgeClasses[printer.type] || ''}>
                        {typeLabels[printer.type] || printer.type}
                      </Badge>
                    </div>
                    {printer.location && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        📍 {printer.location}
                      </p>
                    )}
                  </div>
                  <Badge variant={printer.isActive ? 'default' : 'secondary'} className="text-[10px] flex-shrink-0">
                    {printer.isActive ? 'Aktiven' : 'Nedejaven'}
                  </Badge>
                </div>
                {/* IP naslov in status povezave */}
                <div className="flex items-center gap-2 text-sm">
                  {printer.ipAddress ? (
                    <>
                      {printerStatus[printer.id] === 'online' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : printerStatus[printer.id] === 'offline' ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : printerStatus[printer.id] === 'checking' ? (
                        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground">{printer.ipAddress}:9100</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Brez IP naslova</span>
                    </>
                  )}
                </div>
                {/* Pravila tiskanja */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ScrollText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {getRulesSummary(printer.printRules)}
                  </span>
                </div>
                {/* Akcije */}
                <div className="flex items-center justify-between pt-1 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={printer.isActive}
                      onCheckedChange={() => onToggleActive(printer)}
                      className="scale-90"
                    />
                    <span className="text-xs text-muted-foreground">
                      {printer.isActive ? 'Aktiven' : 'Nedejaven'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Testni tisk"
                      className="h-7 w-7"
                      title="Test povezljivosti in tisk"
                      onClick={() => onTestConnectivity(printer)}
                      disabled={!printer.isActive || !printer.ipAddress || printerStatus[printer.id] === 'checking'}
                    >
                      {printerStatus[printer.id] === 'checking' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Uredi"
                      className="h-7 w-7"
                      title="Uredi"
                      onClick={() => onEdit(printer)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Izbriši"
                      className="h-7 w-7 text-destructive"
                      title="Izbriši"
                      onClick={() => onDelete(printer.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
})
