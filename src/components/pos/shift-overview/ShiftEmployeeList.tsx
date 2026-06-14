'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Clock, Coffee, LogOut, Play, CheckCircle2, Users } from 'lucide-react'
import { statusConfig, shiftTypeConfig } from './constants'
import type { ShiftEmployeeListProps, ShiftEmployee } from './constants'

// Ena kartica zaposlenega
function EmployeeCard({ emp, onClockIn, onClockOut, onBreak }: {
  emp: ShiftEmployee
  onClockIn: (_id: string) => void
  onClockOut: (_id: string) => void
  onBreak: (_id: string, _onBreak: boolean) => void
}) {
  const config = statusConfig[emp.status]
  const StatusIcon = config.icon
  const shiftConf = shiftTypeConfig[emp.shiftType as keyof typeof shiftTypeConfig]
  const shiftProgress = emp.hoursWorked > 0
    ? Math.min(100, Math.round((emp.hoursWorked / (emp.hoursWorked + emp.hoursRemaining)) * 100))
    : 0

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${config.dotColor}`} aria-label={config.label} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{emp.name}</span>
              <Badge className={config.color}>
                <StatusIcon className="h-3 w-3 mr-1" /> {config.label}
              </Badge>
              <Badge variant="outline" className={`text-xs ${shiftConf?.color || ''}`}>
                {shiftConf?.label || emp.shiftType}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {emp.shiftStart} — {emp.shiftEnd}
              </span>
              <span>{emp.role}</span>
              <span>{emp.location}</span>
            </div>

            {/* Progress */}
            {emp.status === 'clocked-in' || emp.status === 'on-break' ? (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{emp.hoursWorked}h delano</span>
                  <span>{emp.hoursRemaining}h do konca</span>
                </div>
                <Progress value={shiftProgress} className="h-1.5" />
              </div>
            ) : null}

            {emp.breakStartedAt && emp.status === 'on-break' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                <Coffee className="h-3 w-3" />
                Odmor od {new Date(emp.breakStartedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                {emp.totalBreakMinutes > 0 && ` (${emp.totalBreakMinutes} min skupaj)`}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {emp.status === 'scheduled' && (
              <Button size="sm" onClick={() => onClockIn(emp.id)}>
                <Play className="h-3 w-3 mr-1" /> Prijava
              </Button>
            )}
            {emp.status === 'clocked-in' && (
              <>
                <Button size="sm" variant="outline" onClick={() => onBreak(emp.id, false)}>
                  <Coffee className="h-3 w-3 mr-1" /> Odmor
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onClockOut(emp.id)}>
                  <LogOut className="h-3 w-3 mr-1" /> Odjava
                </Button>
              </>
            )}
            {emp.status === 'on-break' && (
              <Button size="sm" onClick={() => onBreak(emp.id, true)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Konec odmora
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Seznam zaposlenih na izmeni
export const ShiftEmployeeList = memo(function ShiftEmployeeList({
  employees,
  onClockIn,
  onClockOut,
  onBreak,
}: ShiftEmployeeListProps) {
  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">Ni zaposlenih za prikaz</p>
          <p className="text-sm text-muted-foreground">Spremenite filter ali dodajte razpored</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {employees.map(emp => (
        <EmployeeCard
          key={emp.id}
          emp={emp}
          onClockIn={onClockIn}
          onClockOut={onClockOut}
          onBreak={onBreak}
        />
      ))}
    </div>
  )
})
