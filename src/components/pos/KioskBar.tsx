'use client'
import { usePOSStore } from '@/lib/store'
import { useState, useEffect, useCallback, memo } from 'react'
import { Store, ShoppingCart, ChefHat, BarChartBig, Lock, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
// ============================================
// IKONE ZA MODULE
// ============================================
const moduleConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  orders: { label: 'Prodaja', icon: <ShoppingCart className="h-4 w-4" /> },
  kitchen: { label: 'Kuhinja', icon: <ChefHat className="h-4 w-4" /> },
  tables: { label: 'Mize', icon: <BarChartBig className="h-4 w-4" /> },
}
// ============================================
// KIOSK BAR KOMPONENTA
// ============================================
export const KioskBar = memo(function KioskBar() {
  const { activeModule, setActiveModule, kioskAllowedModules, setKioskMode } = usePOSStore()
  const [currentTime, setCurrentTime] = useState('')
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  // Ura
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }))
    }
    updateTime()
    const interval = setInterval(updateTime, 30000)
    return () => clearInterval(interval)
  }, [])
  // Izhod iz kiosk načina — zahteva PIN
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
        // Samo admin ali manager lahko izstopi iz kiosk načina
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
        {/* Logotip */}
        <div className="flex items-center gap-1.5 mr-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <Store className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold hidden sm:inline">RestaurantOS</span>
        </div>
        {/* Ločilnik */}
        <div className="h-5 w-px bg-border" />
        {/* Moduli tabi */}
        <div className="flex gap-0.5 ml-1">
          {kioskAllowedModules.map((moduleId) => {
            const config = moduleConfig[moduleId]
            if (!config) return null
            const isActive = activeModule === moduleId
            return (
              <button
                key={moduleId}
                onClick={() => setActiveModule(moduleId)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-semibold transition-colors touch-manipulation ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {config.icon}
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            )
          })}
        </div>
        {/* Razmaknik */}
        <div className="flex-1" />
        {/* Ura */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{currentTime}</span>
        </div>
        {/* Ločilnik */}
        <div className="h-5 w-px bg-border" />
        {/* Izhod iz kioska */}
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
      {/* PIN dialog za izhod iz kioska */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Izhod iz kiosk načina</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Vnesite administratorski PIN za izhod
            </p>
            {/* PIN prikaz */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-colors ${
                    i < pin.length
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  }`}
                >
                  {i < pin.length && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
            {/* Napaka */}
            {pinError && (
              <div className="text-center text-xs text-red-600 dark:text-red-400">
                {pinError}
              </div>
            )}
            {/* Števčna tipkovnica */}
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                <Button
                  key={digit}
                  variant="outline"
                  className="h-11 text-lg font-bold touch-manipulation"
                  onClick={() => {
                    if (pin.length < 6) {
                      setPin(prev => prev + digit)
                      setPinError('')
                    }
                  }}
                  autoFocus={digit === '1'}
                >
                  {digit}
                </Button>
              ))}
              <Button
                variant="ghost"
                className="h-11 touch-manipulation"
                onClick={() => {
                  setPin(prev => prev.slice(0, -1))
                  setPinError('')
                }}
              >
                ←
              </Button>
              <Button
                variant="outline"
                className="h-11 text-lg font-bold touch-manipulation"
                onClick={() => {
                  if (pin.length < 6) {
                    setPin(prev => prev + '0')
                    setPinError('')
                  }
                }}
              >
                0
              </Button>
              <Button
                className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white touch-manipulation"
                onClick={handlePinSubmit}
                disabled={pin.length < 4}
              >
                ✓
              </Button>
            </div>
            {/* Prekliči */}
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => {
                setShowPinDialog(false)
                setPin('')
                setPinError('')
              }}
            >
              Prekliči
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
