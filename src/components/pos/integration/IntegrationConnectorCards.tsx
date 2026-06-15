'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Settings2 } from 'lucide-react'
import { INTEGRATION_CONNECTORS } from '@/lib/integrations/connectors'
import { getTypeLabel } from './constants'
import type { IntegrationConnector } from '@/lib/integrations/connectors'

// ============================================
// INTEGRATION CONNECTOR CARDS — Izbor konektorja
// ============================================

interface IntegrationConnectorCardsProps {
  onSelectConnector: (_connector: IntegrationConnector) => void
}

export const IntegrationConnectorCards = memo(function IntegrationConnectorCards({
  onSelectConnector,
}: IntegrationConnectorCardsProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Izberite konektor</Label>
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {INTEGRATION_CONNECTORS.map(conn => (
          <button
            key={conn.id}
            onClick={() => onSelectConnector(conn)}
            className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <span className="text-2xl">{conn.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{conn.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{conn.description}</p>
              <Badge variant="secondary" className="text-[9px] mt-1">{getTypeLabel(conn.type)}</Badge>
            </div>
          </button>
        ))}
      </div>
      <Separator />
      <button
        onClick={() => {
          onSelectConnector(INTEGRATION_CONNECTORS[INTEGRATION_CONNECTORS.length - 1])
        }}
        className="w-full flex items-center gap-3 rounded-lg border-2 border-dashed p-3 text-left transition-colors hover:bg-muted/50"
      >
        <Settings2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">Splošen Webhook / API</p>
          <p className="text-xs text-muted-foreground">Povežite s poljubnim sistemom preko HTTP API-ja</p>
        </div>
      </button>
    </div>
  )
})
