'use client'
import { usePOSStore } from '@/lib/store'
import { resolveAllowedModules } from '@/lib/sales-mode'
import { useState, useEffect, useCallback, memo } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KioskPinDialog } from './KioskPinDialog'
import { ModuleTabs, KioskClock, KioskBrand } from './KioskBarParts'

// ============================================
// KIOSK BAR KOMPONENTA
// R153: servi tudi prodajni način (sank) — allowedModules prop določa nabor
// modulov (prodaja = samo 'orders'); 1 modul → brez tabov (brand/uro ostane).
// Izhod ostane samo prek PIN (admin/manager).
// ============================================
interface KioskBarProps {
  /** Dovoljeni moduli — page.tsx poda resolveAllowedModules(salesMode, kiosk); fallback = store */
  allowedModules?: readonly string[]
}

export const KioskBar = memo(function KioskBar({ allowedModules }: KioskBarProps) {
  const { activeModule, setActiveModule, salesMode, kioskAllowedModules, setKioskMode, setSalesMode } = usePOSStore()
  const [currentTime, setCurrentTime] = useState('')
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }))
    }
    updateTime()
    const interval = setInterval(updateTime, 30000)
    return () => clearInterval(interval)
  }, [])

  // R153: dovoljeni moduli — prop ima prednost, sicer store razrešitev
  const allowed = allowedModules ?? resolveAllowedModules(salesMode, kioskAllowedModules)

  const handleExitKiosk = useCallback(() => {
    setShowPinDialog(true)
    setPin('')
    setPinError('')
  }, [])

  const handlePinSubmit = useCallback(async () => {
    if (pin.length < 4) {
      setPinError('Vnesite vsaj 4 števke')
      return
    }
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.employee?.role === 'admin' || data.employee?.role === 'manager') {
          // R153: resetiramo OBA načina — idempotentno in brez tveganja, da
          // zastarel drugi flag uporabnika takoj ujame nazaj v omejen nabor
          setKioskMode(false)
          setSalesMode(false)
          setShowPinDialog(false)
          setPin('')
          setPinError('')
        } else {
          setPinError('Potrebno je dovoljenje administratorja')
        }
      } else {
        setPinError('Napačen PIN')
        setPin('')
      }
    } catch {
      setPinError('Napaka pri preverjanju PIN-a')
    }
  }, [pin, setKioskMode, setSalesMode])

  const _handlePinKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePinSubmit()
  }, [handlePinSubmit])

  return (
    <>
      <div className="flex-shrink-0 h-10 bg-card border-b border-border flex items-center px-3 gap-2">
        <KioskBrand />
        {/* R153: 1 dovoljen modul (prodajni način) → brez tabov in ločila */}
        {allowed.length > 1 && (
          <>
            <div className="h-5 w-px bg-border" />
            <ModuleTabs activeModule={activeModule} onModuleChange={setActiveModule} allowedModules={allowed} />
          </>
        )}
        <div className="flex-1" />
        <KioskClock currentTime={currentTime} />
        <div className="h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1 touch-manipulation text-muted-foreground hover:text-foreground"
          onClick={handleExitKiosk}
        >
          <Lock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Izhod</span>
        </Button>
      </div>

      <KioskPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        pin={pin}
        setPin={setPin}
        pinError={pinError}
        setPinError={setPinError}
        onPinSubmit={handlePinSubmit}
        title={salesMode ? 'Izhod iz prodajnega načina' : 'Izhod iz kiosk načina'}
      />
    </>
  )
})
