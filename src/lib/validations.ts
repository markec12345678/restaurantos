// ============================================
// ZOD VALIDACIJSKE SHEME ZA POS API
// Profesionalna validacija vnosa za vse rute
// ============================================

import { z } from 'zod'

// ============================================
// SKUPNI TIPI
// ============================================

const positiveNumber = z.number().min(0.01, 'Vrednost mora biti pozitivna')
const cuid = z.string().min(1, 'ID je obvezen')

// ============================================
// NAROČILA (Orders)
// ============================================

export const createOrderItemSchema = z.object({
  menuItemId: cuid,
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(99, 'Količina ne more preseči 99'),
  price: positiveNumber.optional(), // FIX HIGH: Price je opcijski — strežnik uporabi ceno iz baze (edini vir resnice)
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().default('[]').refine(val => {
    try { JSON.parse(val); return true } catch { return false }
  }, 'modifiersJson mora biti veljaven JSON'),
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
  discount: z.number().min(0).max(100000, 'Popust ne more preseči 100.000').default(0),
  tip: z.number().min(0).max(100000, 'Napitnina ne more preseči 100.000').default(0),
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
  // FIX: Allow tip and totalWithTip from PaymentDialog (set during payment processing)
  tip: z.number().min(0).optional(),
  totalWithTip: z.number().min(0).optional(),
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
  // FIX HIGH: Idempotency key — prepreči duplikatna plačila ob double-click
  idempotencyKey: z.string().max(100).optional(),
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
  pin: z.string().min(4, 'PIN mora imeti vsaj 4 števke').max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke').optional(),
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
  // FIX HIGH: Validacija EU alergen kod — prejšnja regex je dovoljevala katerikoli 1-2 številki (npr. 15, 99, 0)
  // EU kode: 1-14 (Regulation 1169/2011 Annex II) — invalid kode so varnostno tveganje (alergiji)
  allergens: z.string().refine(val => {
    if (!val) return true
    return val.split(',').every(code => {
      const n = parseInt(code.trim(), 10)
      return n >= 1 && n <= 14
    })
  }, 'Alergeni morajo biti vejiko ločene EU kode 1-14').default(''),
  categoryId: cuid,
  salesCategoryId: z.string().nullable().optional(),
  priceGroupId: z.string().nullable().optional(),
  revenueCenterId: z.string().nullable().optional(),
  prepStationId: z.string().nullable().optional(),
})

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
  modifierGroupIds: z.array(z.string().min(1)).optional(),
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
    amount: z.number().positive('Znesek transakcije mora biti pozitiven'),
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
  pin: z.string().min(4, 'PIN mora imeti vsaj 4 števke').max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke'),
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
}).refine(data => {
  // FIX BUG-8: Odstotkov popust ne sme biti > 100%
  if (data.type === 'percentage' && data.amount > 100) {
    return false
  }
  return true
}, { message: 'Odstotek popusta ne sme preseči 100%', path: ['amount'] })

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
  date: z.string().min(1, 'Datum je obvezen').max(10)
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), 'Datum mora biti v formatu YYYY-MM-DD'),
  actualCash: z.number().min(0, 'Dejanska gotovina ne more biti negativna').max(1000000, 'Znesek presega omejitev').optional(),
  closingCash: z.number().min(0).optional(),
  totalTips: z.number().min(0).optional(),
  notes: z.string().max(2000, 'Opombe ne smejo preseči 2000 znakov').default(''),
  locationId: z.string().max(100).optional(),
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
// MODIFIKATORJI (Modifier Groups) — FIX CRITICAL: Input validation
// ============================================

const modifierSchema = z.object({
  name: z.string().min(1, 'Ime modifikatorja je obvezno').max(100, 'Ime ne sme preseči 100 znakov'),
  price: z.number().min(0, 'Cena ne more biti negativna').max(10000, 'Cena ne more preseči 10.000'),
  sortOrder: z.number().int().min(0).max(9999).default(0),
})

export const createModifierGroupSchema = z.object({
  name: z.string().min(1, 'Ime skupine je obvezno').max(100, 'Ime ne sme preseči 100 znakov'),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).max(50).default(0),
  maxSelect: z.number().int().min(0).max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  modifiers: z.array(modifierSchema).max(100, 'Največ 100 modifikatorjev').optional(),
  // FIX CRITICAL: Prepreči injection polj — menuItems povezave
  menuItemIds: z.array(z.string().min(1)).max(200).optional(),
})

export const updateModifierGroupSchema = z.object({
  name: z.string().min(1, 'Ime skupine je obvezno').max(100, 'Ime ne sme preseči 100 znakov').optional(),
  required: z.boolean().optional(),
  minSelect: z.number().int().min(0).max(50).optional(),
  maxSelect: z.number().int().min(0).max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  modifiers: z.array(modifierSchema).max(100, 'Največ 100 modifikatorjev').optional(),
  menuItemIds: z.array(z.string().min(1)).max(200).optional(),
})

// ============================================
// KARTIČNI TERMINAL (Card Terminal) — FIX HIGH: Input validation
// ============================================

export const cardTerminalPaymentSchema = z.object({
  amount: z.number().positive('Znesek mora biti večji od 0').max(100000, 'Znesek ne more preseči 100.000'),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF', 'HRK', 'RSD', 'BAM']).default('EUR'),
  orderId: z.string().min(1, 'OrderId je obvezen').max(100),
  orderNumber: z.number().int().min(1).optional(),
  tipAmount: z.number().min(0).max(10000).default(0),
  paymentType: z.enum(['sale', 'refund', 'void', 'preauth', 'capture']).default('sale'),
  referenceId: z.string().max(100).optional(),
})

// ============================================
// MENIJI (Menus) — FIX HIGH: Input validation
// ============================================

export const createMenuSchema = z.object({
  name: z.string().min(1, 'Ime menija je obvezno').max(100, 'Ime ne sme preseči 100 znakov'),
  icon: z.string().max(10, 'Ikona ne sme preseči 10 znakov').default('📋'),
  color: z.string().max(7, 'Barva mora biti hex format (#RRGGBB)').default('#f59e0b')
    .refine(val => /^#[0-9a-fA-F]{6}$/.test(val), 'Barva mora biti veljaven hex format'),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
})

export const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().max(7).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// ČASOVNI VNOSI (Time Entries) — FIX HIGH: payRate bounds
// ============================================

export const updateTimeEntrySchema = z.object({
  clockOut: z.string().nullable().optional(),
  payRate: z.number().min(0, 'Plačilna stopnja ne more biti negativna').max(500, 'Plačilna stopnja ne more preseči 500/h').optional(),
  notes: z.string().max(500).optional(),
})

// ============================================
// PAKIRANJE (Packaging) — FIX HIGH: Input validation
// ============================================

const packagingItemSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(100),
  price: z.number().min(0, 'Cena ne more biti negativna').max(1000),
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(999),
  sortOrder: z.number().int().min(0).max(9999).default(0),
})

export const createPackagingSchema = z.object({
  name: z.string().min(1, 'Ime pakiranja je obvezno').max(100),
  description: z.string().max(500).default(''),
  items: z.array(packagingItemSchema).max(50, 'Največ 50 artiklov').default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
})

export const updatePackagingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  items: z.array(packagingItemSchema).max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

// ============================================
// POVZETNA INFORMACIJA GOSTOV (Guest Feedback) — FIX MEDIUM: Zod validacija
// ============================================

export const createGuestFeedbackSchema = z.object({
  guestId: z.string().max(100).optional(),
  guestName: z.string().max(200).default(''),
  orderId: z.string().max(100).optional(),
  overallRating: z.number().int().min(1, 'Skupna ocena mora biti vsaj 1').max(5, 'Skupna ocena ne more preseči 5'),
  foodRating: z.number().int().min(0).max(5).default(0),
  serviceRating: z.number().int().min(0).max(5).default(0),
  atmosphereRating: z.number().int().min(0).max(5).default(0),
  comment: z.string().max(1000, 'Komentar ne sme preseči 1000 znakov').default(''),
  tags: z.array(z.string().max(50)).max(20, 'Največ 20 oznak').default([]),
  wouldReturn: z.boolean().default(true),
  wouldRecommend: z.boolean().default(true),
  source: z.enum(['pos', 'web', 'qr_kiosk', 'receipt']).default('pos'),
})

// ============================================
// HELPER: Varno parsnje z Zod
// ============================================

import { NextResponse } from 'next/server'
import { sanitizeObject } from './sanitize'

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { data: T; error: NextResponse | null } {
  // Sanatiziraj string vrednosti pred validacijo (XSS preprečevanje)
  let processedBody = body
  if (typeof body === 'object' && body !== null) {
    processedBody = sanitizeObject(body as Record<string, unknown>)
  }

  const result = schema.safeParse(processedBody)
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

// FIX HIGH: Helper za validacijo datumskega obsega poročil — prepreči prevelike poizvedbe
export function validateReportDateRange(startDate?: string | null, endDate?: string | null): NextResponse | null {
  // Če ni nobenega datuma, omejimo na zadnjih 366 dni
  if (!startDate && !endDate) {
    // Dovoljeno — privzeto bo route omejil na razumno obdobje
    return null
  }

  // Validiraj format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (startDate && !dateRegex.test(startDate)) {
    return NextResponse.json({ error: 'Začetni datum mora biti v formatu YYYY-MM-DD' }, { status: 400 })
  }
  if (endDate && !dateRegex.test(endDate)) {
    return NextResponse.json({ error: 'Končni datum mora biti v formatu YYYY-MM-DD' }, { status: 400 })
  }

  // Omejitev obdobja na 366 dni
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Neveljaven datum' }, { status: 400 })
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 366) {
      return NextResponse.json({ error: 'Obdobje ne sme preseči 366 dni. Uporabite manjše obdobje.' }, { status: 400 })
    }
    if (diffDays < 0) {
      return NextResponse.json({ error: 'Začetni datum mora biti pred končnim' }, { status: 400 })
    }
  }

  // Prepreči poizvedbe pred letom 2020
  const minDate = new Date('2020-01-01')
  if (startDate && new Date(startDate) < minDate) {
    return NextResponse.json({ error: 'Začetni datum ne more biti pred 2020' }, { status: 400 })
  }

  return null
}

// ============================================
// KATEGORIJE (Categories) — Premaknjeno iz /api/categories/route.ts
// Centralizirana shema za konsistentno validacijo in testiranje
// ============================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(100),
  icon: z.string().max(10).default('🍽️'),
  color: z.string().max(20).default('#f59e0b'),
  sortOrder: z.number().int().min(0).default(0),
  menuId: z.string().min(1, 'menuId je obvezen'),
})

// ============================================
// HACCP POSODOBITEV — Premaknjeno iz /api/haccp/route.ts
// Centralizirana shema za konsistentno validacijo in testiranje
// ============================================

export const haccpUpdateSchema = z.object({
  id: z.string().min(1, 'ID je obvezen'),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  value: z.string().max(200).optional(),
  status: z.enum(['ok', 'warning', 'critical']).optional(),
  correctiveAction: z.string().max(1000).optional(),
  employeeName: z.string().max(100).optional(),
})

// ============================================
// ODZIVNE SHEME (Response Validation)
// Varnostna validacija odzivov za ključne API rute
// ============================================

// ─── Avtentikacijski odziv (POST /api/auth) ───
export const authResponseSchema = z.object({
  success: z.boolean(),
  employee: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    primaryJob: z.object({
      id: z.string(),
      name: z.string(),
      payRate: z.number().nullable(),
    }).nullable(),
    permissions: z.array(z.string()),
  }).optional(),
  token: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

// ─── Status avtentikacije (GET /api/auth) ───
export const authStatusResponseSchema = z.object({
  authenticated: z.boolean(),
  authEnabled: z.boolean(),
  employeesWithPin: z.number(),
  availableRoles: z.array(z.string()).optional(),
  session: z.object({
    employeeId: z.string(),
    role: z.string(),
    permissions: z.array(z.string()),
  }).nullable(),
})

// ─── Dashboard odziv (GET /api/dashboard) ───
export const dashboardResponseSchema = z.object({
  // Osnovne finance
  todayRevenue: z.number(),
  todayTips: z.number(),
  todayTax: z.number(),
  todayDiscount: z.number(),
  // Štetja naročil
  totalOrders: z.number(),
  completedOrders: z.number(),
  cancelledOrders: z.number(),
  pendingOrders: z.number(),
  inProgressOrders: z.number(),
  readyOrders: z.number(),
  avgOrderValue: z.number(),
  // Mize
  activeTables: z.number(),
  totalTables: z.number(),
  // Zaloga
  lowStockItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    minQuantity: z.number(),
    unit: z.string().nullable(),
  })),
  // Zadnja naročila ( kompleksna Prisma struktura — dovoljeno kot array objektov)
  recentOrders: z.array(z.unknown()),
  // Dnevni prihodki
  dailyRevenue: z.array(z.object({
    date: z.string(),
    revenue: z.number(),
  })),
  // Analitika
  categoryBreakdown: z.array(z.object({
    name: z.string(),
    revenue: z.number(),
    count: z.number(),
  })),
  hourlyRevenue: z.array(z.object({
    hour: z.number(),
    label: z.string(),
    revenue: z.number(),
  })),
  vatBreakdown: z.array(z.object({
    rate: z.string(),
    base: z.number(),
    vat: z.number(),
  })),
  paymentMethodBreakdown: z.array(z.object({
    method: z.string(),
    total: z.number(),
  })),
  orderTypeBreakdown: z.array(z.object({
    type: z.string(),
    revenue: z.number(),
    count: z.number(),
  })),
  topSellingItems: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    revenue: z.number(),
  })),
  employeePerformance: z.array(z.object({
    name: z.string(),
    orders: z.number(),
    revenue: z.number(),
  })),
  avgWaitMinutes: z.number(),
  // FURS & Blagajna
  fursStatus: z.object({
    configured: z.boolean(),
    environment: z.string(),
    todayVerified: z.number(),
    todayUnverified: z.number(),
  }),
  activeShift: z.object({
    id: z.string(),
    openedAt: z.string(), // ISO datumski niz po JSON serializaciji
    startingCash: z.number(),
    cashSales: z.number(),
    cardSales: z.number(),
    totalSales: z.number(),
    totalOrders: z.number(),
  }).nullable(),
  // Stroški
  todayCogs: z.number(),
  grossProfit: z.number(),
  grossMargin: z.number(),
  // Napredna analitika — WoW primerjava
  wowComparison: z.object({
    thisWeek: z.object({
      revenue: z.number(),
      orders: z.number(),
      avgOrder: z.number(),
    }),
    lastWeek: z.object({
      revenue: z.number(),
      orders: z.number(),
      avgOrder: z.number(),
    }),
    changes: z.object({
      revenue: z.number(),
      orders: z.number(),
      avgOrder: z.number(),
    }),
    thisWeekDaily: z.array(z.object({
      date: z.string(),
      revenue: z.number(),
      orders: z.number(),
    })),
    lastWeekDaily: z.array(z.object({
      date: z.string(),
      revenue: z.number(),
      orders: z.number(),
    })),
  }),
  // Toplotni zemljevid
  heatmapData: z.array(z.object({
    day: z.number(),
    hour: z.number(),
    revenue: z.number(),
    orders: z.number(),
  })),
  // Gostje
  guestAnalytics: z.object({
    totalGuests: z.number(),
    repeatGuests: z.number(),
    guestReturnRate: z.number(),
  }),
})

// ─── Plačilo odziv (POST /api/payments) ───
export const paymentResponseSchema = z.object({
  id: z.string(),
  checkId: z.string(),
  amount: z.number(),
  tipAmount: z.number(),
  type: z.string(),
  status: z.string(),
  giftCardId: z.string().nullable(),
  loyaltyAccountId: z.string().nullable(),
  loyaltyPointsUsed: z.number(),
  employeeId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  check: z.object({
    id: z.string(),
    checkNumber: z.number().nullable(),
    orderId: z.string().nullable(),
  }).nullable().optional(),
  alternatePaymentType: z.unknown().nullable().optional(),
  giftCard: z.unknown().nullable().optional(),
  loyaltyAccount: z.unknown().nullable().optional(),
})

// ─── Plačila seznam odziv (GET /api/payments) ───
export const paymentsListResponseSchema = z.object({
  payments: z.array(z.unknown()),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

// ─── Račun odziv (GET /api/receipts/[id]) ───
export const receiptResponseSchema = z.object({
  receiptNumber: z.string(),
  receiptDate: z.string(),
  registerId: z.string(),
  businessName: z.string(),
  businessAddress: z.string(),
  businessId: z.string(),
  taxId: z.string(),
  zoi: z.string(),
  eor: z.string(),
  fiscalVerified: z.boolean(),
  orderNumber: z.number(),
  type: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  paymentMethod: z.string().nullable(),
  customerName: z.string().nullable(),
  table: z.object({ number: z.number(), area: z.string() }).nullable(),
  notes: z.string().nullable(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    vatRate: z.number(),
    basePrice: z.number(),
    vatAmount: z.number(),
    totalWithVat: z.number(),
    modifiers: z.array(z.unknown()),
    notes: z.string().nullable(),
    category: z.string(),
  })),
  subtotal: z.number(),
  vatBreakdown: z.record(z.string(), z.object({ base: z.number(), vat: z.number(), total: z.number() })),
  totalVat: z.number(),
  discount: z.number(),
  total: z.number(),
  tip: z.number(),
  totalWithTip: z.number(),
  receiptFooter: z.string(),
  isCopy: z.boolean(),
  isStorno: z.boolean(),
  stornoOf: z.string(),
})

// ─── Račun ustvarjen odziv (POST /api/receipts/[id]) ───
export const receiptCreatedResponseSchema = z.object({
  id: z.string(),
  receiptNumber: z.string(),
  orderId: z.string(),
  businessName: z.string(),
  total: z.number(),
  tip: z.number(),
  totalWithTip: z.number(),
  fiscalVerified: z.boolean(),
  isStorno: z.boolean(),
  createdAt: z.string(),
})

// Re-export iz api-utils za enostaven dostop iz API rut
export { validateRequest, parseJsonBody, validateApiResponse } from './api-utils'
