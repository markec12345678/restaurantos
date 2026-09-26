'use client'

import { Component, memo, type ReactNode } from 'react'
import { MonitorOff, RefreshCcw } from 'lucide-react'

// =====================================================================
// Celozaslonska stanja display tabele (R136-c) — vzorec kiosk/StatusScreens:
//  - ConnectingScreen: spinner "Povezovanje…" (prvo nalaganje / brez odgovora)
//  - ConfigErrorScreen: manjkajoč/neveljaven ?loc= ALI 404 (neznana/neaktivna
//    lokacija) — jasno navodilo SKRBNIKU z monospace primerom URL-ja
//  - FatalErrorScreen + DisplayErrorBoundary: izjemen primer (render crash) —
//    neurejena tabla NE SME ostati bel zaslon: pokaže napako in se po 15 s
//    sama reloada (self-heal pariteta s hook-om)
// Vse: velika tipografija za TV razdaljo, visok kontrast, brez PII.
// Hardcoded slovenščina (javna stran — kiosk kanon; useI18n ne obstaja tu).
// =====================================================================

export const ConnectingScreen = memo(function ConnectingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-semibold">Povezovanje…</p>
      </div>
    </div>
  )
})

/** Manjkajoč/neveljaven ?loc= ALI 404 (neznana/tuja/neaktivna lokacija) */
export const ConfigErrorScreen = memo(function ConfigErrorScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 text-gray-900 px-6 py-10">
      <div className="max-w-xl w-full text-center bg-white rounded-3xl shadow-xl p-8 md:p-10">
        <MonitorOff className="w-14 h-14 mx-auto mb-6 text-gray-400" aria-hidden="true" />
        <h1 className="text-2xl md:text-3xl font-bold mb-3">
          Zaslon ni pravilno nastavljen
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Manjka ali pa je neveljaven parameter <span className="font-semibold">loc</span>{' '}
          (ID lokacije), ali pa lokacija ne obstaja več.
        </p>
        <div className="text-left bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-6">
          <p className="text-base font-semibold text-blue-900 mb-1">Navodilo skrbniku:</p>
          <p className="text-base text-blue-900">
            Dodaj <span className="font-mono font-semibold">?loc=&lt;id lokacije&gt;</span> v URL —
            ID najdeš v staff aplikaciji pod <span className="font-semibold">Lokacije</span>.
          </p>
        </div>
        <pre
          aria-label="Primer URL-ja"
          className="text-left text-sm md:text-base bg-gray-100 text-gray-800 rounded-xl px-4 py-3 overflow-x-auto"
        >
          {`https://<domena>/display?loc=<id lokacije>`}
        </pre>
      </div>
    </div>
  )
})

/** Izjemen primer (render crash) — tabla se sama obnovi, nikoli bel zaslon */
export const FatalErrorScreen = memo(function FatalErrorScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 text-gray-900 px-6">
      <div className="max-w-xl w-full text-center bg-white rounded-3xl shadow-xl p-10">
        <RefreshCcw className="w-14 h-14 mx-auto mb-6 text-gray-400" aria-hidden="true" />
        <h1 className="text-2xl md:text-3xl font-bold mb-3">Prišlo je do napake</h1>
        <p className="text-lg text-gray-600">
          Zaslon se bo samodejno ponovno naložil.
        </p>
      </div>
    </div>
  )
})

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** Ujame render crash v tabli → FatalErrorScreen + samodejni reload po 15 s */
export class DisplayErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(): void {
    // Neurejena tabla mora delovati nedoločeno — reload (ist kanon kot
    // self-heal v useDisplayBoard; reload reši tudi izgubljene seje/puščice)
    window.setTimeout(() => window.location.reload(), 15_000)
  }

  render(): ReactNode {
    if (this.state.hasError) return <FatalErrorScreen />
    return this.props.children
  }
}
