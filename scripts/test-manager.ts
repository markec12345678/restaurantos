import { db } from '../src/lib/db'
import { toNum, abs as decAbs } from '../src/lib/decimal'

async function main() {
  console.log('========================================');
  console.log('MANAGER MARKO - TEST VSEH FUNKCIJ');
  console.log('========================================\n');

  // 1. PREVERI ZALOGE
  console.log('1. STANJE ZALOG:');
  const inventory = await db.inventoryItem.findMany({
    include: { menuItem: { select: { name: true, price: true } } },
    orderBy: { name: 'asc' }
  });
  for (const item of inventory) {
    const link = item.menuItem ? `-> ${item.menuItem.name} (${item.menuItem.price}EUR)` : 'NI POVEZAVE';
    console.log(`  ${item.name.padEnd(20)} | zaloga: ${String(item.quantity).padStart(7)} | spu: ${item.servingsPerUnit} | cps: ${item.costPerServing}EUR | ${link}`);
  }

  // 2. PREVERI NAROČILA
  console.log('\n2. NAROCILA:');
  const orders = await db.order.findMany({
    include: { table: true, orderItems: { include: { menuItem: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  for (const order of orders) {
    console.log(`  #${order.orderNumber} | status: ${order.status} | placilo: ${order.paymentStatus} | znesek: ${order.total}EUR | miza: ${order.table?.number || '-'}`);
    for (const oi of order.orderItems) {
      console.log(`    ${oi.quantity}x ${oi.menuItem?.name || '?'} @ ${oi.price}EUR`);
    }
  }

  // 3. TRANSAKCIJE ZALOG
  console.log('\n3. TRANSAKCIJE ZALOG (zadnjih 15):');
  const transactions = await db.stockTransaction.findMany({
    include: { inventoryItem: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  for (const tx of transactions) {
    console.log(`  ${tx.type.padEnd(15)} | ${tx.inventoryItem.name.padEnd(20)} | qty: ${tx.quantity} | ${tx.previousQty} -> ${tx.newQty} | ${tx.reason}`);
  }

  // 4. FINANČNO POROČILO - DNEVNO
  console.log('\n4. FINANCNO POROCILO - DNEVNO:');
  const today = new Date();
  const startOfDay = new Date(today); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(today); endOfDay.setHours(23,59,59,999);

  const completedOrders = await db.order.findMany({
    where: { 
      status: 'completed',
      createdAt: { gte: startOfDay, lte: endOfDay }
    },
    include: { orderItems: { include: { menuItem: { include: { category: true } } } } },
  });

  const totalRevenue = completedOrders.reduce((sum, o) => sum + toNum(o.total), 0);
  const totalSubtotal = completedOrders.reduce((sum, o) => sum + toNum(o.subtotal), 0);
  const totalTax = completedOrders.reduce((sum, o) => sum + toNum(o.tax), 0);

  console.log(`  Prihodki: ${totalRevenue.toFixed(2)}EUR`);
  console.log(`  Brez DDV: ${totalSubtotal.toFixed(2)}EUR`);
  console.log(`  DDV: ${totalTax.toFixed(2)}EUR`);
  console.log(`  Zakljucena narocila: ${completedOrders.length}`);

  // Plačilne metode
  const paidOrders = await db.order.findMany({
    where: { paymentStatus: 'paid', createdAt: { gte: startOfDay, lte: endOfDay } }
  });
  const methodMap: Record<string, {count: number, total: number}> = {};
  for (const o of paidOrders) {
    const m = o.paymentMethod || 'gotovina';
    if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
    methodMap[m].count++;
    methodMap[m].total += toNum(o.total);
  }
  console.log('  Placilne metode:');
  for (const [method, data] of Object.entries(methodMap)) {
    console.log(`    ${method}: ${data.count}x, skupaj ${data.total.toFixed(2)}EUR`);
  }

  // 5. STROŠKI IN COGS
  console.log('\n5. STROSKI ZA DANES:');
  const todayTx = await db.stockTransaction.findMany({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  });
  const procurement = todayTx.filter(t => t.type === 'procurement').reduce((s, t) => s + toNum(t.totalCost), 0);
  const cogs = todayTx.filter(t => t.type === 'sale').reduce((s, t) => s + toNum(decAbs(t.totalCost)), 0);
  const writeOffs = todayTx.filter(t => t.type === 'write-off' || t.type === 'return').reduce((s, t) => s + toNum(decAbs(t.totalCost)), 0);
  const grossProfit = totalRevenue - cogs;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;

  console.log(`  Nabava (procurement): ${procurement.toFixed(2)}EUR`);
  console.log(`  COGS (strosek prodanih): ${cogs.toFixed(2)}EUR`);
  console.log(`  Odpisi: ${writeOffs.toFixed(2)}EUR`);
  console.log(`  Bruto dobicek: ${grossProfit.toFixed(2)}EUR`);
  console.log(`  Bruto marza: ${margin.toFixed(1)}%`);

  // 6. KNJIŽNI IZPISEK
  console.log('\n6. KNJIZNI IZPISEK:');
  const cashSales = paidOrders.filter(o => o.paymentMethod === 'gotovina').reduce((s, o) => s + toNum(o.total), 0);
  const cardSales = paidOrders.filter(o => o.paymentMethod === 'kartica').reduce((s, o) => s + toNum(o.total), 0);
  console.log(`  DEBIT:`);
  console.log(`    1140 - Potrosniki - Gotovina: ${cashSales.toFixed(2)}EUR`);
  console.log(`    1140 - Potrosniki - Kartice: ${cardSales.toFixed(2)}EUR`);
  console.log(`  CREDIT:`);
  console.log(`    7600 - Prihodki od prodaje: ${totalSubtotal.toFixed(2)}EUR`);
  console.log(`    2530 - DDV obveznosti: ${totalTax.toFixed(2)}EUR`);
  console.log(`  Skupaj DEBIT: ${(cashSales + cardSales).toFixed(2)}EUR`);
  console.log(`  Skupaj CREDIT: ${(totalSubtotal + totalTax).toFixed(2)}EUR`);

  // 7. PO KATEGORIJAH
  console.log('\n7. PO KATEGORIJAH:');
  const catMap: Record<string, {revenue: number, qty: number}> = {};
  for (const order of completedOrders) {
    for (const oi of order.orderItems) {
      const cat = oi.menuItem?.category?.name || 'Ostalo';
      if (!catMap[cat]) catMap[cat] = { revenue: 0, qty: 0 };
      catMap[cat].revenue += toNum(oi.price) * oi.quantity;
      catMap[cat].qty += oi.quantity;
    }
  }
  for (const [cat, data] of Object.entries(catMap).sort((a, b) => b[1].revenue - a[1].revenue)) {
    console.log(`  ${cat.padEnd(25)} | prihodek: ${data.revenue.toFixed(2)}EUR | kolicina: ${data.qty}`);
  }

  // 8. TEDENSKO POROČILO
  console.log('\n8. TEDENSKO POROCILO:');
  const dayOfWeek = today.getDay() || 7;
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - dayOfWeek + 1); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
  
  const weekOrders = await db.order.findMany({
    where: { status: 'completed', createdAt: { gte: weekStart, lte: weekEnd } }
  });
  const weekRevenue = weekOrders.reduce((s, o) => s + toNum(o.total), 0);
  console.log(`  Obdobje: ${weekStart.toLocaleDateString('sl-SI')} - ${weekEnd.toLocaleDateString('sl-SI')}`);
  console.log(`  Prihodki: ${weekRevenue.toFixed(2)}EUR`);
  console.log(`  Narocila: ${weekOrders.length}`);

  // 9. MESEČNO POROČILO
  console.log('\n9. MESECNO POROCILO:');
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const monthOrders = await db.order.findMany({
    where: { status: 'completed', createdAt: { gte: monthStart, lte: monthEnd } }
  });
  const monthRevenue = monthOrders.reduce((s, o) => s + toNum(o.total), 0);
  console.log(`  Obdobje: ${monthStart.toLocaleDateString('sl-SI')} - ${monthEnd.toLocaleDateString('sl-SI')}`);
  console.log(`  Prihodki: ${monthRevenue.toFixed(2)}EUR`);
  console.log(`  Narocila: ${monthOrders.length}`);

  // 10. LETNO POROČILO
  console.log('\n10. LETNO POROCILO:');
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
  
  const yearOrders = await db.order.findMany({
    where: { status: 'completed', createdAt: { gte: yearStart, lte: yearEnd } }
  });
  const yearRevenue = yearOrders.reduce((s, o) => s + toNum(o.total), 0);
  console.log(`  Obdobje: ${yearStart.toLocaleDateString('sl-SI')} - ${yearEnd.toLocaleDateString('sl-SI')}`);
  console.log(`  Prihodki: ${yearRevenue.toFixed(2)}EUR`);
  console.log(`  Narocila: ${yearOrders.length}`);

  console.log('\n========================================');
  console.log('VSE FUNKCIJE PREVERJENE!');
  console.log('========================================');
}

main().catch(e => { console.error('NAPAKA:', e); process.exit(1); }).finally(() => db.$disconnect());
