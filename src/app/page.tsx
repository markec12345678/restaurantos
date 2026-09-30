'use client'

import { usePOSStore } from '@/lib/store'
import { resolveAllowedModules } from '@/lib/sales-mode'
import { Sidebar } from '@/components/pos/sidebar/Sidebar'
import { KioskBar } from '@/components/pos/KioskBar'
import { HappyHourBanner } from '@/components/pos/HappyHourBanner'
// P2-UX (jasen status offline/online): vselej viden status povezave + števec čakajočih offline naročil
import { NetworkStatusBar } from '@/components/pos/NetworkStatusBar'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import { CommandPalette } from '@/components/pos/command-palette/CommandPalette'
import { KeyboardShortcutsDialog } from '@/components/pos/keyboard-shortcuts/KeyboardShortcutsDialog'
import { KeyboardShortcutsHandler } from '@/components/pos/keyboard-shortcuts/KeyboardShortcutsHandler'
import { NotificationCenter } from '@/components/pos/notification-center/NotificationCenter'
import { useEffect, useMemo, useRef } from 'react'
import { useModulePrefetch } from '@/lib/use-module-prefetch'
import { moduleComponents, AIAssistant } from '@/app/components/module-registry'
import { usePOSAuth } from '@/app/components/use-pos-auth'
import { canAccessModule, resolveWorkspaceForUser } from '@/lib/modules/registry'
import { AuthLoadingScreen, AuthLoginScreen } from '@/app/components/auth-screens'
import { ActiveModuleView } from '@/app/components/active-module-view'
import { SetupRedirect } from '@/components/setup/setup-redirect'
import { PwaInstallPrompt } from '@/components/pwa/pwa-install-prompt'
import { SwUpdateToast } from '@/components/pwa/sw-update-toast'

export const dynamic = "force-dynamic"

export default function POSPage() {
  const { activeModule, kioskMode, salesMode, kioskAllowedModules } = usePOSStore()
  const ActiveComponent = useMemo(() => moduleComponents[activeModule] || moduleComponents['orders'], [activeModule])

  // Prednalaganje podatkov ob preklopu modula — hitrejši prehod za uporabnika
  useModulePrefetch(activeModule)
  const { authUser, setAuthUser, authChecked } = usePOSAuth()

  // P0-01 (epic #144, R175) + P0-02 (R176): landing iz WORKSPACES
  // (resolveWorkspaceForUser — P0-02 UX model nad realnim EmployeeRole enumom):
  //   admin/manager/view_reports → danes kokpit (≡ P0-01 kanon),
  //   chef/kitchen → kitchen KDS (NOVO P0-02), staff → orders (no-op).
  // Ob PRVEM vstopu in SAMO, če uporabnik še ni sam izbral modula (store
  // default 'orders'); kiosk/prodajni način NE preusmerja (sank = brez admin
  // površin, R153). Vrati so canAccessModule(landing) — workspace ne odpira
  // modulov, samo usmerja.
  const landingApplied = useRef(false)
  useEffect(() => {
    if (!authUser) {
      landingApplied.current = false
      return
    }
    if (landingApplied.current) return
    landingApplied.current = true
    const { kioskMode, salesMode, activeModule, setActiveModule } = usePOSStore.getState()
    if (kioskMode || salesMode || activeModule !== 'orders') return
    const workspace = resolveWorkspaceForUser(authUser)
    if (workspace && canAccessModule(authUser, workspace.landing)) {
      setActiveModule(workspace.landing)
    }
  }, [authUser])

  // P2-UX FIX (stanje po refreshu/crashu): ročna rehidracija košarice/mize iz
  // localStorage PO prvi upodabitvi (skipHydration v store-u prepreči SSR mismatch)
  useEffect(() => {
    void usePOSStore.persist.rehydrate()
  }, [])

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
      {/* P2-UX: status povezave (online/offline + čakajoča offline naročila) */}
      <NetworkStatusBar />
      {/* Happy Hour Banner — vidno kadar aktiven */}
      <HappyHourBanner />
      <div className="flex flex-1 overflow-hidden">
      {/* Kiosk način / Prodajni način (R153): KioskBar namesto Sidebar —
          prodajni način pusti samo blagajniški nabor (allowedModules=orders) */}
      {(kioskMode || salesMode) ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <KioskBar allowedModules={resolveAllowedModules(salesMode, kioskAllowedModules)} />
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
      {/* R153: AI pomočnik skrit v prodajnem/kiosk načinu (sank = brez admin površin) */}
      {!salesMode && !kioskMode && <AIAssistant />}
      {/* Notification Center — real-time obvestila iz WebSocket-a */}
      <NotificationCenter />
      {/* Command Palette (Cmd+K / Ctrl+K) — hitra navigacija + akcije */}
      <CommandPalette />
      {/* Keyboard Shortcuts Dialog (? ali Ctrl+/) — prikaz vseh bližnjic */}
      <KeyboardShortcutsDialog />
      {/* Keyboard Shortcuts Handler — dejanski handler-ji za Ctrl+1-5, N, P, B, D, V */}
      <KeyboardShortcutsHandler />
      {/* PWA install prompt — prikaže se ko brskalnik dovoljuje namestitev */}
      <PwaInstallPrompt />
      {/* RUNDA 45: PWA update toast — nova verzija SW → toast z "Osveži zdaj" (brez prisilnega reloada) */}
      <SwUpdateToast />
    </div>
  )
}
