// ============================================
// SKUPNI TIPI ZA RESTAURANTOS POS
// Zamenjajo 'any' tip po celotni aplikaciji
// ============================================

import type { LucideIcon } from 'lucide-react'

// --- Osnovni API odzivni tipi ---

/** Naročilo iz API-ja */
export interface OrderRow {
  id: string
  orderNumber?: string
  status: string
  total: number
  type?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
  tableId?: string
  tableName?: string
  employeeId?: string
  employeeName?: string
  items: OrderItemRow[]
  orderItems?: OrderItemRow[]
  checks?: CheckRow[]
  payments?: PaymentRow[]
  tip?: number
  discountAmount?: number
  deliveryFee?: number
  notes?: string
  priority?: string
  [key: string]: unknown // za dodatne podatke iz API-ja
}

/** Postavka naročila */
export interface OrderItemRow {
  id: string
  menuItemId?: string
  itemName?: string
  name?: string
  quantity: number
  price: number
  unitPrice?: number
  total?: number
  status?: string
  category?: string
  notes?: string
  modifiers?: ModifierRow[]
  inventoryItemId?: string
  priority?: string
  prepTime?: number
  startedAt?: string
  specialInstructions?: string
  taxRate?: number
  [key: string]: unknown
}

/** Modifikator postavke */
export interface ModifierRow {
  id?: string
  name: string
  price?: number
  [key: string]: unknown
}

/** Račun / Check */
export interface CheckRow {
  id: string
  total: number
  tip?: number
  payments?: PaymentRow[]
  [key: string]: unknown
}

/** Plačilo */
export interface PaymentRow {
  id: string
  method: string
  amount: number
  [key: string]: unknown
}

/** Miza */
export interface TableRow {
  id: string
  name?: string
  number?: number
  seats?: number
  status?: string
  area?: string
  sectionId?: string
  [key: string]: unknown
}

/** Zaposleni */
export interface EmployeeRow {
  id: string
  name: string
  email?: string
  role: string
  status?: string
  pin?: string
  jobs?: EmployeeJobRow[]
  employeeId?: string
  employeeName?: string
  orderCount?: number
  totalRevenue?: number
  totalTips?: number
  avgOrderValue?: number
  itemsSold?: number
  voidedItems?: number
  primaryJob?: string
  [key: string]: unknown
}

/** Funkcija zaposlenega */
export interface EmployeeJobRow {
  id: string
  isPrimary: boolean
  job: JobRow
  [key: string]: unknown
}

/** Delovno mesto */
export interface JobRow {
  id: string
  name: string
  permissions?: string
  basePayRate?: number
  [key: string]: unknown
}

/** Menijska postavka */
export interface MenuItemRow {
  id: string
  name: string
  nameSl?: string
  nameEn?: string
  price: number
  cost?: number
  category?: string
  categoryId?: string
  allergens?: string[]
  image?: string
  available?: boolean
  popularity?: number
  foodCost?: number
  description?: string
  ingredients?: RecipeIngredientRow[]
  [key: string]: unknown
}

/** Kategorija menija */
export interface CategoryRow {
  id: string
  name: string
  slug?: string
  icon?: string
  color?: string
  sortOrder?: number
  [key: string]: unknown
}

/** Inventarna postavka */
export interface InventoryItemRow {
  id: string
  name: string
  unit?: string
  quantity?: number
  minQuantity?: number
  costPerUnit?: number
  supplierId?: string
  category?: string
  expiryDate?: string
  [key: string]: unknown
}

/** Dobavitelj */
export interface SupplierRow {
  id: string
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  leadTimeDays?: number
  rating?: number
  [key: string]: unknown
}

/** Nabavno naročilo */
export interface PurchaseOrderRow {
  id: string
  supplierId: string
  status: string
  total?: number
  createdAt: string
  deliveredAt?: string
  expectedDelivery?: string
  expectedDate?: string
  receivedDate?: string
  orderDate?: string
  items?: PurchaseOrderItemRow[]
  [key: string]: unknown
}

/** Postavka nabavnega naročila */
export interface PurchaseOrderItemRow {
  id: string
  inventoryItemId?: string
  quantity: number
  unitPrice: number
  total: number
  [key: string]: unknown
}

/** Izmena */
export interface ShiftRow {
  id: string
  employeeId: string
  startTime: string
  endTime?: string
  status?: string
  shiftType?: string
  employeeName?: string
  openedAt?: string
  closedAt?: string
  durationMinutes?: number
  startingCash?: number
  closingCash?: number
  cashSales?: number
  cardSales?: number
  totalSales?: number
  totalTips?: number
  cashDifference?: number
  locationId?: string
  [key: string]: unknown
}

/** Časovni vnos */
export interface TimeEntryRow {
  id: string
  employeeId: string
  clockIn: string
  clockOut?: string
  hours?: number
  [key: string]: unknown
}

/** Rezervacija */
export interface ReservationRow {
  id: string
  tableId?: string
  tableName?: string
  guestName: string
  guestPhone?: string
  partySize: number
  dateTime: string
  status?: string
  notes?: string
  [key: string]: unknown
}

/** Gost */
export interface GuestRow {
  id: string
  name: string
  email?: string
  phone?: string
  loyaltyPoints?: number
  totalSpent?: number
  visitCount?: number
  lastVisit?: string
  notes?: string
  [key: string]: unknown
}

/** Obisk gosta */
export interface GuestVisitRow {
  id: string
  date: string
  amount: number
  items?: string[]
  arrivedAt?: string
  employeeName?: string
  totalSpent?: number
  feedbackScore?: number
  [key: string]: unknown
}

/** Lojalnostni račun */
export interface LoyaltyAccountRow {
  id: string
  points: number
  tier?: string
  [key: string]: unknown
}

/** Strošek / Izdatek */
export interface ExpenseRow {
  id: string
  category: string
  amount: number
  date: string
  description?: string
  supplierId?: string
  [key: string]: unknown
}

/** Recept / Sestavina */
export interface RecipeIngredientRow {
  id?: string
  inventoryItemId?: string
  name: string
  quantity: number
  unit?: string
  costPerUnit?: number
  totalCost: number
  [key: string]: unknown
}

/** Ocena dobavitelja */
export interface SupplierScoreRow {
  id: string
  name: string
  onTimeRate: number
  qualityScore: number
  totalSpent: number
  orderCount: number
  avgDeliveryDays: number
  lastOrderDate?: string
  [key: string]: unknown
}

/** Z-report */
/** Recept iz API-ja */
export interface RecipeRow {
  id: string
  name?: string
  servings?: number
  yield?: number
  category?: string
  ingredients?: RecipeIngredientRow[]
  items?: RecipeIngredientRow[]
  prepTime?: number
  cookTime?: number
  instructions?: string[]
  steps?: string[]
  sellingPrice?: number
  price?: number
  [key: string]: unknown
}

export interface ZReportRow {
  id: string
  date: string
  createdAt?: string
  totalRevenue: number
  totalOrders: number
  payments?: Record<string, number>
  [key: string]: unknown
}

/** Cenovna skupina */
export interface PriceGroupRow {
  id: string
  name: string
  markup?: number
  [key: string]: unknown
}

/** Dobavna cona */
export interface DeliveryZoneRow {
  id: string
  name: string
  radius?: number
  fee?: number
  deliveryFee?: number
  minOrder?: number
  minOrderAmount?: number
  freeDeliveryAbove?: number
  estimatedMinutes?: number
  postCodes?: string
  cities?: string
  locationId?: string
  isActive?: boolean
  [key: string]: unknown
}

/** Lokacija */
export interface LocationRow {
  id: string
  name: string
  address?: string
  phone?: string
  isActive?: boolean
  [key: string]: unknown
}

/** Faktura / Invoice */
export interface InvoiceRow {
  id: string
  number?: string
  invoiceNumber?: string
  amount?: number
  totalAmount?: number
  date: string
  periodStart?: string
  periodEnd?: string
  dueDate?: string
  status: string
  [key: string]: unknown
}

/** Rezultat sinhronizacije */
export interface SyncResultRow {
  success: boolean
  message?: string
  error?: string
  results?: SyncResultItem[]
  [key: string]: unknown
}

export interface SyncResultItem {
  id?: string
  status: string
  message?: string
  targetLocationName?: string
  menusCreated?: number
  categoriesCreated?: number
  itemsCreated?: number
  itemsUpdated?: number
  [key: string]: unknown
}

/** Validacijska napaka (FURS) */
export interface ValidationErrorRow {
  field: string
  message: string
  code?: string
  [key: string]: unknown
}

/** Nastavitve restavracije */
export interface RestaurantSettingsRow {
  id?: string
  name?: string
  isOpen?: boolean
  currency?: string
  taxRate?: number
  deliveryEnabled?: boolean
  takeawayEnabled?: boolean
  [key: string]: unknown
}

/** Delovni čas */
export interface WeeklyHoursRow {
  day: string
  open: string
  close: string
  isClosed?: boolean
  [key: string]: unknown
}

/** Rezultat naročanja */
export interface OrderResultRow {
  orderId: string
  orderNumber?: string
  estimatedTime?: string
  message?: string
  order?: {
    id?: string
    orderNumber?: number | string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Obrazec za čakalno vrsto */
export interface WaitlistFormRow {
  name?: string
  guestName?: string
  guestPhone?: string
  partySize: number
  phone?: string
  quotedWaitMinutes?: number
  preferredArea?: string
  specialNeeds?: string
  notes?: string
  [key: string]: unknown
}

/** Obrazec za goste */
export interface GuestFormRow {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  allergens?: string[]
  dietaryPrefs?: string[]
  dislikes?: string[]
  favoriteItems?: string[]
  company?: string
  birthday?: string
  anniversary?: string
  isVip?: boolean
  notes?: string
  [key: string]: unknown
}

/** Obrazec za naročnino */
export interface SubscriptionFormRow {
  planId?: string
  companyName?: string
  email?: string
  phone?: string
  taxId?: string
  businessId?: string
  locationCount?: number
  paymentMethod?: string
  [key: string]: unknown
}

/** Obrazec za lokacijo */
export interface LocationFormRow {
  name: string
  address?: string
  phone?: string
  [key: string]: unknown
}

/** Obrazec za dobavno cono */
export interface DeliveryZoneFormRow {
  name: string
  radius?: number
  fee?: number
  minOrder?: number
  [key: string]: unknown
}

// --- Pomožni tipi za komponente ---

/** Ikona v konfiguraciji komponente */
export interface IconConfig<_T extends string = string> {
  label: string
  icon: LucideIcon
  color?: string
  desc?: string
  step?: number
}

/** Komponenta z ikono (za stat kartice) */
export interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  color: string
}

/** Komponenta za plačilno vrstico */
export interface PaymentRowProps {
  icon: LucideIcon
  label: string
  value: number
  total: number
  color: string
}

/** PWA beforeinstallprompt dogodek */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Razširjen Window za vendor prefixes */
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
    deferredPrompt?: BeforeInstallPromptEvent
  }
}
