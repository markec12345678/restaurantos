// Direct database re-seed script - bypasses HTTP layer
// Run: node scripts/seed-direct.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  
  // Delete in order of dependencies
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.menuItemModifierGroup.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.table.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.diningOption.deleteMany();
  await prisma.serviceCharge.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.revenueCenter.deleteMany();
  await prisma.salesCategory.deleteMany();
  await prisma.priceGroup.deleteMany();
  await prisma.prepStation.deleteMany();
  await prisma.voidReason.deleteMany();
  await prisma.noSaleReason.deleteMany();
  await prisma.alternatePaymentType.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.printer.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.job.deleteMany();
  
  console.log('Data cleared! Now call /api/seed via the browser or use the app to re-seed with new image paths.');
  console.log('');
  console.log('To re-seed, open the app and navigate to the admin settings, or use:');
  console.log('  1. Login with PIN 1234 in the browser');
  console.log('  2. Go to admin panel');
  console.log('  3. Click "Re-seed database"');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
