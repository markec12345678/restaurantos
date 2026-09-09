'use client'

// ============================================
// NETWORK STATUS BAR — P2-UX (jasen status offline/online)
// ============================================
// VEDNO viden trak nad POS vsebino, ki prikazuje:
//   - ONLINE  → diskreten zelen pik (skrit trak)
//   - OFFLINE → izrazit rdeč trak: "BREZ POVEZAVE — naročila se shranjujejo lokalno"
//   - če so v offline vrsti čakajoča naročila → števec "N čakajočih naročil"
//
// Zakaj nov komponent: prej je bil offline status viden le v
//   1) minljivih toastih ("Naročilo shranjeno offline …")
//   2) admin-only dashboardu OfflineQueueDashboard (sidebar badge = samo konflikti)
// Natakar med delom NI VIDEL, da je naprava offline, dokler ni poskusil oddati naročila.
//
// Detekcija:
//   - useSyncExternalStore nad window 'online'/'offline' dogodki (navigator.onLine)
//   - poll 5 s na getPendingCount() (IndexedDB offline vrsta)
//     (pokrije tudi lažni "online": router dela, backend ne — števec čakajočih
//      ostane > 0 dokler sinhronizacija ne počisti vrste)

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Wifi, WifiOff, CloudUpload } from 'lucide-react'
import { getPendingCount } from '@/lib/offline-orders'

/** Naročnina na browser online/offline dogodke (za useSyncExternalStore). */
function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine
}

function getOnlineServerSnapshot(): boolean {
  // SSR — privzeto online (hidracija se popravi ob mount-u)
  return true
}

export function NetworkStatusBar() {
  // navigator.onLine kot external store — brez kaskadnih re-renderjev
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot)
  const [pendingCount, setPendingCount] = useState(0)

  // Posodobi števec čakajočih offline naročil (IndexedDB)
  const refreshPending = useCallback(() => {
    getPendingCount()
      .then(setPendingCount)
      .catch(() => {/* IndexedDB nedosegljiv — ignoriraj (SSR / zasečni način) */})
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      // ob povratku povezave osveži števec (sinhronizacija se sproži drugje)
      setTimeout(refreshPending, 2000)
    }
    window.addEventListener('online', handleOnline)

    // Poll števca: 5s (usklajeno z ostalimi poll-intervali v POS)
    refreshPending()
    const interval = setInterval(refreshPending, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [refreshPending])

  // ONLINE + nič čakajočih → diskreten indikator (ne zaseda prostora)
  if (isOnline && pendingCount === 0) {
    return (
      <div
        className="flex items-center justify-end gap-1 px-3 py-0.5 text-[10px] text-emerald-600"
        role="status"
        aria-label="Povezava z strežnikom je vzpostavljena"
      >
        <Wifi className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">Online</span>
      </div>
    )
  }

  // ONLINE + čakajoča naročila → rumeni trak (sinhronizacija/ostanki vrste)
  if (isOnline) {
    return (
      <div
        className="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-950 px-3 py-1.5 text-sm font-medium text-amber-900 dark:text-amber-100"
        role="status"
        aria-live="polite"
      >
        <CloudUpload className="h-4 w-4 animate-pulse" aria-hidden />
        <span>Sinhronizacija offline naročil: {pendingCount} {pendingCount === 1 ? 'naročilo' : 'naročil'} čaka</span>
      </div>
    )
  }

  // OFFLINE → rdeči trak (izrazit, nemogoče spregledati)
  return (
    <div
      className="flex items-center justify-center gap-2 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      <span>
        BREZ POVEZAVE — naročila se shranjujejo lokalno
        {pendingCount > 0 && ` (${pendingCount} ${pendingCount === 1 ? 'naročilo' : 'naročil'} čaka)`}
      </span>
    </div>
  )
}
