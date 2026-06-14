'use client'

import { memo, useState } from 'react'
import { HandMetal } from 'lucide-react'

// ─── PIN Login za natakarjevo tablico ──────────────────────────

interface WaiterLoginProps {
  onLogin: (_emp: { id: string; name: string; role: string }) => void
}

export const WaiterLogin = memo(function WaiterLogin({ onLogin }: WaiterLoginProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (pin.length < 4) { setError('Vnesite PIN'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Napaka'); return }
      const data = await res.json()
      localStorage.setItem('pos_token', data.token)
      localStorage.setItem('pos_employee', JSON.stringify(data.employee))
      onLogin(data.employee)
    } catch { setError('Povezava ni na voljo') }
    finally { setLoading(false) }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-blue-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <HandMetal className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Natakarjeva tablica</h1>
          <p className="text-muted-foreground mt-1 text-sm">Prijavite se za dostop</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-xl p-6 space-y-4">
          <input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Vnesite PIN" autoFocus
            className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 rounded-xl border-2 focus:border-blue-500 focus:outline-none bg-background" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={handleLogin} disabled={loading || pin.length < 4}
            className="w-full py-4 rounded-xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
            {loading ? 'Prijava...' : 'Prijava'}
          </button>
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground text-center mb-2">Demo PIN-i</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPin('1111')} className="py-2 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80">Natakar 1111</button>
              <button onClick={() => setPin('1234')} className="py-2 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80">Admin 1234</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

