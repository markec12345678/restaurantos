// ============================================
// R147-b (epic #115 #34 Data portability) — SELECT WHITELISTI
// ============================================
// Ena konstanta na tabelo (GIFT_CARD_SELECT precedens): vsak izvoz vleče
// IZRECNO naštetih polj — nikoli select: true / brez selecta. S tem so
// skrivnosti in revizijska metadata strukturno izključeni (ne "pozabljeni").
//
// CENZURA (PII/sekretni kanon R147-a kontrakt):
//   • AuditLog: BREZ ipAddress, terminalId, previousHash, chainHash —
//     kurirana revija (polja userAgent v shemi NE OBSTAJA; preverjeno
//     prisma/schema.prisma :1860 — polja: timestamp, userId, action,
//     entityType, entityId, details, ipAddress, terminalId, previousHash,
//     chainHash, locationId). Hash veriga ostaja backup/restore domena (#35).
//   • GuestVisit: BREZ previousHash/chainHash (EU 852/2004 hash veriga =
//     integritetna metadata, ne poslovni podatek).
//   • Employee/Session/ApiKey/WebAuthn/BiometricCredential/RestaurantSettings
//     NISO del arhiva (izključeni na nivoju tabel — glej notes v
//     portability-sections.ts); zato tukaj ne obstajajo selecti zase.
//   • Guest/Reservation/WaitlistEntry/LoyaltyAccount PII polja (ime, email,
//     telefon, alergeni, opombe) so VKLJUČENA — to je lastnikov CRM podatek,
//     ki ga epic 'customers' izrecno zahteva (R147-a deviation 3).
//   • Snapshot polja employeeName (GuestVisit, StockTransaction) so del
//     zgodovinskega zapisa (forenzika) — vključena; PIN-i NIKOLI (niso niti
//     na teh modelih).
//
// `satisfies Prisma.XSelect` — tsc ujete tipkane napake (r146-b lekcija:
// "JournalLine relacija = 'journalEntry' — TS jo je ujel").
// ============================================

import { Prisma } from '@prisma/client'

// ── customers ──────────────────────────────────────────────────────────────

/** Guest — lokacijski CRM (locationId nullable; NULL viden samo globalno). */
export const GUEST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  isVip: true,
  vipSince: true,
  allergens: true,
  dietaryPrefs: true,
  dislikes: true,
  favoriteItems: true,
  birthday: true,
  anniversary: true,
  company: true,
  notes: true,
  totalVisits: true,
  totalSpent: true,
  avgCheckAmount: true,
  lastVisitAt: true,
  firstVisitAt: true,
  loyaltyAccountId: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GuestSelect

/** GuestVisit — obiski; scope RELACIJSKO prek guest.locationId (brez lastnega). */
export const GUEST_VISIT_SELECT = {
  id: true,
  guestId: true,
  orderId: true,
  tableId: true,
  partySize: true,
  totalSpent: true,
  tipAmount: true,
  feedbackScore: true,
  feedbackComment: true,
  employeeId: true,
  employeeName: true,
  arrivedAt: true,
  departedAt: true,
  durationMinutes: true,
  createdAt: true,
} satisfies Prisma.GuestVisitSelect

/** LoyaltyAccount — P1-7: račun per lokaciji (locationId nullable). */
export const LOYALTY_ACCOUNT_SELECT = {
  id: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  pointsBalance: true,
  lifetimePoints: true,
  tier: true,
  isActive: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LoyaltyAccountSelect

/** LoyaltyTransaction — scope RELACIJSKO prek loyaltyAccount.locationId. */
export const LOYALTY_TRANSACTION_SELECT = {
  id: true,
  loyaltyAccountId: true,
  type: true,
  points: true,
  reason: true,
  orderId: true,
  checkId: true,
  monetaryValue: true,
  createdAt: true,
} satisfies Prisma.LoyaltyTransactionSelect

/** Reservation — rezervacije (locationId nullable). */
export const RESERVATION_SELECT = {
  id: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  dateTime: true,
  partySize: true,
  duration: true,
  tableId: true,
  status: true,
  notes: true,
  specialRequests: true,
  source: true,
  employeeId: true,
  confirmedAt: true,
  reminderSent: true,
  reminderSentAt: true,
  actualArrival: true,
  actualDeparture: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReservationSelect

/** WaitlistEntry — čakanje (locationId nullable). */
export const WAITLIST_ENTRY_SELECT = {
  id: true,
  guestName: true,
  guestPhone: true,
  partySize: true,
  quotedWaitMinutes: true,
  actualWaitMinutes: true,
  preferredArea: true,
  specialNeeds: true,
  status: true,
  checkedInAt: true,
  notifiedAt: true,
  seatedAt: true,
  leftAt: true,
  tableId: true,
  reservationId: true,
  notes: true,
  employeeId: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WaitlistEntrySelect

/** GuestFeedback — povratne informacije (locationId nullable). */
export const GUEST_FEEDBACK_SELECT = {
  id: true,
  guestId: true,
  guestName: true,
  orderId: true,
  overallRating: true,
  foodRating: true,
  serviceRating: true,
  atmosphereRating: true,
  comment: true,
  tags: true,
  wouldReturn: true,
  wouldRecommend: true,
  responded: true,
  response: true,
  respondedAt: true,
  source: true,
  tableId: true,
  tableNumber: true,
  orderRef: true,
  status: true,
  resolvedById: true,
  resolvedByName: true,
  resolvedAt: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GuestFeedbackSelect

// ── menu ───────────────────────────────────────────────────────────────────

/** Menu — MODEL A NOT NULL locationId. */
export const MENU_SELECT = {
  id: true,
  name: true,
  icon: true,
  color: true,
  sortOrder: true,
  isActive: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MenuSelect

/** Category — scope RELACIJSKO prek menu.locationId. */
export const CATEGORY_SELECT = {
  id: true,
  name: true,
  icon: true,
  color: true,
  sortOrder: true,
  menuId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect

/** MenuItem — scope RELACIJSKO prek category.menu.locationId (tenant-scope.ts menuItemLocationFilter vzorec). */
export const MENU_ITEM_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  image: true,
  isAvailable: true,
  sortOrder: true,
  vatRate: true,
  allergens: true,
  categoryId: true,
  salesCategoryId: true,
  priceGroupId: true,
  revenueCenterId: true,
  prepStationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MenuItemSelect

/** ModifierGroup — MODEL A NOT NULL locationId. */
export const MODIFIER_GROUP_SELECT = {
  id: true,
  name: true,
  required: true,
  minSelect: true,
  maxSelect: true,
  sortOrder: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModifierGroupSelect

/** Modifier — scope RELACIJSKO prek modifierGroup.locationId. */
export const MODIFIER_SELECT = {
  id: true,
  name: true,
  price: true,
  isAvailable: true,
  sortOrder: true,
  allergens: true,
  modifierGroupId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModifierSelect

/** TaxRate — MODEL A NOT NULL locationId. */
export const TAX_RATE_SELECT = {
  id: true,
  name: true,
  rate: true,
  code: true,
  isActive: true,
  sortOrder: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaxRateSelect

// ── recipes ────────────────────────────────────────────────────────────────

/** RecipeItem — scope RELACIJSKO prek menuItem.category.menu.locationId (3 nivoji). */
export const RECIPE_ITEM_SELECT = {
  id: true,
  menuItemId: true,
  inventoryItemId: true,
  quantityPerServing: true,
  yieldPercent: true,
  unit: true,
  notes: true,
  parentRecipeItemId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RecipeItemSelect

// ── inventory / stock ledger ───────────────────────────────────────────────

/** InventoryItem — locationId nullable (NULL = skupna zaloga; lokacijski scope jih IZKLJUČI, fail-closed). */
export const INVENTORY_ITEM_SELECT = {
  id: true,
  name: true,
  description: true,
  image: true,
  unit: true,
  quantity: true,
  minQuantity: true,
  reorderPoint: true,
  safetyStock: true,
  leadTimeDays: true,
  costPerUnit: true,
  supplier: true,
  category: true,
  location: true,
  expiryDate: true,
  servingsPerUnit: true,
  servingSize: true,
  costPerServing: true,
  menuItemId: true,
  lastRestocked: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect

/** StockTransaction — zalozhni premiki; scope RELACIJSKO prek inventoryItem.locationId (FK: inventoryItemId). */
export const STOCK_TRANSACTION_SELECT = {
  id: true,
  inventoryItemId: true,
  type: true,
  quantity: true,
  previousQty: true,
  newQty: true,
  costPerUnit: true,
  totalCost: true,
  reason: true,
  note: true,
  supplierDoc: true,
  employeeName: true,
  orderId: true,
  createdAt: true,
} satisfies Prisma.StockTransactionSelect

// ── audit (kurirano) ───────────────────────────────────────────────────────

/**
 * AuditLog — kurirana revija: BREZ ipAddress / terminalId /
 * previousHash / chainHash (userAgent v shemi ne obstaja). details ostane
 * JSON string (klicatelj ga lahko parsira); cap 10000 (glej sections).
 */
export const AUDIT_LOG_SELECT = {
  id: true,
  timestamp: true,
  action: true,
  entityType: true,
  entityId: true,
  userId: true,
  locationId: true,
  details: true,
} satisfies Prisma.AuditLogSelect
