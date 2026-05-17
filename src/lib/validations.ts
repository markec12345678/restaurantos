// ============================================
// ZOD VALIDACIJSKE SHEME ZA POS API
// Profesionalna validacija vnosa za vse rute
// ============================================

import { z } from 'zod'

// ============================================
// SKUPNI TIPI
// ============================================

const positiveNumber = z.number().min(0.01, 'Vrednost mora biti pozitivna')
const nonEmptyString = z.string().min(1, 'Polje je obvezno')
const optionalString = z.string().default('')
const cuid = z.string().min(1, 'ID je obvezen')

// ============================================
// NAROČILA (Orders)
// ============================================

export const createOrderItemSchema = z.object({
  menuItemId: cuid,
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(99, 'Količina ne more preseči 99'),
  price: positiveNumber.optional(), // FIX HIGH: Price je opcijski — strežnik uporabi ceno iz baze (edini vir resnice)
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().default('[]'),
})

export const createOrderSchema = z.object({
  type: z.enum(['dine-in', 'takeout', 'delivery']).default('dine-in'),
  tableId: z.string().nullable().optional(),
  diningOptionId: z.string().nullable().optional(),
  revenueCenterId: z.string().nullable().optional(),
  customerName: z.string().max(100).default(''),
  customerPhone: z.string().max(30).default(''),
  customerEmail: z.string().max(200).default(''), // FIX MEDIUM: Manjkajoče polje za e-pošto stranke
  notes: z.string().max(1000).default(''),
  employeeId: z.string().nullable().optional(),
  discount: z.number().min(0).default(0),
  tip: z.number().min(0).default(0),
  orderItems: z.array(createOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel'),
})

export const updateOrderSchema = z.object({
  status: z.enum(['pending', 'in-progress', 'ready', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'storno']).optional(), // FIX BUG 17: Dodan 'storno'
  paymentMethod: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  cancelReason: z.string().max(500).optional(),
  cancelledBy: z.string().max(100).optional(),
  // discount, tip, totalWithTip se izračunajo strežniško — NE sprejemamo od klienta
})

export const addOrderItemsSchema = z.object({
  orderItems: z.array(createOrderItemSchema).min(1, 'Dodajte vsaj en artikel'),
})

// ============================================
// ČEKI (Checks)
// ============================================

export const createCheckSchema = z.object({
  orderId: cuid,
  orderItemIds: z.array(cuid).optional(), // ID-ji OrderItem-ov za ta ček
  appliedDiscountId: z.string().nullable().optional(),
  // Zneski se izračunajo strežniško iz povezanih OrderItem-ov
})

export const updateCheckSchema = z.object({
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'storno']).optional(), // FIX BUG 17: Dodan 'storno'
  paymentMethod: z.string().max(50).optional(),
  appliedDiscountId: z.string().nullable().optional(),
  // Ostali zneski se izračunajo strežniško
})

// ============================================
// PLAČILA (Payments)
// ============================================

export const createPaymentSchema = z.object({
  checkId: cuid,
  amount: z.number().positive('Znesek plačila mora biti pozitiven'),
  tipAmount: z.number().min(0).default(0),
  type: z.enum(['cash', 'card', 'mobile', 'voucher', 'loyalty', 'giftcard', 'alternate']),
  alternatePaymentTypeId: z.string().nullable().optional(),
  cardType: z.string().max(30).default(''),
  cardLast4: z.string().max(4).default(''),
  authorizationCode: z.string().max(50).default(''),
  giftCardId: z.string().nullable().optional(),
  loyaltyAccountId: z.string().nullable().optional(),
  loyaltyPointsUsed: z.number().int().min(0).default(0),
  employeeId: z.string().nullable().optional(),
})

// ============================================
// MIZE (Tables)
// ============================================

export const createTableSchema = z.object({
  number: z.number().int().min(1, 'Številka mize mora biti vsaj 1').max(999),
  capacity: z.number().int().min(1, 'Kapaciteta mora biti vsaj 1').max(50).default(4),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']).default('available'),
  area: z.string().max(50).default('main'),
  // FIX HIGH: Vizualni tloris — validiraj z Zod namesto direktnega branja iz body-ja
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(1).max(50).optional(),
  height: z.number().min(1).max(50).optional(),
  shape: z.enum(['round', 'square', 'rectangular', 'booth']).optional(),
  rotation: z.number().min(0).max(360).optional(),
})

export const updateTableSchema = z.object({
  number: z.number().int().min(1).max(999).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']).optional(),
  area: z.string().max(50).optional(),
  // FIX HIGH: Vizualni tloris — validiraj z Zod
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(1).max(50).optional(),
  height: z.number().min(1).max(50).optional(),
  shape: z.enum(['round', 'square', 'rectangular', 'booth']).optional(),
  rotation: z.number().min(0).max(360).optional(),
})

// ============================================
// ZAPOSLENI (Employees)
// ============================================

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Ime mora imeti vsaj 2 znaka').max(100),
  email: z.string().email('Neveljaven email naslov'),
  phone: z.string().max(30).default(''),
  role: z.enum(['admin', 'manager', 'staff', 'kitchen']).default('staff'),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  pin: z.string().min(4, 'PIN mora imeti vsaj 4 števke').max(20).optional(),
  hireDate: z.string().optional(),
  jobId: z.string().optional(),
  payRate: z.number().min(0).optional(),
})

export const updateEmployeeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  role: z.enum(['admin', 'manager', 'staff', 'kitchen']).optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  pin: z.string().min(4).max(20).optional(),
  hireDate: z.string().optional(),
})

// ============================================
// MENU ARTIKLI
// ============================================

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  description: z.string().max(1000).default(''),
  price: z.number().min(0.01, 'Cena mora biti pozitivna'),
  image: z.string().default(''),
  isAvailable: z.boolean().default(true),
  vatRate: z.number().min(0).max(100).default(22.0),
  allergens: z.string().default(''),
  categoryId: cuid,
  salesCategoryId: z.string().nullable().optional(),
  priceGroupId: z.string().nullable().optional(),
  revenueCenterId: z.string().nullable().optional(),
  prepStationId: z.string().nullable().optional(),
})

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
})

// ============================================
// DARILNE KARTICE
// ============================================

export const createGiftCardSchema = z.object({
  cardNumber: z.string().min(1, 'Številka kartice je obvezna').max(50),
  balance: z.number().min(0).default(0),
  initialBalance: z.number().min(0).optional(),
  status: z.enum(['active', 'depleted', 'expired', 'suspended']).default('active'),
  ownerName: z.string().max(100).default(''),
  expiresAt: z.string().nullable().optional(),
})

export const updateGiftCardSchema = z.object({
  balance: z.number().min(0).optional(),
  status: z.enum(['active', 'depleted', 'expired', 'suspended']).optional(),
  ownerName: z.string().max(100).optional(),
  expiresAt: z.string().nullable().optional(),
  transaction: z.object({
    type: z.enum(['load', 'redeem', 'adjust', 'transfer']),
    amount: z.number(),
    balanceAfter: z.number().optional(),
    orderId: z.string().nullable().optional(),
    checkId: z.string().nullable().optional(),
    note: z.string().default(''),
  }).optional(),
})

// ============================================
// ZVESTOBNI RAČUNI
// ============================================

export const createLoyaltySchema = z.object({
  customerName: z.string().max(100).default(''),
  customerPhone: z.string().max(30).default(''),
  customerEmail: z.string().email().optional().or(z.literal('')),
  // FIX MEDIUM: pointsBalance in lifetimePoints se nastavijo strežniško na 0
  // Klient NE sme nastavljati začetnih točk — točke se pridobijo samo skozi loyalty earn API
  isActive: z.boolean().default(true),
})

export const updateLoyaltySchema = z.object({
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional().or(z.literal('')).optional(),
  pointsBalance: z.number().int().min(0).optional(),
  lifetimePoints: z.number().int().min(0).optional(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  isActive: z.boolean().optional(),
  transaction: z.object({
    type: z.enum(['earn', 'redeem', 'adjust', 'expire']),
    points: z.number().int(),
    reason: z.string().default(''),
    orderId: z.string().nullable().optional(),
    checkId: z.string().nullable().optional(),
    monetaryValue: z.number().min(0).default(0),
  }).optional(),
})

// ============================================
// INVENTURA
// ============================================

export const createInventorySchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  description: z.string().max(1000).default(''),
  unit: z.string().max(30).default('pcs'),
  quantity: z.number().min(0).default(0),
  minQuantity: z.number().min(0).default(10),
  costPerUnit: z.number().min(0).default(0),
  supplier: z.string().max(200).default(''),
  category: z.string().max(100).default('general'),
  location: z.string().max(100).default('main'), // FIX MEDIUM: Dodana validacija za lokacijo
  servingsPerUnit: z.number().min(0).default(1),
  servingSize: z.string().max(50).default(''),
  menuItemId: z.string().nullable().optional(),
})

export const updateInventorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  unit: z.string().max(30).optional(),
  quantity: z.number().min(0).optional(),
  minQuantity: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  location: z.string().max(100).optional(), // FIX MEDIUM: Dodana validacija za lokacijo
  servingsPerUnit: z.number().min(0).optional(),
  servingSize: z.string().max(50).optional(),
  menuItemId: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  image: z.string().optional(),
})

export const inventoryAdjustSchema = z.object({
  inventoryItemId: cuid,
  quantity: z.number().positive().optional(),
  type: z.enum(['write-off', 'adjustment', 'return']).default('write-off'),
  reason: z.string().max(500).default(''),
  note: z.string().max(500).default(''),
  employeeName: z.string().max(100).default(''),
  supplierDoc: z.string().max(100).default(''),
  newQuantity: z.number().min(0).optional(),
})

export const batchAdjustSchema = z.object({
  items: z.array(z.object({
    inventoryItemId: cuid,
    quantity: z.number().positive(),
    reason: z.string().max(500).optional(),
    note: z.string().max(500).optional(),
  })).min(1, 'Seznam artiklov ne sme biti prazen'),
  type: z.enum(['write-off', 'adjustment', 'return']).default('write-off'),
  reason: z.string().max(500).default(''),
  employeeName: z.string().max(100).default(''),
})

// ============================================
// RAČUNI (Receipts)
// ============================================

export const createReceiptSchema = z.object({
  paymentMethod: z.string().max(50).default('gotovina'),
  isStorno: z.boolean().default(false),
  stornoOf: z.string().max(50).default(''),
})

// ============================================
// AUTH
// ============================================

export const loginSchema = z.object({
  pin: z.string().min(4, 'PIN mora imeti vsaj 4 števke').max(20),
})

// ============================================
// INVENTURA — DOSTAVA (Restock)
// ============================================

export const inventoryRestockSchema = z.object({
  inventoryItemId: cuid,
  quantity: z.number().positive('Količina mora biti pozitivna'),
  reason: z.string().max(500).default('Dostava'),
  note: z.string().max(500).default(''),
  employeeName: z.string().max(100).default(''),
  supplierDoc: z.string().max(100).default(''),
})

// ============================================
// NASTAVITVE (Settings)
// ============================================

export const updateSettingsSchema = z.object({
  name: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  web: z.string().max(200).optional(),
  businessId: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  registerNumber: z.string().max(50).optional(),
  fursCertPath: z.string().max(500).optional(),
  fursCertPassword: z.string().max(200).optional(),
  fursEnvironment: z.enum(['test', 'production']).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  reducedVatRate: z.number().min(0).max(100).optional(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerEuro: z.number().int().min(0).optional(),
  loyaltyPointsValue: z.number().min(0).optional(),
  receiptFooter: z.string().max(1000).optional(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
  country: z.enum(['SI', 'HR', 'IT', 'AT', 'DE']).optional(),
})

// ============================================
// HACCP
// ============================================

export const createHaccpSchema = z.object({
  date: z.string().optional(),
  category: z.enum(['temperature', 'cleaning', 'delivery', 'cooling', 'training']),
  title: z.string().min(1, 'Naslov je obvezen').max(200),
  description: z.string().max(1000).default(''),
  value: z.string().max(200).default(''),
  status: z.enum(['ok', 'warning', 'critical']).default('ok'),
  correctiveAction: z.string().max(1000).default(''),
  employeeName: z.string().max(100).default(''),
})

// ============================================
// POPUSTI (Discounts)
// ============================================

export const createDiscountSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  type: z.enum(['percentage', 'fixed_amount', 'buy_x_get_y']),
  amount: z.number().min(0.01, 'Znesek mora biti pozitiven'),
  appliesTo: z.enum(['check', 'item', 'category']).default('check'),
  triggerType: z.enum(['manual', 'auto', 'promo_code']).default('manual'),
  promoCode: z.string().max(50).default(''),
  maxUses: z.number().int().min(0).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
})

// ============================================
// IZMENE IN ČASOVNI VNOSI (Shifts, Time Entries)
// ============================================

export const createShiftSchema = z.object({
  employeeId: cuid,
  jobId: z.string().nullable().optional(),
  date: z.string(),
  startTime: z.string().max(10).default('09:00'),
  endTime: z.string().max(10).default('17:00'),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'absent']).default('scheduled'),
  breakMinutes: z.number().int().min(0).default(30),
  notes: z.string().max(500).default(''),
})

export const createTimeEntrySchema = z.object({
  employeeId: cuid,
  jobId: z.string().nullable().optional(),
  clockIn: z.string(),
  clockOut: z.string().nullable().optional(),
  breakStart: z.string().nullable().optional(),
  breakEnd: z.string().nullable().optional(),
  breakMinutes: z.number().int().min(0).default(0),
  type: z.enum(['regular', 'overtime', 'holiday', 'sick', 'vacation']).default('regular'),
  status: z.enum(['active', 'approved', 'disputed']).default('active'),
  notes: z.string().max(500).default(''),
})

// ============================================
// FURS
// ============================================

export const fursVerifySchema = z.object({
  orderId: cuid,
})

export const fursStornoSchema = z.object({
  orderId: cuid,
  reason: z.string().max(500).optional(),
  reasonCode: z.string().max(50).optional(),
}).refine(data => data.reason || data.reasonCode, {
  message: 'Razlog za storno je obvezen (FURS zahteva)',
})

// ============================================
// ORDER ITEM UPDATE
// ============================================

export const updateOrderItemSchema = z.object({
  status: z.enum(['pending', 'fired', 'preparing', 'ready', 'served', 'voided', 'cancelled']).optional(),
  notes: z.string().max(500).optional(),
  voided: z.boolean().optional(),
  voidReasonId: z.string().nullable().optional(),
  voidReasonText: z.string().max(200).optional(),
})

// ============================================
// GOSTI (Guests / CRM)
// ============================================

export const createGuestSchema = z.object({
  firstName: z.string().max(100).default(''),
  lastName: z.string().min(1, 'Priimek je obvezen').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).default(''),
  isVip: z.boolean().default(false),
  allergens: z.array(z.string()).default([]),
  dietaryPrefs: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  favoriteItems: z.array(z.string()).default([]),
  birthday: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
  company: z.string().max(200).default(''),
  notes: z.string().max(1000).default(''),
})

export const updateGuestSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  isVip: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  dietaryPrefs: z.array(z.string()).optional(),
  dislikes: z.array(z.string()).optional(),
  favoriteItems: z.array(z.string()).optional(),
  birthday: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
})

// ============================================
// REZERVACIJE (Reservations)
// ============================================

export const createReservationSchema = z.object({
  customerName: z.string().min(1, 'Ime stranke je obvezno').max(100),
  customerPhone: z.string().max(30).default(''),
  customerEmail: z.string().email().optional().or(z.literal('')).default(''),
  tableId: z.string().nullable().optional(),
  dateTime: z.string().min(1, 'Datum/čas je obvezen'),
  partySize: z.number().int().min(1, 'Število oseb mora biti vsaj 1').max(100),
  duration: z.number().int().min(15).max(600).default(120),
  notes: z.string().max(1000).default(''),
  specialRequests: z.string().max(500).default(''),
  source: z.enum(['walk_in', 'phone', 'website', 'app']).default('walk_in'),
})

export const updateReservationSchema = z.object({
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional().or(z.literal('')).optional(),
  tableId: z.string().nullable().optional(),
  dateTime: z.string().optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  duration: z.number().int().min(15).max(600).optional(),
  notes: z.string().max(1000).optional(),
  specialRequests: z.string().max(500).optional(),
  status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
})

// ============================================
// ČAKALNA VRSTA (Waitlist)
// ============================================

export const createWaitlistSchema = z.object({
  guestName: z.string().min(1, 'Ime gosta je obvezno').max(100),
  guestPhone: z.string().max(30).default(''),
  partySize: z.number().int().min(1, 'Število oseb mora biti vsaj 1').max(50),
  quotedWaitMinutes: z.number().int().min(0).default(0),
  preferredArea: z.string().max(50).default(''),
  specialNeeds: z.string().max(500).default(''),
  notes: z.string().max(500).default(''),
})

// ============================================
// NABAVNA NAROČILA (Purchase Orders)
// ============================================

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Dobavitelj je obvezen'),
  items: z.array(z.object({
    description: z.string().min(1).max(200),
    inventoryItemId: z.string().nullable().optional(),
    quantityOrdered: z.number().positive('Količina mora biti pozitivna'),
    unit: z.string().max(30).default('kos'),
    unitPrice: z.number().min(0).default(0),
    vatRate: z.number().min(0).max(100).default(22.0),
    notes: z.string().max(500).default(''),
  })).min(1, 'Naročilo mora vsebovati vsaj eno postavko'),
  expectedDate: z.string().nullable().optional(),
  deliveryAddress: z.string().max(200).default(''),
  deliveryNotes: z.string().max(500).default(''),
  notes: z.string().max(1000).default(''),
})

// ============================================
// DOBAVITELJI (Suppliers)
// ============================================

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Ime dobavitelja je obvezno').max(200),
  code: z.string().max(50).default(''),
  contactPerson: z.string().max(100).default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  phone: z.string().max(30).default(''),
  address: z.string().max(200).default(''),
  city: z.string().max(100).default(''),
  postCode: z.string().max(20).default(''),
  country: z.string().max(100).default('Slovenija'),
  businessId: z.string().max(50).default(''),
  taxId: z.string().max(50).default(''),
  iban: z.string().max(34).default(''),
  bank: z.string().max(100).default(''),
  paymentTerms: z.string().max(100).default('30 dni'),
  deliveryDays: z.string().max(200).default('[]'),
  minOrderAmount: z.number().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
  isActive: z.boolean().default(true),
})

export const updateSupplierSchema = z.object({
  name: z.string().max(200).optional(),
  code: z.string().max(50).optional(),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  businessId: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  iban: z.string().max(34).optional(),
  bank: z.string().max(100).optional(),
  paymentTerms: z.string().max(100).optional(),
  deliveryDays: z.string().max(200).optional(),
  minOrderAmount: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// DOBAVA (Delivery)
// ============================================

export const createDeliverySchema = z.object({
  address: z.string().min(1, 'Naslov je obvezen').max(300),
  city: z.string().max(100).default(''),
  postCode: z.string().max(20).default(''),
  recipientName: z.string().max(100).default(''),
  recipientPhone: z.string().max(30).default(''),
  deliveryInstructions: z.string().max(500).default(''),
  promisedTime: z.string().nullable().optional(),
  estimatedTime: z.string().nullable().optional(),
  courierName: z.string().max(100).default(''),
  courierPhone: z.string().max(30).default(''),
  status: z.enum(['pending', 'preparing', 'ready', 'picked_up', 'delivered', 'failed']).default('pending'),
  packagingFee: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})

export const updateDeliverySchema = z.object({
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  recipientName: z.string().max(100).optional(),
  recipientPhone: z.string().max(30).optional(),
  deliveryInstructions: z.string().max(500).optional(),
  promisedTime: z.string().nullable().optional(),
  estimatedTime: z.string().nullable().optional(),
  actualTime: z.string().nullable().optional(),
  courierName: z.string().max(100).optional(),
  courierPhone: z.string().max(30).optional(),
  status: z.enum(['pending', 'preparing', 'ready', 'picked_up', 'delivered', 'failed']).optional(),
  packagingFee: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})

// ============================================
// EOD (End of Day)
// ============================================

export const eodCloseSchema = z.object({
  date: z.string().max(10).optional(),
  closingCash: z.number().min(0).optional(),
  totalTips: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
})

// ============================================
// HAPPY HOUR SCHEDULE
// ============================================

export const createHappyHourSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  description: z.string().max(1000).default(''),
  priceGroupId: z.string().min(1, 'Cenik je obvezen'),
  discountType: z.enum(['none', 'percentage', 'fixed_amount']).default('none'),
  discountAmount: z.number().min(0).default(0),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1, 'Vsaj en dan je obvezen').default([1, 2, 3, 4, 5]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM je obvezen'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM je obvezen'),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  appliesTo: z.enum(['all', 'category', 'item']).default('all'),
  appliesToIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  autoActivate: z.boolean().default(true),
})

// ============================================
// REORDER (Smart Reorder)
// ============================================

export const createReorderSchema = z.object({
  items: z.array(z.object({
    inventoryItemId: z.string().min(1, 'ID artikla je obvezen'),
    quantity: z.number().positive('Količina mora biti pozitivna'),
    costPerUnit: z.number().min(0, 'Cena na enoto mora biti nenegativna'),
  })).min(1, 'Seznam artiklov ne sme biti prazen'),
  employeeName: z.string().max(100).default(''),
})

// ============================================
// SHIFT UPDATE
// ============================================

export const updateShiftSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().max(10).optional(),
  endTime: z.string().max(10).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'absent']).optional(),
  jobId: z.string().nullable().optional(),
  breakMinutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().max(500).optional(),
})

// ============================================
// ORDER PATCH ACTIONS (KDS)
// ============================================

export const orderPatchActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('item_status'),
    itemId: z.string().min(1, 'ID artikla je obvezen'),
    status: z.enum(['pending', 'fired', 'preparing', 'ready', 'served', 'cancelled']),
  }),
  z.object({
    action: z.literal('fire'),
  }),
])

// ============================================
// HELPER: Varno parsnje z Zod
// ============================================

import { NextResponse } from 'next/server'

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { data: T; error: NextResponse | null } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const errors = result.error.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return {
      data: null as T,
      error: NextResponse.json(
        { error: 'Neveljavni podatki', validationErrors: errors },
        { status: 400 }
      ),
    }
  }
  return { data: result.data, error: null }
}
