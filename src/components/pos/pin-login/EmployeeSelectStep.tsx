'use client'

import { memo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Store } from 'lucide-react'
import { roleLabels } from '@/components/pos/employee/constants'
import { EMPLOYEE_SELECT_UNAVAILABLE } from './constants'
import type { EmployeeOption, EmployeeSelectStepProps } from './constants'

/**
 * Prevod vloge (house mapper iz modula Zaposleni). Frozen kontrakt R95-a
 * role NE jamči kot enum → neznana vloga pade nazaj na raw vrednost.
 */
export function employeeRoleLabel(role: string): string {
  return roleLabels[role] ?? role
}

// ============================================
// KORAK 1 — IZBIRA ZAPOSLENEGA (R95-b dvostopenjska prijava)
// Toast/Square standard: grid imen namesto "slepega" tipkanja PIN-a.
// Fail-open: 404/429/omrežna napaka → notice (parent nato pokaže
// single-step PIN UI) — NIKOLI ne blokiraj prijave.
// ============================================

export const EmployeeSelectStep = memo(function EmployeeSelectStep({
  employees, locationName, isLoading, isError, onEmployeeSelect, onPinOnly,
}: EmployeeSelectStepProps) {
  // A11y fokus: prvi gumb grida dobi fokus ob prikazu (mirror firstDigitRef
  // vzorca v usePinLogin — 100ms odlog, da je DOM že mountan).
  const firstEmployeeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (isLoading || isError || employees.length === 0) return
    const timer = setTimeout(() => firstEmployeeRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [isLoading, isError, employees])

  return (
    <div className="space-y-4">
      {/* Badge lokacije — uporabnik takoj ve, katero napravo/svet prijavlja */}
      {locationName && (
        <div
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
          aria-label={`Lokacija: ${locationName}`}
        >
          <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{locationName}</span>
        </div>
      )}
      {isError ? (
        /* 404/429/omrežna napaka — notice + gumb "Prijava samo s PIN-om" ostane */
        <p className="text-center text-xs text-muted-foreground" role="status">
          {EMPLOYEE_SELECT_UNAVAILABLE}
        </p>
      ) : isLoading ? (
        /* Load state: 4 skeleton vrstice v isti grid postavitvi */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      ) : (
        /* Grid zaposlenih — gumbi (ne listbox): vsak ima izrecen aria-label */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Izbira zaposlenega">
          {employees.map((emp: EmployeeOption, idx) => (
            <Button
              key={emp.id}
              ref={idx === 0 ? firstEmployeeRef : undefined}
              variant="outline"
              className="h-auto min-h-11 flex-col gap-0.5 px-2 py-2 active:scale-95 transition-transform"
              onClick={() => onEmployeeSelect({ id: emp.id, name: emp.name })}
              aria-label={`Prijava kot ${emp.name}`}
            >
              <span className="font-medium truncate max-w-full">{emp.name}</span>
              <span className="text-xs text-muted-foreground truncate max-w-full font-normal">
                {employeeRoleLabel(emp.role)}
              </span>
            </Button>
          ))}
        </div>
      )}
      {/* Ubežna pot za super-admine / NULL-lokacijske zaposlene, ki niso v gridu */}
      <div className="text-center">
        <Button
          variant="link"
          className="text-xs text-muted-foreground"
          onClick={onPinOnly}
          aria-label="Prijava samo s PIN-om"
        >
          Prijava samo s PIN-om
        </Button>
      </div>
    </div>
  )
})
