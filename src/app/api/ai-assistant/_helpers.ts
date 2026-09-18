// Pomožne funkcije za AI asistenta
// POST /api/ai-assistant — pomožni modul za kontekst, podatke in lokalne odgovore
//
// RUNDA 34: gatherDataSnapshot() vrača STRUKTURIRANE podatke (ne samo niz),
// iz katerih generateLocalAnswer() sestavi DATA-DRIVEN odgovor brez zunanjega
// AI API-ja. Ozadje: GEMINI_API_KEY ni nastavljen na Vercelu, z-ai-web-dev-sdk
// pa deluje samo v sandboxu (qr-upsell vrne aiPowered:false) — lokalna
// inteligenca je edina pot do delašega asistenta v produkciji.

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

import { formatEUR } from '@/lib/safe-format'
export const SYSTEM_PROMPT = `Si AI asistent za slovenski restavracijski POS sistem "RestaurantOS". 
Govoriš slovensko in pomagaš lastnikom restavracij z:

1. **Optimizacija menija** - Analiza donosnosti jedi, predlogi za spremembe cen, identifikacija "zvezd" in "psov"
2. **Napoved prodaje** - Na osnovi zgodovinskih podatkov predvidi obisk za naslednji teden
3. **Upravljanje zaloge** - Predlagaj naročila dobaviteljem, prepreči zastoj izdelkov
4. **Kadrovska optimizacija** - Predlagaj razpored zaposlenih glede na pričakovani obisk
5. **Stroški hrane** - Izračunaj food cost %, predlagaj znižanje stroškov
6. **Marketinški nasveti** - Predlagaj promocije, happy hour, sezonske menije

Znaš Slovenijo-specifične stvari: DDV stopnje (22%, 9.5%, 0%), FURS predpise, HACCP, slovenske praznike, turistične sezone.
Odgovarjaj strukturirano, s konkretnimi številkami in predlogi. Uporabljaj EUR za valuto.`

// ─── STRUKTURIRANI PODATKI (runda 34) ───────────────────────────────

export interface DataSnapshot {
  totalRevenue: number
  orderCount: number
  avgCheck: number
  topItems: { name: string; qty: number; revenue: number }[]
  lowStock: { name: string; quantity: number; minQuantity: number; unit: string | null }[]
  activeMenuItems: number
  staffOnShift: string[]
  reservationsToday: number
  guestsToday: number
}

export interface DataSnapshotResult {
  snapshot: DataSnapshot
  /** Človeku/modelu berljiv povzetek (za Gemini prompt) */
  context: string
}

export async function gatherDataSnapshot(): Promise<DataSnapshotResult> {
  const parts: string[] = []

  // Datumski prag za zadnjih 30 dni
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Današnji datum za izmene in rezervacije
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const snapshot: DataSnapshot = {
    totalRevenue: 0,
    orderCount: 0,
    avgCheck: 0,
    topItems: [],
    lowStock: [],
    activeMenuItems: 0,
    staffOnShift: [],
    reservationsToday: 0,
    guestsToday: 0,
  }

  try {
    // ─── VSE POIZVEDBE VZPOREDNO Z Promise.all ───
    const [orderAgg, topItemsRaw, lowStockItems, menuItemCount, activeTimeEntries, reservationAgg] = await Promise.all([
      // 1. Agregacija prodaje — namesto findMany z include (50 naročil z vsemi relacijami)
      db.order.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'cancelled' } },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),

      // 2. Top artikli — raw SQL za cross-field izračun (price * quantity) in agregacijo po menuItemId
      db.$queryRaw<Array<{ menuItemId: string; name: string; total_qty: number; total_revenue: number }>>`
        SELECT oi."menuItemId", m.name,
               SUM(oi.quantity) as total_qty,
               SUM(oi.price * oi.quantity) as total_revenue
        FROM "OrderItem" oi
        JOIN "MenuItem" m ON oi."menuItemId" = m.id
        JOIN "Order" o ON oi."orderId" = o.id
        WHERE o."createdAt" >= ${thirtyDaysAgo} AND o.status != 'cancelled' AND oi.voided = false
        GROUP BY oi."menuItemId", m.name
        ORDER BY total_revenue DESC
        LIMIT 10
      `,

      // 3. Nizka zaloga — ena raw SQL poizvedba za cross-field primerjavo (quantity <= minQuantity * 1.5)
      //    Zamenjuje dve ločeni poizvedbi (lowStock + allStock) in JS filtriranje
      db.$queryRaw<Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string | null }>>`
        SELECT id, name, quantity, "minQuantity", unit
        FROM "InventoryItem"
        WHERE quantity <= "minQuantity" * 1.5
        ORDER BY name ASC
        LIMIT 10
      `,

      // 4. Število aktivnih artiklov
      db.menuItem.count({ where: { isAvailable: true } }),

      // 5. Aktivne izmene — select samo ime zaposlenega namesto include celotnega objekta
      db.timeEntry.findMany({
        where: { clockIn: { gte: today }, clockOut: null },
        select: { employee: { select: { name: true } } },
      }),

      // 6. Rezervacije — aggregate namesto findMany (potrebujemo samo count in vsoto partySize)
      db.reservation.aggregate({
        where: { dateTime: { gte: today, lt: tomorrow }, status: 'confirmed' },
        _count: true,
        _sum: { partySize: true },
      }),
    ]);

    // Prodajni povzetek
    snapshot.totalRevenue = round2(toNum(orderAgg._sum.total));
    snapshot.orderCount = orderAgg._count;
    snapshot.avgCheck = round2(toNum(orderAgg._avg.total));

    snapshot.topItems = topItemsRaw.map(i => ({
      name: i.name,
      qty: Number(i.total_qty),
      revenue: round2(toNum(i.total_revenue)),
    }))

    snapshot.lowStock = lowStockItems.map(i => ({
      name: i.name,
      quantity: toNum(i.quantity),
      minQuantity: toNum(i.minQuantity),
      unit: i.unit,
    }))

    snapshot.activeMenuItems = menuItemCount
    snapshot.staffOnShift = activeTimeEntries.map(te => te.employee.name)

    snapshot.reservationsToday = reservationAgg._count
    snapshot.guestsToday = toNum(reservationAgg._sum.partySize)

    parts.push(`PRODAJA (zadnjih 30 dni): Skupaj ${snapshot.orderCount} naročil, Prihodek: ${formatEUR(snapshot.totalRevenue)}, Povprečen ček: ${formatEUR(snapshot.avgCheck)}`);

    if (snapshot.topItems.length > 0) {
      parts.push(`TOP 10 ARTIKLI: ${snapshot.topItems.map((i, idx) => `${idx + 1}. ${i.name} (${i.qty}x, ${formatEUR(i.revenue)})`).join(', ')}`);
    }

    if (snapshot.lowStock.length > 0) {
      parts.push(`NIZKA ZALOGA: ${snapshot.lowStock.map(i => `${i.name} (${i.quantity}/${i.minQuantity} ${i.unit ?? ''})`).join(', ')}`);
    }

    parts.push(`MENI: ${snapshot.activeMenuItems} aktivnih artiklov`);

    if (snapshot.staffOnShift.length > 0) {
      parts.push(`ZAPOSLENI NA IZMENI: ${snapshot.staffOnShift.join(', ')}`);
    }

    if (snapshot.reservationsToday > 0) {
      parts.push(`REZERVACIJE DANES: ${snapshot.reservationsToday} rezervacij, skupaj ${snapshot.guestsToday} gostov`);
    }

  } catch {
    parts.push('Podatki trenutno niso dosegljivi');
  }

  return { snapshot, context: parts.join('\n') }
}

/** Nazdaj združljiva ovojnica (niz za Gemini prompt) */
export async function gatherDataContext(context: Record<string, unknown>): Promise<string> {
  const { context: str } = await gatherDataSnapshot()
  void context
  return str
}

// ─── LOKALNA INTELIGENCA (runda 34) ─────────────────────────────────
// Data-driven odgovori brez zunanjega AI API-ja — iz realnih DB podatkov.

export function generateLocalAnswer(message: string, snapshot: DataSnapshot): string {
  const lowerMsg = message.toLowerCase()
  const has = (...words: string[]) => words.some((w) => lowerMsg.includes(w))

  const fmt = (n: number) => formatEUR(round2(n))

  // 1. Top artikli / najboljše jedi / prodaja
  if (has('najboljš', 'top', 'zvezd', 'priljubljen', 'najbolj prodajan')) {
    if (snapshot.topItems.length === 0) {
      return '📊 Za zadnjih 30 dni še ni evidentirane prodaje. Ko bodo naročila tekla, ti pokažem najboljše artikle in priporočila.'
    }
    const top = snapshot.topItems.slice(0, 3)
    const lines = top.map((i, idx) => `${idx + 1}. **${i.name}** — ${i.qty}x, prihodek ${fmt(i.revenue)}`).join('\n')
    return `📊 **Najboljši artikli (zadnjih 30 dni)**\n\n${lines}\n\n` +
      `💡 Priporočilo: **${top[0].name}** je tvoja "zvezda" — promoviraj ga (upsell, dnevni ponudbi). ` +
      `Skupaj si v tem obdobju ustvaril ${fmt(snapshot.totalRevenue)} prihodka prek ${snapshot.orderCount} naročil (povprečen ček ${fmt(snapshot.avgCheck)}).`
  }

  // 2. Prodaja / prihodek / ček
  if (has('prodaj', 'prihodek', 'ček', 'promet', 'prihod')) {
    return `📈 **Pregled prodaje (zadnjih 30 dni)**\n\n- Število naročil: **${snapshot.orderCount}**\n- Prihodek: **${fmt(snapshot.totalRevenue)}**\n- Povprečen ček: **${fmt(snapshot.avgCheck)}**\n\n` +
      (snapshot.topItems.length > 0
        ? `Največji zaveznik: **${snapshot.topItems[0].name}** (${snapshot.topItems[0].qty}x, ${fmt(snapshot.topItems[0].revenue)}).`
        : `Še ni podatkov o artiklih — vidi se bodo, ko bodo naročila tekla.`)
  }

  // 3. Zaloga / naročila dobaviteljem
  if (has('zaloga', 'zalog', 'naroč', 'dobavitelj', 'zaloge')) {
    if (snapshot.lowStock.length === 0) {
      return '📦 Nizke zaloge trenutno ni — vsi inventory artikel so nad varnostno ravnjo. 👍'
    }
    const lines = snapshot.lowStock.slice(0, 5).map(i => `- **${i.name}**: ${i.quantity}/${i.minQuantity} ${i.unit ?? ''} → naroči po zdaj`).join('\n')
    return `📦 **Nizka zaloga — priporočam naročilo**\n\n${lines}\n\n💡 Tip: določi par level (min/max) za te artikle, da se naročila ustvarjajo pravočasno.`
  }

  // 4. Osebje / izmene / kadri
  if (has('zaposlen', 'izmen', 'kader', 'osebje', 'natakar')) {
    const staff = snapshot.staffOnShift.length > 0 ? snapshot.staffOnShift.join(', ') : 'trenutno nihče'
    const resPart = snapshot.reservationsToday > 0
      ? `Danes je ${snapshot.reservationsToday} potrjenih rezervacij (${snapshot.guestsToday} gostov) — načrtuj pokritost zanje.`
      : 'Danes ni potrjenih rezervacij.'
    return `👥 **Kadrovska slika**\n\n- Na izmeni zdaj: **${staff}**\n- ${resPart}\n\n💡 V konicah (pet–sob, 18:00–22:00) načrtuj več rok; za manjše izmene pa križno usposobljeni kader (natakar + barman).`
  }

  // 5. Rezervacije / gostje
  if (has('rezervac', 'gost', 'obisk')) {
    if (snapshot.reservationsToday === 0) {
      return '📅 Za danes ni potrjenih rezervacij. Walk-in gostje se evidentirajo samodejno ob naročilu.'
    }
    return `📅 **Rezervacije danes**: ${snapshot.reservationsToday} rezervacij, skupaj **${snapshot.guestsToday}** pričakovanih gostov. Pripravi mize vnaprej in načrtuj pokritost osebja.`
  }

  // 6. Default — zmogljivosti + 2 realna podatka
  const highlights: string[] = []
  if (snapshot.topItems.length > 0) highlights.push(`Top artikel: **${snapshot.topItems[0].name}** (${snapshot.topItems[0].qty}x)`)
  if (snapshot.lowStock.length > 0) highlights.push(`⚠️ Nizka zaloga: **${snapshot.lowStock[0].name}** (${snapshot.lowStock[0].quantity}/${snapshot.lowStock[0].minQuantity})`)
  if (snapshot.reservationsToday > 0) highlights.push(`📅 Danes ${snapshot.guestsToday} gostov prek rezervacij`)

  return `🤖 **RestaurantOS AI Asistent**\n\n${highlights.length > 0 ? highlights.join(' · ') + '\n\n' : ''}Lahko te vprašaš na primer:\n\n- 📊 "Kateri je najboljši artikel?"\n- 📈 "Kakšna je prodaja?"\n- 📦 "Kaj moram naročiti?"\n- 👥 "Kdo je na izmeni?"\n- 📅 "Koliko rezervacij imam danes?"\n\n*(Odgovorim na osnovi realnih podatkov tvoje restavracije.)*`
}

/** Zastarel fallback — ohranjen za nazaj združljivost (API brez snapshot) */
export function generateFallbackResponse(message: string, _type: string, _dataContext: string): string {
  void _dataContext
  return generateLocalAnswer(message, {
    totalRevenue: 0, orderCount: 0, avgCheck: 0,
    topItems: [], lowStock: [], activeMenuItems: 0,
    staffOnShift: [], reservationsToday: 0, guestsToday: 0,
  })
}
