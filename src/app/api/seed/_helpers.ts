import { db } from '@/lib/db'

// ============================================
// CLEANUP: Delete all existing data
// ============================================
export async function cleanupExistingData() {
  // FIX: Po spremembi kaskad (Cascade → Restrict) moramo najprej izbrisati
  // child tabele, preden brišemo parente (Employee, InventoryItem, Guest, itd.).
  // Vrstni red sledi FK odvisnostim (child → parent).
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  // --- Child tabele pred parenti (Restrict kaskade) ---
  await db.guestVisit.deleteMany()
  await db.timeEntry.deleteMany()
  await db.staffShift.deleteMany()
  await db.shift.deleteMany()
  await db.stockTransaction.deleteMany()
  await db.loyaltyTransaction.deleteMany()
  await db.giftCardTransaction.deleteMany()
  await db.recipeItem.deleteMany()
  await db.inventoryItem.deleteMany()
  await db.menuItemModifierGroup.deleteMany()
  await db.modifier.deleteMany()
  await db.modifierGroup.deleteMany()
  await db.menuItem.deleteMany()
  await db.category.deleteMany()
  await db.menu.deleteMany()
  await db.table.deleteMany()
  await db.giftCard.deleteMany()
  await db.loyaltyAccount.deleteMany()
  await db.guest.deleteMany()
  await db.employee.deleteMany()
  // Configuration tables (respecting foreign keys: DiningOption → ServiceCharge)
  await db.diningOption.deleteMany()
  await db.serviceCharge.deleteMany()
  await db.taxRate.deleteMany()
  await db.revenueCenter.deleteMany()
  await db.salesCategory.deleteMany()
  await db.priceGroup.deleteMany()
  await db.prepStation.deleteMany()
  await db.voidReason.deleteMany()
  await db.noSaleReason.deleteMany()
  await db.alternatePaymentType.deleteMany()
  await db.discount.deleteMany()
  await db.printer.deleteMany()
  await db.webhook.deleteMany()
  await db.job.deleteMany()
}
