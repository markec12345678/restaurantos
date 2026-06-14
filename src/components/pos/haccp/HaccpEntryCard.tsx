'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2, AlertTriangle, ShieldCheck, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { categoryConfig, statusConfig, statusBadgeStyles } from './constants'
import { formatDateSI } from './utils'
import type { HaccpEntry } from './types'

interface HaccpEntryCardProps {
  entry: HaccpEntry
  isExpanded: boolean
  onToggle: () => void
  onEdit: (_entry: HaccpEntry) => void
  onDelete: (_entry: HaccpEntry) => void
}

export const HaccpEntryCard = memo(function HaccpEntryCard({
  entry,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: HaccpEntryCardProps) {
  const status = statusConfig[entry.status] || statusConfig.ok
  const category = categoryConfig[entry.category] || categoryConfig.temperature
  const CategoryIcon = category.icon
  const needsAction = entry.status === 'warning' || entry.status === 'critical'

  return (
    <Card className={`hover:shadow-md transition-shadow border-l-4 ${status.borderColor}`}>
      <CardContent className="p-4 space-y-3">
        {/* Glava: ikona, naslov, status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status.bgColor} ${status.color} flex-shrink-0 mt-0.5`}>
              <CategoryIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{entry.title}</p>
                <div className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${status.dotColor}`} aria-hidden="true" />
                  <Badge className={`text-[10px] px-1.5 py-0 ${statusBadgeStyles[entry.status] || ''}`}>
                    {status.label}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {category.label}
                </Badge>
                {entry.value && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {entry.value}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" title="Uredi" onClick={() => onEdit(entry)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => onDelete(entry)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Opis (če obstaja) */}
        {entry.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
        )}

        {/* Korektivni ukrep - poudarjen pri warning/critical */}
        {needsAction && entry.correctiveAction && (
          <div className={`rounded-lg p-3 ${status.bgColor} border ${status.borderColor}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className={`h-3.5 w-3.5 ${status.color}`} />
              <span className={`text-xs font-semibold ${status.color}`}>Korektivni ukrep</span>
            </div>
            <p className={`text-xs ${status.color}`}>{entry.correctiveAction}</p>
          </div>
        )}

        {/* Opozorilo, če manjka korektivni ukrep pri warning/critical */}
        {needsAction && !entry.correctiveAction && (
          <div className="rounded-lg p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" role="alert">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                Potreben korektivni ukrep!
              </span>
            </div>
          </div>
        )}

        {/* Noga: datum, zaposleni */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{formatDateSI(entry.date)}</span>
          </div>
          {entry.employeeName && (
            <span className="truncate ml-2">{entry.employeeName}</span>
          )}
        </div>

        {/* Razširjeni del: podrobnosti */}
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-primary w-full hover:underline"
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {isExpanded ? 'Skrij podrobnosti' : 'Prikaži podrobnosti'}
        </button>
        {isExpanded && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
            {entry.description && (
              <div>
                <span className="font-semibold text-muted-foreground">Opis:</span>
                <p className="mt-0.5">{entry.description}</p>
              </div>
            )}
            {entry.value && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meritev/Vrednost:</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            )}
            {entry.correctiveAction && (
              <div>
                <span className="font-semibold text-muted-foreground">Korektivni ukrep:</span>
                <p className="mt-0.5">{entry.correctiveAction}</p>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-muted-foreground">
              <span>Ustvarjeno: {formatDateSI(entry.createdAt)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Posodobljeno: {formatDateSI(entry.updatedAt)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
