'use client'
import { usePOSStore } from '@/lib/store'
import { useState, useEffect, useCallback, memo } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KioskPinDialog } from './KioskPinDialog'
import { ModuleTabs, KioskClock, KioskBrand } from './KioskBarParts'

// ============================================
// KIOSK BAR KOMPONENTA
// ============================================
export const KioskBar = memo(function KioskBar() {
  const { activeModule, setActiveModule, kioskAllowedModules, setKioskMode } = usePOSStore()
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
          setKioskMode(false)
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
  }, [pin, setKioskMode])

  const _handlePinKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePinSubmit()
  }, [handlePinSubmit])

  return (
    <>
      <div className="flex-shrink-0 h-10 bg-card border-b border-border flex items-center px-3 gap-2">
        <KioskBrand />
        <div className="h-5 w-px bg-border" />
        <ModuleTabs activeModule={activeModule} onModuleChange={setActiveModule} allowedModules={kioskAllowedModules} />
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
      />
    </>
  )
})
