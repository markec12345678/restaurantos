
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2 } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AI_ASSISTANT_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'
const SYSTEM_PROMPT = `Si AI asistent za slovenski restavracijski POS sistem "RestaurantOS". 
Govoriš slovensko in pomagaš lastnikom restavracij z:

1. **Optimizacija menija** - Analiza donosnosti jedi, predlogi za spremembe cen, identifikacija "zvezd" in "psov"
2. **Napoved prodaje** - Na osnovi zgodovinskih podatkov predvidi obisk za naslednji teden
3. **Upravljanje zaloge** - Predlagaj naročila dobaviteljem, prepreči zastoj izdelkov
4. **Kadrovska optimizacija** - Predlagaj razpored zaposlenih glede na pričakovani obisk
5. **Stroški hrane** - Izračunaj food cost %, predlagaj znižanje stroškov
6. **Marketinški nasveti** - Predlagaj promocije, happy hour, sezonske menije

Znaš Slovenijo-specifične stvari: DDV stopnje (22%, 9.5%, 0%), FURS predpise, HACCP, slovenske praznike, turistične sezone.
Odgovarjaj strukturirano, s konkretnimi številkami in predlogi. Uporabljaj EUR za valuto.`;

export async function POST(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za AI asistenta
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX: Omejitev hitrosti — AI klici stanejo denar, prepreči zlorabo
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit('ai-assistant', ip, AI_ASSISTANT_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov. Poskusite znova čez nekaj časa.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const aiAssistantSchema = z.object({
      message: z.string().min(1, 'Sporočilo je obvezno').max(5000, 'Sporočilo ne sme preseči 5000 znakov'),
      type: z.string().max(50, 'Tip ne sme preseči 50 znakov').default('general'),
      context: z.record(z.string(), z.unknown()).default({}),
    })

    const validated = await validateRequest(req, aiAssistantSchema)
    if (validated.error) return validated.error
    const { message: rawMessage, type, context } = validated.data

    const message = rawMessage.trim()

    // Gather real data for context
    const dataContext = await gatherDataContext(context);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API ključ ni nastavljen' }, { status: 500 });
    }

    const startTime = Date.now();

    // Build the full prompt with context
    const fullPrompt = `${SYSTEM_PROMPT}\n\n--- TRENUTNI PODATKI RESTAVRACIJE ---\n${dataContext}\n\n--- VPRAŠANJE UPORABNIKA ---\n${message}`;

    // FIX BUG-02 HIGH: API key ne sme biti v URL-ju — izpostavljen v logih/proxyjih
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('API', 'Gemini API error:', errorText);
      // Return a helpful fallback response instead of erroring
      return NextResponse.json({
        response: generateFallbackResponse(message, type, dataContext),
        type,
        model: 'fallback',
        responseTimeMs,
        isFallback: true,
      });
    }

    const geminiData = await response.json();
    const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Oprostite, nisem mogel generirati odgovora.';
    const tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;

    // Log the conversation
    await db.aIConversation.create({
      data: {
        type,
        userMessage: message,
        aiResponse: aiText,
        model: 'gemini-2.0-flash',
        tokensUsed,
        responseTimeMs,
        employeeId: (context.employeeId as string) || null,
      },
    });

    return NextResponse.json({
      response: aiText,
      type,
      model: 'gemini-2.0-flash',
      tokensUsed,
      responseTimeMs,
    });
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ai-assistant', 'Napaka pri AI asistentu')
  }
}

async function gatherDataContext(_context: Record<string, unknown>): Promise<string> {
  const parts: string[] = [];

  try {
    // Datumski prag za zadnjih 30 dni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Današnji datum za izmene in rezervacije
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
    const totalRevenue = toNum(orderAgg._sum.total);
    const orderCount = orderAgg._count;
    const avgCheck = toNum(orderAgg._avg.total);

    parts.push(`PRODAJA (zadnjih 30 dni): Skupaj ${orderCount} naročil, Prihodek: €${round2(totalRevenue).toFixed(2)}, Povprečen ček: €${round2(avgCheck).toFixed(2)}`);

    // Top artikli
    if (topItemsRaw.length > 0) {
      parts.push(`TOP 10 ARTIKLI: ${topItemsRaw.map((i, idx) => `${idx + 1}. ${i.name} (${i.total_qty}x, €${round2(i.total_revenue).toFixed(2)})`).join(', ')}`);
    }

    // Nizka zaloga
    if (lowStockItems.length > 0) {
      parts.push(`NIZKA ZALOGA: ${lowStockItems.map(i => `${i.name} (${i.quantity}/${i.minQuantity} ${i.unit})`).join(', ')}`);
    }

    // Meni
    parts.push(`MENI: ${menuItemCount} aktivnih artiklov`);

    // Zaposleni na izmeni
    if (activeTimeEntries.length > 0) {
      parts.push(`ZAPOSLENI NA IZMENI: ${activeTimeEntries.map(te => te.employee.name).join(', ')}`);
    }

    // Rezervacije
    const reservationCount = reservationAgg._count;
    const totalGuests = toNum(reservationAgg._sum.partySize);
    if (reservationCount > 0) {
      parts.push(`REZERVACIJE DANES: ${reservationCount} rezervacij, skupaj ${totalGuests} gostov`);
    }

  } catch {
    parts.push('Podatki trenutno niso dosegljivi');
  }

  return parts.join('\n');
}

function generateFallbackResponse(message: string, _type: string, _dataContext: string): string {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('meni') || lowerMsg.includes('cen') || lowerMsg.includes('artikl')) {
    return `📊 **Optimizacija menija**\n\nNa osnovi vaših podatkov:\n\n1. **Analiza donosnosti**: Primerjajte prodajo vsakega artikla z njegovo ceno in stroškom sestavin. Artikle z visoko prodajo in visoko maržo označite kot "Zvezde" — te promovirajte.\n\n2. **Prilagoditev cen**: Če je food cost % nad 30%, razmislite o zvišanju cene ali zamenjavi dobavitelja.\n\n3. **Sezonski meni**: Dodajte sezonske artikle za povečanje zanimanja gostov.\n\n4. **Izločanje "psov"**: Artikli z nizko prodajo in nizko maržo bi morali biti odstranjeni iz menija.\n\n*Napredna analiza bo na voljo, ko bo API povezava obnovljena.*`;
  }

  if (lowerMsg.includes('zaloga') || lowerMsg.includes('dobavitelj') || lowerMsg.includes('naroč')) {
    return `📦 **Upravljanje zaloge**\n\n1. **Par level**: Določite minimalno in maksimalno zalogo za vsak artikel.\n\n2. **Samodejno naročanje**: Ko zaloga pade pod minimalno raven, samodejno ustvarite naročilo dobavitelju.\n\n3. **FCFO (First Cooked, First Out)**: Uporabljajte starejše zaloge najprej za zmanjšanje odpadkov.\n\n4. **Tedenski pregled**: Preverite porabo vsak ponedeljek in naročite za teden naprej.\n\n*Natančna analiza zalog bo na voljo, ko bo API povezava obnovljena.*`;
  }

  if (lowerMsg.includes('kader') || lowerMsg.includes('zaposlen') || lowerMsg.includes('izmen')) {
    return `👥 **Kadrovska optimizacija**\n\n1. **Obiskovalni vzorci**: Razporedite več osebja v konicah (petek-sobota 18:00-22:00).\n\n2. **Pametni odmori**: Načrtujte odmore izven konice obiska.\n\n3. **Križno usposabljanje**: Usposobite zaposlene za več vlog (natakar + barman).\n\n4. **Rezervna ekipa**: Imejte 1-2 rezervne osebe za nepričakovane obiske.\n\n*Natančna kadrovska analiza bo na volgo, ko bo API povezava obnovljena.*`;
  }

  return `🤖 **RestaurantOS AI Asistent**\n\nPozdravljeni! Sem vaš AI asistent za optimizacijo restavracije. Lahko vam pomagam z:\n\n- 📊 **Optimizacija menija** — "Kako optimiziram meni?"\n- 📦 **Upravljanje zaloge** — "Kaj moram naročiti?"\n- 👥 **Kadrovska optimizacija** — "Koliko osebja potrebujem?"\n- 💰 **Stroški hrane** — "Kakšen je moj food cost?"\n- 📈 **Napoved prodaje** — "Kakšna bo prodaja naslednji teden?"\n- 🎯 **Marketinški nasveti** — "Kako pritegnem več gostov?"\n\nPostavite mi vprašanje in vam bom pomagal z analizo vaših podatkov!`;
}

export async function GET(req: Request) {
  try {
    // FIX HIGH: Zahtevaj avtentikacijo za branje AI pogovorov — vsebuje poslovne podatke
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const conversations = await db.aIConversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json([]);
  }
}
