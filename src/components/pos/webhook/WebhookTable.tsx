'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Plus, Send, Pencil, Trash2, Activity, Webhook, XCircle } from 'lucide-react'
import type { WebhookTableProps } from './constants'
import { getEventConfig, formatDateSI, parseEvents } from './constants'

// ============================================
// TABELA SPLETNIH KLJUK S FILTRI
// ============================================

export const WebhookTable = memo(function WebhookTable({
  filteredWebhooks,
  search,
  showInactive,
  onSearchChange,
  onShowInactiveChange,
  onTest,
  onEdit,
  onDelete,
  onAdd,
}: WebhookTableProps) {
  return (
    <>
      {/* Filtri */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Išči po imenu ali URL-ju..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={showInactive} onCheckedChange={onShowInactiveChange} />
              <Label className="text-sm text-muted-foreground">Prikaži nedejavne</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filteredWebhooks.length === 0 ? (
            <div className="text-center py-16">
              <Webhook className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ni spletnih kljuk</h3>
              <p className="text-sm text-muted-foreground mb-4">Ustvarite prvo spletno kljuko za začetek integracij</p>
              <Button onClick={onAdd}><Plus className="h-4 w-4 mr-2" />Dodaj webhook</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Dogodki</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nazadnje sproženo</TableHead>
                  <TableHead>Napake</TableHead>
                  <TableHead className="text-right">Dejanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebhooks.map(item => {
                  const parsedEvents = parseEvents(item.events)
                  return (
                    <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground max-w-48 truncate block">{item.url}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parsedEvents.slice(0, 3).map(ev => {
                            const cfg = getEventConfig(ev)
                            return (
                              <Badge key={ev} className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                            )
                          })}
                          {parsedEvents.length > 3 && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">+{parsedEvents.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.isActive ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Aktiven</Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">Nedejaven</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateSI(item.lastTriggered)}
                      </TableCell>
                      <TableCell>
                        {item.failureCount > 0 ? (
                          <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3 w-3 mr-1" />
                            {item.failureCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Pošlji" className="h-7 w-7" title="Testiraj" onClick={() => onTest(item)}>
                            <Send className="h-3.5 w-3.5" />
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
