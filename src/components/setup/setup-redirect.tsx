'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface SetupStatus {
  isInitialized: boolean
  mode: 'single' | 'multi'
}

export function SetupRedirect() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function checkSetup() {
      try {
        const res = await fetch('/api/setup/status', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
        if (!res.ok) { setLoading(false); return }
        const data: SetupStatus = await res.json()
        if (cancelled) return
        if (!data.isInitialized && !window.location.pathname.startsWith('/setup')) {
          router.replace('/setup')
          return
        }
        setLoading(false)
      } catch { setLoading(false) }
    }
    checkSetup()
    return () => { cancelled = true }
  }, [router])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-muted-foreground">Preverjam stanje sistema...</p>
        </div>
      </div>
    )
  }
  return null
}
