import { db } from '@/lib/db'

// ============================================
// CLEANUP: Delete all existing data
// ============================================
export async function cleanupExistingData() {
  // FIX: Po spremembi kaskad (Cascade → Restrict) moramo najprej izbrisati
  // child tabele, preden brišemo parente (Employee, InventoryItem, Guest, itd.).
  // Vrstni red sledi FK odvisnostim (child → parent).
  // FIX: Receipt, Payment, Check morajo biti izbrisani PRED Order (FK constraint)

  // --- Financial records (child of Order) ---
  await db.payment.deleteMany().catch(() => {})
  await db.receipt.deleteMany().catch(() => {})
  await db.check.deleteMany().catch(() => {})
  await db.kotDocument.deleteMany().catch(() => {})
  await db.auditLog.deleteMany().catch(() => {})

  // --- Order items and orders ---
  await db.orderItem.deleteMany().catch(() => {})
  await db.order.deleteMany().catch(() => {})

  // --- Child tabele pred parenti (Restrict kaskade) ---
  await db.guestVisit.deleteMany().catch(() => {})
  await db.timeEntry.deleteMany().catch(() => {})
  await db.staffShift.deleteMany().catch(() => {})
  await db.shift.deleteMany().catch(() => {})
  await db.stockTransaction.deleteMany().catch(() => {})
  await db.loyaltyTransaction.deleteMany().catch(() => {})
  await db.giftCardTransaction.deleteMany().catch(() => {})
  await db.recipeItem.deleteMany().catch(() => {})
  await db.inventoryItem.deleteMany().catch(() => {})
  await db.menuItemModifierGroup.deleteMany().catch(() => {})
  await db.modifier.deleteMany().catch(() => {})
  await db.modifierGroup.deleteMany().catch(() => {})
  await db.menuItem.deleteMany().catch(() => {})
  await db.category.deleteMany().catch(() => {})
  await db.menu.deleteMany().catch(() => {})
  await db.table.deleteMany().catch(() => {})
  await db.giftCard.deleteMany().catch(() => {})
  await db.loyaltyAccount.deleteMany().catch(() => {})
  await db.guest.deleteMany().catch(() => {})
  // Configuration tables (respecting foreign keys: DiningOption → ServiceCharge)
  await db.diningOption.deleteMany().catch(() => {})
  await db.serviceCharge.deleteMany().catch(() => {})
  await db.taxRate.deleteMany().catch(() => {})
  await db.revenueCenter.deleteMany().catch(() => {})
  await db.salesCategory.deleteMany().catch(() => {})
  await db.priceGroup.deleteMany().catch(() => {})
  await db.prepStation.deleteMany().catch(() => {})
  await db.voidReason.deleteMany().catch(() => {})
  await db.noSaleReason.deleteMany().catch(() => {})
  await db.alternatePaymentType.deleteMany().catch(() => {})
  await db.discount.deleteMany().catch(() => {})
  await db.printer.deleteMany().catch(() => {})
  await db.webhook.deleteMany().catch(() => {})
  await db.job.deleteMany().catch(() => {})
}
