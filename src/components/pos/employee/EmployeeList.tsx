'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Search } from 'lucide-react'
import { format } from 'date-fns'
import { roleColors, roleLabels } from './constants'
import type { EmployeeListProps } from './constants'

// ============================================
// SEZNAM ZAPOSLENIH — Iskanje, filtri, kartice in izmene
// ============================================

// R157-b: inicialki avatara — prva črka imena + priimka (čista vizualna
// derivacija iz obstoječega imena, nič API)
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}

export const EmployeeList = memo(function EmployeeList({
  employees,
  isLoading,
  search,
  filterRole,
  onSearchChange,
  onFilterRoleChange,
  onEdit,
  onToggleStatus,
  onDelete,
  shifts,
}: EmployeeListProps) {
  return (
    <>
      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Išči zaposlene..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" aria-label="Išči zaposlene" />
        </div>
        <Select value={filterRole} onValueChange={onFilterRoleChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vse vloge" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse vloge</SelectItem>
            <SelectItem value="admin">Skrbnik</SelectItem>
            <SelectItem value="manager">Vodja</SelectItem>
            <SelectItem value="staff">Osebje</SelectItem>
            <SelectItem value="chef">Kuhar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {employees.map((emp: Record<string, unknown>) => (
            <Card key={emp.id as string} className={`hover:shadow-md transition-shadow ${emp.status === 'inactive' ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* R157-b: avatar z inicialkami (nevtralen krog, konvencija MenuItemsGrid) */}
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {initialsOf(String(emp.name))}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{String(emp.name)}</p>
                      <p className="text-sm text-muted-foreground truncate">{String(emp.email)}</p>
                    </div>
                  </div>
                  <Badge className={`shrink-0 ${roleColors[String(emp.role)] || ''}`}>{roleLabels[String(emp.role)] || String(emp.role)}</Badge>
                </div>

                <div className="text-sm space-y-1">
                  {Boolean(emp.phone) && <p className="text-muted-foreground">📞 {String(emp.phone)}</p>}
                  <p className="text-muted-foreground">📅 Zaposlen: {emp.hireDate ? format(new Date(emp.hireDate as string), 'MMM dd, yyyy') : 'N/A'}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={emp.status === 'active'}
                      onCheckedChange={() => onToggleStatus(emp)}
                    />
                    <span className="text-xs text-muted-foreground">{emp.status === 'active' ? 'aktiven' : 'neaktiven'}</span>
                  </div>
                  {/* R157-b: večji razmik + 44px tarče na dotik (pointer-coarse kanon) */}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11" onClick={() => onEdit(emp)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive pointer-coarse:h-11 pointer-coarse:w-11" onClick={() => onDelete(emp)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {employees.length === 0 && !isLoading && (
        <p className="text-center py-12 text-muted-foreground">Ni najdenih zaposlenih</p>
      )}

      {/* Shifts Section */}
      {shifts && shifts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Prihajajoče izmene</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {shifts.slice(0, 12).map((shift: Record<string, unknown>) => (
              <div key={shift.id as string} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="text-sm font-medium">{String((shift.employee as Record<string, unknown>)?.name || 'Neznano')}</p>
                  <p className="text-xs text-muted-foreground">
                    {shift.date ? format(new Date(shift.date as string), 'EEE, MMM dd') : 'N/A'} · {String(shift.startTime)}-{String(shift.endTime)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{String(shift.status)}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
})
