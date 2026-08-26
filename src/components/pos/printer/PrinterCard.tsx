'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Wifi, WifiOff, ScrollText, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { PrinterItem, PrinterStatus } from './constants'
import { typeLabels, typeBadgeClasses, getRulesSummary } from './constants'

// ============================================
// PRINTER CARD — Posamezna kartica tiskalnika
// ============================================

interface PrinterCardProps {
  printer: PrinterItem
  printerStatus: Record<string, PrinterStatus>
  onEdit: (_printer: PrinterItem) => void
  onDelete: (_id: string) => void
  onTestConnectivity: (_printer: PrinterItem) => void
  onToggleActive: (_printer: PrinterItem) => void
}

export const PrinterCard = memo(function PrinterCard({
  printer,
  printerStatus,
  onEdit,
  onDelete,
  onTestConnectivity,
  onToggleActive,
}: PrinterCardProps) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${!printer.isActive ? 'opacity-60' : ''}`}>
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
  )
})
