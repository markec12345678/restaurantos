'use client'

import { usePOSStore } from '@/lib/store'
import { Sidebar } from '@/components/pos/sidebar/Sidebar'
import { KioskBar } from '@/components/pos/KioskBar'
import { HappyHourBanner } from '@/components/pos/HappyHourBanner'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import { useMemo } from 'react'
import { useModulePrefetch } from '@/lib/use-module-prefetch'
import { moduleComponents, AIAssistant } from '@/app/components/module-registry'
import { usePOSAuth } from '@/app/components/use-pos-auth'
import { AuthLoadingScreen, AuthLoginScreen } from '@/app/components/auth-screens'
import { ActiveModuleView } from '@/app/components/active-module-view'

export default function POSPage() {
  const { activeModule, kioskMode } = usePOSStore()
  const ActiveComponent = useMemo(() => moduleComponents[activeModule] || moduleComponents['orders'], [activeModule])

  // Prednalaganje podatkov ob preklopu modula — hitrejši prehod za uporabnika
  useModulePrefetch(activeModule)
  const { authUser, setAuthUser, authChecked } = usePOSAuth()

  // Dokler ni preverjena avtentikacija, prikaži nalagalni zaslon
  if (!authChecked) {
    return <AuthLoadingScreen />
  }

  if (!authUser) {
    return <AuthLoginScreen onLogin={(user) => setAuthUser(user)} />
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
          <main className="flex-1 overflow-hidden">
            <ActiveModuleView activeModule={activeModule} ActiveComponent={ActiveComponent} />
          </main>
        </div>
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <ActiveModuleView activeModule={activeModule} ActiveComponent={ActiveComponent} />
          </main>
        </>
      )}
      </div>
      <GlobalNotifications />
      <AIAssistant />
    </div>
  )
}
