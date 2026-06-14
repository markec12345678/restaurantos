'use client'

import { usePOSStore } from '@/lib/store'
import { Sidebar } from '@/components/pos/Sidebar'
import { KioskBar } from '@/components/pos/KioskBar'
import { PinLogin, getCurrentUser, setCurrentUser, getAuthToken } from '@/components/pos/PinLogin'
import { HappyHourBanner } from '@/components/pos/HappyHourBanner'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import { ErrorBoundary } from '@/components/error-boundary'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { useModulePrefetch } from '@/lib/use-module-prefetch'

// ============================================
// LAZY LOADING — Vse POS module nalagamo lenobo
// Zmanjša začetni bundle z ~60 komponent na samo aktivno
// ============================================

const loadingFallback = (
  <div className="space-y-6 p-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-28" />))}
    </div>
    <Skeleton className="h-72" />
  </div>
)

// Lenobo naložene komponente z next/dynamic
// ssr: false — vse POS komponente so 'use client' z brskalniškimi API-ji
const Dashboard = dynamic(() => import('@/components/pos/Dashboard').then(m => ({ default: m.Dashboard })), { ssr: false, loading: () => loadingFallback })
const OrderPanel = dynamic(() => import('@/components/pos/OrderPanel').then(m => ({ default: m.OrderPanel })), { ssr: false, loading: () => loadingFallback })
const KitchenDisplay = dynamic(() => import('@/components/pos/KitchenDisplay').then(m => ({ default: m.KitchenDisplay })), { ssr: false, loading: () => loadingFallback })
const TableMap = dynamic(() => import('@/components/pos/TableMap').then(m => ({ default: m.TableMap })), { ssr: false, loading: () => loadingFallback })
const MenuManager = dynamic(() => import('@/components/pos/MenuManager').then(m => ({ default: m.MenuManager })), { ssr: false, loading: () => loadingFallback })
const InventoryManager = dynamic(() => import('@/components/pos/InventoryManager').then(m => ({ default: m.InventoryManager })), { ssr: false, loading: () => loadingFallback })
const EmployeeManager = dynamic(() => import('@/components/pos/EmployeeManager').then(m => ({ default: m.EmployeeManager })), { ssr: false, loading: () => loadingFallback })
const CashRegister = dynamic(() => import('@/components/pos/CashRegister').then(m => ({ default: m.CashRegister })), { ssr: false, loading: () => loadingFallback })
const ReportsView = dynamic(() => import('@/components/pos/ReportsView').then(m => ({ default: m.ReportsView })), { ssr: false, loading: () => loadingFallback })
const SupplierManager = dynamic(() => import('@/components/pos/SupplierManager').then(m => ({ default: m.SupplierManager })), { ssr: false, loading: () => loadingFallback })
const ReservationManager = dynamic(() => import('@/components/pos/ReservationManager').then(m => ({ default: m.ReservationManager })), { ssr: false, loading: () => loadingFallback })
const HaccpManager = dynamic(() => import('@/components/pos/HaccpManager').then(m => ({ default: m.HaccpManager })), { ssr: false, loading: () => loadingFallback })
const RecipeManager = dynamic(() => import('@/components/pos/RecipeManager').then(m => ({ default: m.RecipeManager })), { ssr: false, loading: () => loadingFallback })
const SettingsManager = dynamic(() => import('@/components/pos/SettingsManager').then(m => ({ default: m.SettingsManager })), { ssr: false, loading: () => loadingFallback })
const ConfigurationManager = dynamic(() => import('@/components/pos/ConfigurationManager').then(m => ({ default: m.ConfigurationManager })), { ssr: false, loading: () => loadingFallback })
const DeliveryManager = dynamic(() => import('@/components/pos/DeliveryManager').then(m => ({ default: m.DeliveryManager })), { ssr: false, loading: () => loadingFallback })
const GiftCardManager = dynamic(() => import('@/components/pos/GiftCardManager').then(m => ({ default: m.GiftCardManager })), { ssr: false, loading: () => loadingFallback })
const LoyaltyManager = dynamic(() => import('@/components/pos/LoyaltyManager').then(m => ({ default: m.LoyaltyManager })), { ssr: false, loading: () => loadingFallback })
const PrinterManager = dynamic(() => import('@/components/pos/PrinterManager').then(m => ({ default: m.PrinterManager })), { ssr: false, loading: () => loadingFallback })
const WebhookManager = dynamic(() => import('@/components/pos/WebhookManager').then(m => ({ default: m.WebhookManager })), { ssr: false, loading: () => loadingFallback })
const IntegrationManager = dynamic(() => import('@/components/pos/IntegrationManager').then(m => ({ default: m.IntegrationManager })), { ssr: false, loading: () => loadingFallback })
const ShiftManager = dynamic(() => import('@/components/pos/ShiftManager').then(m => ({ default: m.ShiftManager })), { ssr: false, loading: () => loadingFallback })
const LocationManager = dynamic(() => import('@/components/pos/LocationManager').then(m => ({ default: m.LocationManager })), { ssr: false, loading: () => loadingFallback })
const SubscriptionManager = dynamic(() => import('@/components/pos/SubscriptionManager').then(m => ({ default: m.SubscriptionManager })), { ssr: false, loading: () => loadingFallback })
const StaffScheduler = dynamic(() => import('@/components/pos/StaffScheduler').then(m => ({ default: m.StaffScheduler })), { ssr: false, loading: () => loadingFallback })
const StaffPerformance = dynamic(() => import('@/components/pos/StaffPerformance').then(m => ({ default: m.StaffPerformance })), { ssr: false, loading: () => loadingFallback })
const KitchenPrepQueue = dynamic(() => import('@/components/pos/KitchenPrepQueue').then(m => ({ default: m.KitchenPrepQueue })), { ssr: false, loading: () => loadingFallback })
const NotificationManager = dynamic(() => import('@/components/pos/NotificationManager').then(m => ({ default: m.NotificationManager })), { ssr: false, loading: () => loadingFallback })
const AllergenMatrix = dynamic(() => import('@/components/pos/AllergenMatrix').then(m => ({ default: m.AllergenMatrix })), { ssr: false, loading: () => loadingFallback })
const TableTurnoverAnalytics = dynamic(() => import('@/components/pos/TableTurnoverAnalytics').then(m => ({ default: m.TableTurnoverAnalytics })), { ssr: false, loading: () => loadingFallback })
const ExpenseTracker = dynamic(() => import('@/components/pos/ExpenseTracker').then(m => ({ default: m.ExpenseTracker })), { ssr: false, loading: () => loadingFallback })
const DailyChecklist = dynamic(() => import('@/components/pos/DailyChecklist').then(m => ({ default: m.DailyChecklist })), { ssr: false, loading: () => loadingFallback })
const EndOfDayManager = dynamic(() => import('@/components/pos/EndOfDayManager').then(m => ({ default: m.EndOfDayManager })), { ssr: false, loading: () => loadingFallback })
const CoursePacing = dynamic(() => import('@/components/pos/CoursePacing').then(m => ({ default: m.CoursePacing })), { ssr: false, loading: () => loadingFallback })
const MenuEngineeringMatrix = dynamic(() => import('@/components/pos/MenuEngineeringMatrix').then(m => ({ default: m.MenuEngineeringMatrix })), { ssr: false, loading: () => loadingFallback })
const CustomerFeedback = dynamic(() => import('@/components/pos/CustomerFeedback').then(m => ({ default: m.CustomerFeedback })), { ssr: false, loading: () => loadingFallback })
const FursManager = dynamic(() => import('@/components/pos/FursManager').then(m => ({ default: m.FursManager })), { ssr: false, loading: () => loadingFallback })
const VisualFloorPlan = dynamic(() => import('@/components/pos/VisualFloorPlan').then(m => ({ default: m.VisualFloorPlan })), { ssr: false, loading: () => loadingFallback })
const AIForecastDashboard = dynamic(() => import('@/components/pos/AIForecastDashboard').then(m => ({ default: m.AIForecastDashboard })), { ssr: false, loading: () => loadingFallback })
const ZReportManager = dynamic(() => import('@/components/pos/ZReportManager').then(m => ({ default: m.ZReportManager })), { ssr: false, loading: () => loadingFallback })
const TipManager = dynamic(() => import('@/components/pos/TipManager').then(m => ({ default: m.TipManager })), { ssr: false, loading: () => loadingFallback })
const DeliveryTracker = dynamic(() => import('@/components/pos/DeliveryTracker').then(m => ({ default: m.DeliveryTracker })), { ssr: false, loading: () => loadingFallback })
const MultiLocationDashboard = dynamic(() => import('@/components/pos/MultiLocationDashboard').then(m => ({ default: m.MultiLocationDashboard })), { ssr: false, loading: () => loadingFallback })
const WaitTimeEstimator = dynamic(() => import('@/components/pos/WaitTimeEstimator').then(m => ({ default: m.WaitTimeEstimator })), { ssr: false, loading: () => loadingFallback })
const AIRecommendations = dynamic(() => import('@/components/pos/AIRecommendations').then(m => ({ default: m.AIRecommendations })), { ssr: false, loading: () => loadingFallback })
const NutritionalCalculator = dynamic(() => import('@/components/pos/NutritionalCalculator').then(m => ({ default: m.NutritionalCalculator })), { ssr: false, loading: () => loadingFallback })
const InventoryAlerts = dynamic(() => import('@/components/pos/InventoryAlerts').then(m => ({ default: m.InventoryAlerts })), { ssr: false, loading: () => loadingFallback })
const CustomerTimeline = dynamic(() => import('@/components/pos/CustomerTimeline').then(m => ({ default: m.CustomerTimeline })), { ssr: false, loading: () => loadingFallback })
const ShiftOverview = dynamic(() => import('@/components/pos/ShiftOverview').then(m => ({ default: m.ShiftOverview })), { ssr: false, loading: () => loadingFallback })
const ProfitLossReport = dynamic(() => import('@/components/pos/ProfitLossReport').then(m => ({ default: m.ProfitLossReport })), { ssr: false, loading: () => loadingFallback })
const TableReservationSync = dynamic(() => import('@/components/pos/TableReservationSync').then(m => ({ default: m.TableReservationSync })), { ssr: false, loading: () => loadingFallback })
const KitchenStationManager = dynamic(() => import('@/components/pos/KitchenStationManager').then(m => ({ default: m.KitchenStationManager })), { ssr: false, loading: () => loadingFallback })
const TaxReport = dynamic(() => import('@/components/pos/TaxReport').then(m => ({ default: m.TaxReport })), { ssr: false, loading: () => loadingFallback })
const VendorScorecard = dynamic(() => import('@/components/pos/VendorScorecard').then(m => ({ default: m.VendorScorecard })), { ssr: false, loading: () => loadingFallback })
const OrderBump = dynamic(() => import('@/components/pos/OrderBump').then(m => ({ default: m.OrderBump })), { ssr: false, loading: () => loadingFallback })
const WasteTracker = dynamic(() => import('@/components/pos/WasteTracker').then(m => ({ default: m.WasteTracker })), { ssr: false, loading: () => loadingFallback })
const RecipeScaling = dynamic(() => import('@/components/pos/RecipeScaling').then(m => ({ default: m.RecipeScaling })), { ssr: false, loading: () => loadingFallback })
const ComplianceDashboard = dynamic(() => import('@/components/pos/ComplianceDashboard').then(m => ({ default: m.ComplianceDashboard })), { ssr: false, loading: () => loadingFallback })
// Default exports
const GuestManager = dynamic(() => import('@/components/pos/GuestManager').then(m => ({ default: m.GuestManager })), { ssr: false, loading: () => loadingFallback })
const FoodCostCalculator = dynamic(() => import('@/components/pos/food-cost/FoodCostCalculator'), { ssr: false, loading: () => loadingFallback })
const WaitlistManager = dynamic(() => import('@/components/pos/WaitlistManager'), { ssr: false, loading: () => loadingFallback })
const AIAssistant = dynamic(() => import('@/components/pos/AIAssistant'), { ssr: false, loading: () => null })

// Map imen modulov na lenobo naložene komponente
const moduleComponents: Record<string, ComponentType> = {
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
  const ActiveComponent = useMemo(() => moduleComponents[activeModule] || OrderPanel, [activeModule])

  // Prednalaganje podatkov ob preklopu modula — hitrejši prehod za uporabnika
  useModulePrefetch(activeModule)
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
                <ErrorBoundary context={`POS:${activeModule}`} maxRetries={3}>
                  <ActiveComponent />
                </ErrorBoundary>
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
                <ErrorBoundary context={`POS:${activeModule}`} maxRetries={3}>
                  <ActiveComponent />
                </ErrorBoundary>
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
