// =====================================================================
// KONFIGURACIJSKI PODATKI - Toast POS
// =====================================================================

import { db } from '@/lib/db'

// Seed all configuration tables
export async function seedAllConfig() {
  // DDV stopnje
  await Promise.all([
    db.taxRate.create({ data: { name: 'DDV 22%', rate: 22.0, code: 'S', isActive: true } }),
    db.taxRate.create({ data: { name: 'DDV 9.5%', rate: 9.5, code: 'R', isActive: true } }),
    db.taxRate.create({ data: { name: 'DDV 0%', rate: 0.0, code: 'Z', isActive: true } }),
  ])
  // Service charges (must be before DiningOptions due to FK)
  const terraceServiceCharge = await db.serviceCharge.create({ data: { name: 'Postrežba na terasi', type: 'percentage', amount: 10, isAutoApply: false } })
  // Dining options
  await Promise.all([
    db.diningOption.create({ data: { name: 'Na mestu', type: 'dine-in', prepTimeMinutes: 15, serviceChargeId: null } }),
    db.diningOption.create({ data: { name: 'Za s seboj', type: 'takeout', prepTimeMinutes: 10, serviceChargeId: null } }),
    db.diningOption.create({ data: { name: 'Dostava', type: 'delivery', prepTimeMinutes: 30, serviceChargeId: terraceServiceCharge.id } }),
  ])
  // Revenue centers
  await Promise.all([
    db.revenueCenter.create({ data: { name: 'Glavna dvorana', code: 'MAIN', isActive: true } }),
    db.revenueCenter.create({ data: { name: 'Terasa', code: 'TERRACE', isActive: true } }),
    db.revenueCenter.create({ data: { name: 'Bar', code: 'BAR', isActive: true } }),
    db.revenueCenter.create({ data: { name: 'Dostava', code: 'DELIVERY', isActive: true } }),
  ])
  // Sales categories
  await Promise.all([
    db.salesCategory.create({ data: { name: 'Hrana', code: 'FOOD', isActive: true } }),
    db.salesCategory.create({ data: { name: 'Pijača', code: 'DRINKS', isActive: true } }),
    db.salesCategory.create({ data: { name: 'Alkoholne pijače', code: 'ALCOHOL', isActive: true } }),
    db.salesCategory.create({ data: { name: 'Sladice', code: 'DESSERTS', isActive: true } }),
    db.salesCategory.create({ data: { name: 'Prigrizki', code: 'SNACKS', isActive: true } }),
  ])
  // Price groups
  await Promise.all([
    db.priceGroup.create({ data: { name: 'Redna cena', description: 'Standardni cenik', isActive: true } }),
    db.priceGroup.create({ data: { name: 'Kosilo menu', description: 'Dnevno kosilo 11-14h', isActive: true } }),
    db.priceGroup.create({ data: { name: 'Happy Hour', description: 'Popoldanski popust 15-17h', isActive: true } }),
    db.priceGroup.create({ data: { name: 'Catering', description: 'Cenik za catering', isActive: false } }),
  ])
  // Prep stations
  await Promise.all([
    db.prepStation.create({ data: { name: 'Vroča kuhinja', type: 'kitchen', avgPrepTime: 15 } }),
    db.prepStation.create({ data: { name: 'Hladna kuhinja', type: 'cold', avgPrepTime: 5 } }),
    db.prepStation.create({ data: { name: 'Bar', type: 'bar', avgPrepTime: 3 } }),
    db.prepStation.create({ data: { name: 'Žar', type: 'grill', avgPrepTime: 12 } }),
    db.prepStation.create({ data: { name: 'Slaščičarna', type: 'pastry', avgPrepTime: 8 } }),
  ])
  // Void reasons
  await Promise.all([
    db.voidReason.create({ data: { name: 'Napaka natakarja', isActive: true, sortOrder: 1 } }),
    db.voidReason.create({ data: { name: 'Nezadovoljstvo stranke', isActive: true, sortOrder: 2 } }),
    db.voidReason.create({ data: { name: 'Napaka v kuhinji', isActive: true, sortOrder: 3 } }),
    db.voidReason.create({ data: { name: 'Alergija', isActive: true, sortOrder: 4 } }),
    db.voidReason.create({ data: { name: 'Menjava artikla', isActive: true, sortOrder: 5 } }),
    db.voidReason.create({ data: { name: 'Naročilo po pomoti', isActive: true, sortOrder: 6 } }),
    db.voidReason.create({ data: { name: 'Ni na zalogi', isActive: true, sortOrder: 7 } }),
  ])
  // No-sale reasons
  await Promise.all([
    db.noSaleReason.create({ data: { name: 'Odprt fižek', isActive: true } }),
    db.noSaleReason.create({ data: { name: 'Menjava', isActive: true } }),
    db.noSaleReason.create({ data: { name: 'Preverjanje', isActive: true } }),
  ])
  // Alternate payment types
  await Promise.all([
    db.alternatePaymentType.create({ data: { name: 'Boni', code: 'BON', type: 'voucher' } }),
    db.alternatePaymentType.create({ data: { name: 'Kupon', code: 'COUPON', type: 'coupon' } }),
    db.alternatePaymentType.create({ data: { name: 'Studentski bon', code: 'STUDENT', type: 'voucher' } }),
    db.alternatePaymentType.create({ data: { name: 'Malica', code: 'MALICA', type: 'voucher' } }),
  ])
  // Discounts
  await Promise.all([
    db.discount.create({ data: { name: 'Zgodnja ptica', type: 'percentage', amount: 10, appliesTo: 'all', triggerType: 'manual', isActive: true } }),
    db.discount.create({ data: { name: '10% na celotno naročilo', type: 'percentage', amount: 10, appliesTo: 'order', triggerType: 'manual', isActive: true } }),
    db.discount.create({ data: { name: '5€ popust na pijačo', type: 'fixed', amount: 5, appliesTo: 'categories', triggerType: 'manual', isActive: true } }),
  ])
  // Printers
  await Promise.all([
    db.printer.create({ data: { name: 'Kuhinja', type: 'thermal', location: 'Kuhinja', ipAddress: '192.168.1.100' } }),
    db.printer.create({ data: { name: 'Bar', type: 'thermal', location: 'Bar', ipAddress: '192.168.1.101' } }),
    db.printer.create({ data: { name: 'Blagajna', type: 'receipt', location: 'Blagajna', ipAddress: '192.168.1.102' } }),
  ])
  // Webhooks — generiramo naključen secret če WEBHOOK_SECRET ni nastavljen
  const webhookSecret = process.env.WEBHOOK_SECRET || (() => { const b = new Uint8Array(32); crypto.getRandomValues(b); return `whsec_${Array.from(b, x => x.toString(16).padStart(2, '0')).join('')}` })()
  await db.webhook.create({ data: { name: 'Test webhook', url: 'https://hooks.example.com/pos', events: 'order.created,order.completed,payment.received', isActive: false, secret: webhookSecret } }).catch(() => {})
  // Jobs
  await Promise.all([
    db.job.create({ data: { name: 'Natakar', code: 'WAIT', basePayRate: 9.50, overtimeRate: 14.25, permissions: JSON.stringify(['take_orders', 'void_items', 'apply_discounts']) } }),
    db.job.create({ data: { name: 'Kuhar', code: 'CHEF', basePayRate: 10.50, overtimeRate: 15.75, permissions: JSON.stringify(['manage_kitchen', 'view_inventory']) } }),
    db.job.create({ data: { name: 'Barman', code: 'BAR', basePayRate: 9.80, overtimeRate: 14.70, permissions: JSON.stringify(['take_orders', 'manage_bar']) } }),
    db.job.create({ data: { name: 'Vodja smene', code: 'LEAD', basePayRate: 13.00, overtimeRate: 19.50, permissions: JSON.stringify(['take_orders', 'manage_cash', 'void_items', 'apply_discounts', 'view_reports']) } }),
    db.job.create({ data: { name: 'Upravljalec', code: 'ADMIN', basePayRate: 16.00, overtimeRate: 24.00, permissions: JSON.stringify(['admin']) } }),
  ])
}
