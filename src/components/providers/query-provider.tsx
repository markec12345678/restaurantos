'use client'

// ============================================
// GLOBALNI QUERY CLIENT PROVIDER ZA RESTAURANTOS
// Ustvarjen izven React za dostop iz ErrorBoundary
// ============================================

import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // FIX BUG (QA 2026-09-17, runda 4): po prijavi/izteku seje nihče NI invalidiral
  // react-query cache-a. Poizvedbe, ki so padle z 401 med prehodom (npr. Menu
  // Engineering KPI na Nadzorni plošči), so ostale ujete v error state-u do
  // ročnega "Poskusi znova". Zdaj: ob 'pos:auth-changed' (prijava) in
  // 'pos:auth-expired' (iztek) invalidiramo VSE poizvedbe → svež refetch
  // z novim žetonom, brez ročnih posegov.
  useEffect(() => {
    const invalidateAll = () => {
      void queryClient.invalidateQueries()
    }
    window.addEventListener('pos:auth-changed', invalidateAll)
    window.addEventListener('pos:auth-expired', invalidateAll)
    return () => {
      window.removeEventListener('pos:auth-changed', invalidateAll)
      window.removeEventListener('pos:auth-expired', invalidateAll)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
