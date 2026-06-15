import { db } from '@/lib/db'

// ============================================
// CLEANUP: Delete all existing data
// ============================================
export async function cleanupExistingData() {
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.shift.deleteMany()
  await db.inventoryItem.deleteMany()
  await db.menuItemModifierGroup.deleteMany()
  await db.modifier.deleteMany()
  await db.modifierGroup.deleteMany()
  await db.menuItem.deleteMany()
  await db.category.deleteMany()
  await db.menu.deleteMany()
  await db.table.deleteMany()
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
