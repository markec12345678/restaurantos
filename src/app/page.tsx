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
import { SubscriptionManager } from '@/components/pos/SubscriptionManager'
import { StaffScheduler } from '@/components/pos/StaffScheduler'
import { StaffPerformance } from '@/components/pos/StaffPerformance'
import { KitchenPrepQueue } from '@/components/pos/KitchenPrepQueue'
import { NotificationManager } from '@/components/pos/NotificationManager'
import { AllergenMatrix } from '@/components/pos/AllergenMatrix'
import { TableTurnoverAnalytics } from '@/components/pos/TableTurnoverAnalytics'
import { ExpenseTracker } from '@/components/pos/ExpenseTracker'
import { DailyChecklist } from '@/components/pos/DailyChecklist'
import { EndOfDayManager } from '@/components/pos/EndOfDayManager'
import { CoursePacing } from '@/components/pos/CoursePacing'
import { MenuEngineeringMatrix } from '@/components/pos/MenuEngineeringMatrix'
import { CustomerFeedback } from '@/components/pos/CustomerFeedback'
import { FursManager } from '@/components/pos/FursManager'
import { VisualFloorPlan } from '@/components/pos/VisualFloorPlan'
import { AIForecastDashboard } from '@/components/pos/AIForecastDashboard'
import { ZReportManager } from '@/components/pos/ZReportManager'
import { TipManager } from '@/components/pos/TipManager'
import { DeliveryTracker } from '@/components/pos/DeliveryTracker'
import { MultiLocationDashboard } from '@/components/pos/MultiLocationDashboard'
import { WaitTimeEstimator } from '@/components/pos/WaitTimeEstimator'
import { AIRecommendations } from '@/components/pos/AIRecommendations'
import { NutritionalCalculator } from '@/components/pos/NutritionalCalculator'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import { InventoryAlerts } from '@/components/pos/InventoryAlerts'
import { CustomerTimeline } from '@/components/pos/CustomerTimeline'
import { ShiftOverview } from '@/components/pos/ShiftOverview'
import { ProfitLossReport } from '@/components/pos/ProfitLossReport'
import { TableReservationSync } from '@/components/pos/TableReservationSync'
import { KitchenStationManager } from '@/components/pos/KitchenStationManager'
import { TaxReport } from '@/components/pos/TaxReport'
import { VendorScorecard } from '@/components/pos/VendorScorecard'
import { OrderBump } from '@/components/pos/OrderBump'
import { WasteTracker } from '@/components/pos/WasteTracker'
import { RecipeScaling } from '@/components/pos/RecipeScaling'
import { ComplianceDashboard } from '@/components/pos/ComplianceDashboard'
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
  'staff-schedule': StaffScheduler,
  'staff-performance': StaffPerformance,
  'kitchen-prep': KitchenPrepQueue,
  'notifications': NotificationManager,
  'allergen-matrix': AllergenMatrix,
  'table-turnover': TableTurnoverAnalytics,
  'expenses': ExpenseTracker,
  'daily-checklist': DailyChecklist,
  'end-of-day': EndOfDayManager,
  'course-pacing': CoursePacing,
  'menu-engineering': MenuEngineeringMatrix,
  feedback: CustomerFeedback,
  locations: LocationManager,
  subscription: SubscriptionManager,
  furs: FursManager,
  'delivery-tracking': DeliveryTracker,
  'z-report': ZReportManager,
  'tip-manager': TipManager,
  'wait-time': WaitTimeEstimator,
  'multi-location': MultiLocationDashboard,
  'ai-recommendations': AIRecommendations,
  'nutrition': NutritionalCalculator,
  'inventory-alerts': InventoryAlerts,
  'customer-timeline': CustomerTimeline,
  'shift-overview': ShiftOverview,
  'profit-loss': ProfitLossReport,
  'table-reservation-sync': TableReservationSync,
  'kitchen-stations': KitchenStationManager,
  'tax-report': TaxReport,
  'vendor-scorecard': VendorScorecard,
  'order-bump': OrderBump,
  'waste-tracker': WasteTracker,
  'recipe-scaling': RecipeScaling,
  'compliance': ComplianceDashboard,
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
