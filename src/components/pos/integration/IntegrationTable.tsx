'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Pencil, Trash2, RefreshCw, Zap, Activity, Plug } from 'lucide-react'
import { getConnectorTypes } from '@/lib/integrations/connectors'
import { getConnectionStatusConfig, getTypeLabel, formatDateSI } from './constants'
import type { IntegrationTableProps } from './constants'

// ============================================
// TABELA INTEGRACIJ — Filtri in seznam
// ============================================

export const IntegrationTable = memo(function IntegrationTable({
  filteredIntegrations,
  search,
  filterType,
  onSearchChange,
  onFilterTypeChange,
  onTest,
  onSync,
  onEdit,
  onDelete,
  onAdd,
  testPending,
  syncPending,
}: IntegrationTableProps) {
  return (
    <>
      {/* Filtri */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Išči po imenu ali ponudniku..." value={search} onChange={e => onSearchChange(e.target.value)} className="pl-9" aria-label="Išči po imenu ali ponudniku" />
            </div>
            <Select value={filterType} onValueChange={onFilterTypeChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtriraj po tipu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi tipi</SelectItem>
                {getConnectorTypes().map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filteredIntegrations.length === 0 ? (
            <div className="text-center py-16">
              <Plug className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ni integracij</h3>
              <p className="text-sm text-muted-foreground mb-4">Dodajte prvo integracijo za povezavo z zunanjimi sistemi</p>
              <Button onClick={onAdd}><Plus className="h-4 w-4 mr-2" />Dodaj integracijo</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Povezava</TableHead>
                  <TableHead>Zadnja sinh.</TableHead>
                  <TableHead>Status sinh.</TableHead>
                  <TableHead className="text-right">Dejanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIntegrations.map(item => {
                  const connStatus = getConnectionStatusConfig(item.connectionStatus)
                  const ConnIcon = connStatus.icon
                  return (
                    <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <span className="font-medium text-sm">{item.name}</span>
                            <p className="text-xs text-muted-foreground">{item.provider}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{getTypeLabel(item.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${connStatus.color}`}>
                          <ConnIcon className="h-3 w-3 mr-1" />
                          {connStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateSI(item.lastSyncAt)}
                      </TableCell>
                      <TableCell>
                        {item.lastSyncStatus === 'success' ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">OK</Badge>
                        ) : item.lastSyncStatus === 'error' ? (
                          <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" title={item.lastSyncError}>Napaka</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Testiraj povezavo" className="h-7 w-7" title="Testiraj povezavo" onClick={() => onTest(item.id)} disabled={testPending}>
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Osveži" className="h-7 w-7" title="Sinhroniziraj" onClick={() => onSync(item.id)} disabled={syncPending || !item.syncEnabled}>
                            <RefreshCw className={`h-3.5 w-3.5 ${syncPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" title="Uredi" onClick={() => onEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => onDelete(item)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
})
