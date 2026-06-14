'use client'

// ============================================
// LAZY LOADING — Vse POS module nalagamo lenobo
// Zmanjša začetni bundle z ~60 komponent na samo aktivno
// ============================================

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

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
const ExpenseTracker = dynamic(() => import('@/components/pos/expense-tracker/ExpenseTracker').then(m => ({ default: m.ExpenseTracker })), { ssr: false, loading: () => loadingFallback })
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
export const moduleComponents: Record<string, ComponentType> = {
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

// AIAssistant je vedno prisotna (plavajoči gumb) — ločen izvoz
export { AIAssistant }
