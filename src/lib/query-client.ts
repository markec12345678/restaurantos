// ============================================
// GLOBALNI QUERY CLIENT ZA RESTAURANTOS
// Ustvarjen izven React za dostop iz ErrorBoundary
// ============================================

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Podatki so sveži 30s — po tem času se bodo samodejno ponovno pridobili
      staleTime: 30 * 1000,
      // Predpomnilnik se ohrani 5 minut po zadnji uporabi (skupni privzetek v5)
      gcTime: 5 * 60 * 1000,
      // Ne osvežuj ob fokusu okna — preveč nepotrebnih poizvedb za POS
      refetchOnWindowFocus: false,
      // En poskus ponovitve — dovolj za prehodne napake, ne pretiravaj
      retry: 1,
      // Prikaži loading stanje ob napaki namesto da obdržiš stare podatke
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutacije se ne ponavljajo samodejno — uporabnik mora znova klikniti
      retry: false,
    },
  },
})
