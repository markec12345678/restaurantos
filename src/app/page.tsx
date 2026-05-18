'use client'

import { usePOSStore } from '@/lib/store'
import { Sidebar } from '@/components/pos/Sidebar'
import { KioskBar } from '@/components/pos/KioskBar'
import { Dashboard } from '@/components/pos/Dashboard'
import { OrderPanel } from '@/components/pos/OrderPanel'
import { KitchenDisplay } from '@/components/pos/KitchenDisplay'
import { TableMap } from '@/components/pos/TableMap'
import { MenuManager } from '@/components/pos/MenuManager'
import { InventoryManager } from '@/components/pos/InventoryManager'
import { EmployeeManager } from '@/components/pos/EmployeeManager'
import { CashRegister } from '@/components/pos/CashRegister'
import { ReportsView } from '@/components/pos/ReportsView'
import { SupplierManager } from '@/components/pos/SupplierManager'
import { ReservationManager } from '@/components/pos/ReservationManager'
import { HaccpManager } from '@/components/pos/HaccpManager'
import { RecipeManager } from '@/components/pos/RecipeManager'
import { SettingsManager } from '@/components/pos/SettingsManager'
import { ConfigurationManager } from '@/components/pos/ConfigurationManager'
import { DeliveryManager } from '@/components/pos/DeliveryManager'
import { GiftCardManager } from '@/components/pos/GiftCardManager'
import { LoyaltyManager } from '@/components/pos/LoyaltyManager'
import { PrinterManager } from '@/components/pos/PrinterManager'
import { WebhookManager } from '@/components/pos/WebhookManager'
import { IntegrationManager } from '@/components/pos/IntegrationManager'
import { ShiftManager } from '@/components/pos/ShiftManager'
import { LocationManager } from '@/components/pos/LocationManager'
import { VisualFloorPlan } from '@/components/pos/VisualFloorPlan'
import { AIForecastDashboard } from '@/components/pos/AIForecastDashboard'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import GuestManager from '@/components/pos/GuestManager'
import FoodCostCalculator from '@/components/pos/FoodCostCalculator'
import WaitlistManager from '@/components/pos/WaitlistManager'
import AIAssistant from '@/components/pos/AIAssistant'
import { HappyHourBanner } from '@/components/pos/HappyHourBanner'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'
import { PinLogin, getCurrentUser, setCurrentUser, getAuthToken } from '@/components/pos/PinLogin'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const moduleComponents: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  orders: OrderPanel,
  kitchen: KitchenDisplay,
  'floor-plan': VisualFloorPlan,
  tables: TableMap,
  waitlist: WaitlistManager,
  'cash-register': CashRegister,
  guests: GuestManager,
  menu: MenuManager,
  'food-cost': FoodCostCalculator,
  inventory: InventoryManager,
  suppliers: SupplierManager,
  'ai-forecast': AIForecastDashboard,
  recipes: RecipeManager,
  reservations: ReservationManager,
  haccp: HaccpManager,
  employees: EmployeeManager,
  reports: ReportsView,
  configuration: ConfigurationManager,
  delivery: DeliveryManager,
  'gift-cards': GiftCardManager,
  loyalty: LoyaltyManager,
  printers: PrinterManager,
  webhooks: WebhookManager,
  integrations: IntegrationManager,
  shifts: ShiftManager,
  locations: LocationManager,
  settings: SettingsManager,
}

export default function POSPage() {
  const { activeModule, kioskMode } = usePOSStore()
  const ActiveComponent = moduleComponents[activeModule] || OrderPanel
  const [authUser, setAuthUser] = useState<ReturnType<typeof getCurrentUser>>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Preveri shranjenega uporabnika in veljavnost žetona
    const validateAuth = async () => {
      const stored = getCurrentUser()
      const token = getAuthToken()
      if (stored && token) {
        // Preveri, ali je žeton še veljaven (strežnik se je morda ponovno zagnal)
        try {
          const res = await fetch('/api/auth', {
            headers: { 'Authorization': `Bearer ${token}` },
          })
          if (res.ok) {
            setAuthUser(stored)
          } else {
            // Žeton ni veljaven — počisti in prikaži prijavo
            setCurrentUser(null)
            sessionStorage.removeItem('pos_auth_user')
            sessionStorage.removeItem('pos_auth_token')
            localStorage.removeItem('pos_auth_user')
            localStorage.removeItem('pos_auth_token')
          }
        } catch {
          // Napaka omrežja — dovoli vpisano uporabnika (offline način)
          setAuthUser(stored)
        }
      }
      setAuthChecked(true)
    }
    validateAuth()
  }, [])

  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthUser(null)
      setCurrentUser(null)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pos_user')
        sessionStorage.removeItem('pos_token')
        sessionStorage.removeItem('pos_auth_user')
        sessionStorage.removeItem('pos_auth_token')
        localStorage.removeItem('pos_auth_user')
        localStorage.removeItem('pos_auth_token')
      }
    }
    window.addEventListener('pos:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('pos:auth-expired', handleAuthExpired)
  }, [])

  // Dokler ni preverjena avtentikacija, prikaži nalagalni zaslon
  if (!authChecked) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mx-auto animate-pulse">
            <svg className="h-7 w-7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <p className="text-sm text-muted-foreground">Preverjanje prijave...</p>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="h-screen bg-background">
        <PinLogin
          onLogin={(user) => { setAuthUser(user); setCurrentUser(user) }}
          onSkip={() => {
            setCurrentUser({ id: 'guest', name: 'Gost', email: '', role: 'guest', primaryJob: null, permissions: ['take_orders', 'view_reports'] })
            setAuthUser({ id: 'guest', name: 'Gost', email: '', role: 'guest', primaryJob: null, permissions: ['take_orders', 'view_reports'] })
          }}
        />
      </div>
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
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      )}
      </div>
      <GlobalNotifications />
      <AIAssistant />
    </div>
  )
}
