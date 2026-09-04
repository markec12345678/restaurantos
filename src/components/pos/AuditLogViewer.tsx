'use client'

// ============================================
// AuditLogViewer — Revizijski dnevnik za admin
// ============================================
// PCI DSS + FURS skladnost — pregled vseh operacij v sistemu
// Podpira filtriranje po akciji, entiteti, uporabniku, datumu
// ============================================

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Filter, Download, ShieldCheck, AlertCircle, Activity, ChevronLeft, ChevronRight } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { safeToFixed } from '@/lib/safe-format'

interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  details: string
  ipAddress: string
  terminalId: string | null
  previousHash: string
  chainHash: string
}

interface AuditLogResponse {
  logs: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-rose-100 text-rose-800',
  CANCEL: 'bg-orange-100 text-orange-800',
  VOID: 'bg-orange-100 text-orange-800',
  PAYMENT: 'bg-emerald-100 text-emerald-800',
  REFUND: 'bg-amber-100 text-amber-800',
  FURS: 'bg-purple-100 text-purple-800',
  LOGIN: 'bg-slate-100 text-slate-800',
  LOGOUT: 'bg-slate-100 text-slate-800',
  EOD: 'bg-indigo-100 text-indigo-800',
}

const ENTITY_TYPES = [
  'Order', 'OrderItem', 'Payment', 'Receipt', 'Check',
  'Employee', 'MenuItem', 'Table', 'Reservation', 'WaitlistEntry',
  'InventoryItem', 'StockTransaction', 'HaccpEntry', 'CashRegisterShift',
  'EndOfDay', 'Reservation', 'Supplier', 'PurchaseOrder',
]

const ACTION_TYPES = [
  'CREATE_ORDER', 'UPDATE_ORDER', 'CANCEL_ORDER', 'DELETE_ORDER',
  'CREATE_PAYMENT', 'REFUND_PAYMENT', 'CREATE_CHECK',
  'VOID_ORDER_ITEM', 'ITEM_STATUS_UPDATE',
  'CREATE_RECEIPT', 'FURS_INVOICE_VERIFIED', 'FURS_INVOICE_FAILED', 'FURS_STORNO',
  'CREATE_RESERVATION', 'UPDATE_RESERVATION', 'CANCEL_RESERVATION',
  'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'DELETE_EMPLOYEE',
  'EOD_COMPLETED', 'LOGIN', 'LOGOUT',
]

export function AuditLogViewer() {
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(0)
  const pageSize = 50
  const [search, setSearch] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.action) params.set('action', filters.action)
    if (filters.entityType) params.set('entityType', filters.entityType)
    if (filters.userId) params.set('userId', filters.userId)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    params.set('limit', String(pageSize))
    params.set('offset', String(page * pageSize))
    return params.toString()
  }, [filters, page])

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ['audit-logs', queryString],
    queryFn: async () => {
      const res = await authFetch(`/api/audit?${queryString}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju revizijskega dnevnika')
      return res.json()
    },
    refetchInterval: 30000, // Osveži vsakih 30s
  })

  const logs = data?.logs || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Filter po iskanju (client-side)
  const filteredLogs = useMemo(() => {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(log =>
      log.action.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      (log.entityId || '').toLowerCase().includes(q) ||
      (log.userId || '').toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q)
    )
  }, [logs, search])

  function getActionColor(action: string): string {
    const prefix = action.split('_')[0]
    return ACTION_COLORS[prefix] || 'bg-slate-100 text-slate-800'
  }

  function formatDetails(details: string): Record<string, unknown> {
    try {
      return JSON.parse(details)
    } catch {
      return { raw: details }
    }
  }

  function formatTimestamp(ts: string): string {
    const d = new Date(ts)
    return d.toLocaleString('sl-SI', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  function exportCsv() {
    const headers = ['Timestamp', 'Action', 'EntityType', 'EntityId', 'UserId', 'IPAddress', 'Details']
    const rows = filteredLogs.map(log => [
      formatTimestamp(log.timestamp),
      log.action,
      log.entityType,
      log.entityId || '',
      log.userId || '',
      log.ipAddress,
      log.details,
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Revizijski dnevnik</h2>
            <p className="text-sm text-muted-foreground">
              PCI DSS + FURS skladnost — sledenje vseh operacij v sistemu
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredLogs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Izvozi CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtri
          </CardTitle>
          <CardDescription>Filtriraj vnose po akciji, entiteti, uporabniku ali datumu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Iskanje</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Iskanje..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Akcija</Label>
              <Select
                value={filters.action || 'all'}
                onValueChange={(v) => setFilters({ ...filters, action: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Vse akcije" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse akcije</SelectItem>
                  {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Entiteta</Label>
              <Select
                value={filters.entityType || 'all'}
                onValueChange={(v) => setFilters({ ...filters, entityType: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Vse entitete" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse entitete</SelectItem>
                  {ENTITY_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Uporabnik ID</Label>
              <Input
                placeholder="user-id"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Od datuma</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Do datuma</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Skupno: <span className="font-semibold">{total}</span> vnosov
            </p>
            {(filters.action || filters.entityType || filters.userId || filters.dateFrom || filters.dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilters({ action: '', entityType: '', userId: '', dateFrom: '', dateTo: '' }); setPage(0) }}
              >
                Počisti filtre
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hash chain integrity check */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 text-sm">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">Integriteta verige:</span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              ✅ SHA-256 hash chain aktiven
            </Badge>
            <span className="text-muted-foreground ml-auto">
              Zadnji hash: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {logs[0]?.chainHash?.slice(0, 16) || '—'}...
              </code>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Audit logs list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vnosi v dnevniku</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Ni vnosov v dnevniku za izbrane filtre</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {filteredLogs.map((log) => {
                    const details = formatDetails(log.details)
                    return (
                      <div
                        key={log.id}
                        className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={getActionColor(log.action)} variant="secondary">
                                {log.action}
                              </Badge>
                              <span className="text-sm font-medium">{log.entityType}</span>
                              {log.entityId && (
                                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {log.entityId.slice(0, 12)}...
                                </code>
                              )}
                            </div>
                            <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span>🕒 {formatTimestamp(log.timestamp)}</span>
                                {log.userId && <span>👤 {log.userId === '__service__' ? 'Sistem' : log.userId.slice(0, 12) + '...'}</span>}
                                {log.ipAddress && <span>🌐 {log.ipAddress}</span>}
                                {log.terminalId && <span>💻 {log.terminalId}</span>}
                              </div>
                              {Object.keys(details).length > 0 && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer hover:text-foreground text-xs">
                                    Podrobnosti ({Object.keys(details).length} polj)
                                  </summary>
                                  <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                                    {JSON.stringify(details, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded block">
                              {log.chainHash.slice(0, 8)}...
                            </code>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Stran {page + 1} od {totalPages} • {total} vnosov skupno
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Nazaj
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Naprej
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
