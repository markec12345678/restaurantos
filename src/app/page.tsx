'use client'

import { usePOSStore } from '@/lib/store'
import { Sidebar } from '@/components/pos/sidebar/Sidebar'
import { KioskBar } from '@/components/pos/KioskBar'
import { HappyHourBanner } from '@/components/pos/HappyHourBanner'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import { CommandPalette } from '@/components/pos/command-palette/CommandPalette'
import { useMemo } from 'react'
import { useModulePrefetch } from '@/lib/use-module-prefetch'
import { moduleComponents, AIAssistant } from '@/app/components/module-registry'
import { usePOSAuth } from '@/app/components/use-pos-auth'
import { AuthLoadingScreen, AuthLoginScreen } from '@/app/components/auth-screens'
import { ActiveModuleView } from '@/app/components/active-module-view'
import { SetupRedirect } from '@/components/setup/setup-redirect'
import { PwaInstallPrompt } from '@/components/pwa/pwa-install-prompt'

export const dynamic = "force-dynamic"

export default function POSPage() {
  const { activeModule, kioskMode } = usePOSStore()
  const ActiveComponent = useMemo(() => moduleComponents[activeModule] || moduleComponents['orders'], [activeModule])

  // Prednalaganje podatkov ob preklopu modula — hitrejši prehod za uporabnika
  useModulePrefetch(activeModule)
  const { authUser, setAuthUser, authChecked } = usePOSAuth()

  // FIX WORKFLOW-48: preusmeri na /setup če sistem še ni inicializiran (first-run)
  if (!authChecked) {
    return (
      <>
        <SetupRedirect />
        <AuthLoadingScreen />
      </>
    )
  }

  if (!authUser) {
    return (
      <>
        <SetupRedirect />
        <AuthLoginScreen onLogin={(user) => setAuthUser(user)} />
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Happy Hour Banner — vidno kadar aktiven */}
      <HappyHourBanner />
      <div className="flex flex-1 overflow-hidden">
      {/* Kiosk način: KioskBar namesto Sidebar */}
      {kioskMode ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <KioskBar />
          <main id="main-content" className="flex-1 overflow-hidden" tabIndex={-1}>
            <ActiveModuleView activeModule={activeModule} ActiveComponent={ActiveComponent} />
          </main>
        </div>
      ) : (
        <>
          <Sidebar />
          <main id="main-content" className="flex-1 overflow-hidden" tabIndex={-1}>
            <ActiveModuleView activeModule={activeModule} ActiveComponent={ActiveComponent} />
          </main>
        </>
      )}
      </div>
      <GlobalNotifications />
      <AIAssistant />
      {/* Command Palette (Cmd+K / Ctrl+K) — hitra navigacija + akcije */}
      <CommandPalette />
      {/* PWA install prompt — prikaže se ko brskalnik dovoljuje namestitev */}
      <PwaInstallPrompt />
    </div>
  )
}
