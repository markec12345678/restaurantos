// =====================================================================
// KONFIGURACIJSKI PODATKI - Toast POS
// MODEL A (tenant scope audit 2026-09-09): VSA konfiguracija je PO LOKACIJI.
// Demo-seed kreira nove vrstice NA PRVO AKTIVNO lokacijo (isti vzorec kot
// seed-structure.ts) — to je kreacija DEMO podatkov, NE prerazporejanje
// obstoječih poslovnih vrstic (katero koli prerazporeditev obstoječih
// podatkov izvedbi ROČNO — glej migracijo 0003_tenant_model_a).
// =====================================================================

import { db } from '@/lib/db'

// Seed all configuration tables
export async function seedAllConfig() {
  // MODEL A: ciljna lokacija demo podatkov (prva aktivna, fallback loc-1)
  const targetLocation = await db.location.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  const locationId = targetLocation?.id || 'loc-1'

  // DDV stopnje
  await Promise.all([
    db.taxRate.create({ data: { name: 'DDV 22%', rate: 22.0, code: 'S', isActive: true, locationId } }),
    db.taxRate.create({ data: { name: 'DDV 9.5%', rate: 9.5, code: 'R', isActive: true, locationId } }),
    db.taxRate.create({ data: { name: 'DDV 0%', rate: 0.0, code: 'Z', isActive: true, locationId } }),
  ])
  // Service charges (must be before DiningOptions due to FK)
  const terraceServiceCharge = await db.serviceCharge.create({ data: { name: 'Postrežba na terasi', type: 'percentage', amount: 10, isAutoApply: false, locationId } })
  // Dining options
  await Promise.all([
    db.diningOption.create({ data: { name: 'Na mestu', type: 'dine-in', prepTimeMinutes: 15, serviceChargeId: null, locationId } }),
    db.diningOption.create({ data: { name: 'Za s seboj', type: 'takeout', prepTimeMinutes: 10, serviceChargeId: null, locationId } }),
    db.diningOption.create({ data: { name: 'Dostava', type: 'delivery', prepTimeMinutes: 30, serviceChargeId: terraceServiceCharge.id, locationId } }),
  ])
  // Revenue centers
  await Promise.all([
    db.revenueCenter.create({ data: { name: 'Glavna dvorana', code: 'MAIN', isActive: true, locationId } }),
    db.revenueCenter.create({ data: { name: 'Terasa', code: 'TERRACE', isActive: true, locationId } }),
    db.revenueCenter.create({ data: { name: 'Bar', code: 'BAR', isActive: true, locationId } }),
    db.revenueCenter.create({ data: { name: 'Dostava', code: 'DELIVERY', isActive: true, locationId } }),
  ])
  // Sales categories
  await Promise.all([
    db.salesCategory.create({ data: { name: 'Hrana', code: 'FOOD', isActive: true, locationId } }),
    db.salesCategory.create({ data: { name: 'Pijača', code: 'DRINKS', isActive: true, locationId } }),
    db.salesCategory.create({ data: { name: 'Alkoholne pijače', code: 'ALCOHOL', isActive: true, locationId } }),
    db.salesCategory.create({ data: { name: 'Sladice', code: 'DESSERTS', isActive: true, locationId } }),
    db.salesCategory.create({ data: { name: 'Prigrizki', code: 'SNACKS', isActive: true, locationId } }),
  ])
  // Price groups
  await Promise.all([
    db.priceGroup.create({ data: { name: 'Redna cena', description: 'Standardni cenik', isActive: true, locationId } }),
    db.priceGroup.create({ data: { name: 'Kosilo menu', description: 'Dnevno kosilo 11-14h', isActive: true, locationId } }),
    db.priceGroup.create({ data: { name: 'Happy Hour', description: 'Popoldanski popust 15-17h', isActive: true, locationId } }),
    db.priceGroup.create({ data: { name: 'Catering', description: 'Cenik za catering', isActive: false, locationId } }),
  ])
  // Prep stations
  await Promise.all([
    db.prepStation.create({ data: { name: 'Vroča kuhinja', type: 'kitchen', avgPrepTime: 15, locationId } }),
    db.prepStation.create({ data: { name: 'Hladna kuhinja', type: 'cold', avgPrepTime: 5, locationId } }),
    db.prepStation.create({ data: { name: 'Bar', type: 'bar', avgPrepTime: 3, locationId } }),
    db.prepStation.create({ data: { name: 'Žar', type: 'grill', avgPrepTime: 12, locationId } }),
    db.prepStation.create({ data: { name: 'Slaščičarna', type: 'pastry', avgPrepTime: 8, locationId } }),
  ])
  // Void reasons
  await Promise.all([
    db.voidReason.create({ data: { name: 'Napaka natakarja', isActive: true, sortOrder: 1, locationId } }),
    db.voidReason.create({ data: { name: 'Nezadovoljstvo stranke', isActive: true, sortOrder: 2, locationId } }),
    db.voidReason.create({ data: { name: 'Napaka v kuhinji', isActive: true, sortOrder: 3, locationId } }),
    db.voidReason.create({ data: { name: 'Alergija', isActive: true, sortOrder: 4, locationId } }),
    db.voidReason.create({ data: { name: 'Menjava artikla', isActive: true, sortOrder: 5, locationId } }),
    db.voidReason.create({ data: { name: 'Naročilo po pomoti', isActive: true, sortOrder: 6, locationId } }),
    db.voidReason.create({ data: { name: 'Ni na zalogi', isActive: true, sortOrder: 7, locationId } }),
  ])
  // No-sale reasons
  await Promise.all([
    db.noSaleReason.create({ data: { name: 'Odprt fižek', isActive: true, locationId } }),
    db.noSaleReason.create({ data: { name: 'Menjava', isActive: true, locationId } }),
    db.noSaleReason.create({ data: { name: 'Preverjanje', isActive: true, locationId } }),
  ])
  // Alternate payment types
  await Promise.all([
    db.alternatePaymentType.create({ data: { name: 'Boni', code: 'BON', type: 'voucher', locationId } }),
    db.alternatePaymentType.create({ data: { name: 'Kupon', code: 'COUPON', type: 'coupon', locationId } }),
    db.alternatePaymentType.create({ data: { name: 'Studentski bon', code: 'STUDENT', type: 'voucher', locationId } }),
    db.alternatePaymentType.create({ data: { name: 'Malica', code: 'MALICA', type: 'voucher', locationId } }),
  ])
  // Discounts
  await Promise.all([
    db.discount.create({ data: { name: 'Zgodnja ptica', type: 'percentage', amount: 10, appliesTo: 'all', triggerType: 'manual', isActive: true, locationId } }),
    db.discount.create({ data: { name: '10% na celotno naročilo', type: 'percentage', amount: 10, appliesTo: 'order', triggerType: 'manual', isActive: true, locationId } }),
    db.discount.create({ data: { name: '5€ popust na pijačo', type: 'fixed', amount: 5, appliesTo: 'categories', triggerType: 'manual', isActive: true, locationId } }),
  ])
  // Printers
  await Promise.all([
    db.printer.create({ data: { name: 'Kuhinja', type: 'thermal', location: 'Kuhinja', ipAddress: '192.168.1.100', locationId } }),
    db.printer.create({ data: { name: 'Bar', type: 'thermal', location: 'Bar', ipAddress: '192.168.1.101', locationId } }),
    db.printer.create({ data: { name: 'Blagajna', type: 'receipt', location: 'Blagajna', ipAddress: '192.168.1.102', locationId } }),
  ])
  // Webhooks — generiramo naključen secret če WEBHOOK_SECRET ni nastavljen
  const webhookSecret = process.env.WEBHOOK_SECRET || (() => { const b = new Uint8Array(32); crypto.getRandomValues(b); return `whsec_${Array.from(b, x => x.toString(16).padStart(2, '0')).join('')}` })()
  await db.webhook.create({ data: { name: 'Test webhook', url: 'https://hooks.example.com/pos', events: 'order.created,order.completed,payment.received', isActive: false, secret: webhookSecret, locationId } }).catch(() => {})
  // Jobs
  await Promise.all([
    db.job.create({ data: { name: 'Natakar', code: 'WAIT', basePayRate: 9.50, overtimeRate: 14.25, permissions: JSON.stringify(['take_orders', 'void_items', 'apply_discounts']) } }),
    db.job.create({ data: { name: 'Kuhar', code: 'CHEF', basePayRate: 10.50, overtimeRate: 15.75, permissions: JSON.stringify(['manage_kitchen', 'view_inventory']) } }),
    db.job.create({ data: { name: 'Barman', code: 'BAR', basePayRate: 9.80, overtimeRate: 14.70, permissions: JSON.stringify(['take_orders', 'manage_bar']) } }),
    db.job.create({ data: { name: 'Vodja smene', code: 'LEAD', basePayRate: 13.00, overtimeRate: 19.50, permissions: JSON.stringify(['take_orders', 'manage_cash', 'void_items', 'apply_discounts', 'view_reports']) } }),
    db.job.create({ data: { name: 'Upravljalec', code: 'ADMIN', basePayRate: 16.00, overtimeRate: 24.00, permissions: JSON.stringify(['admin']) } }),
  ])
}
