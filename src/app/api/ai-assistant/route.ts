import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

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

    const body = await req.json();
    const { message, type = 'general', context = {} } = body;

    // Gather real data for context
    const dataContext = await gatherDataContext(context);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API ključ ni nastavljen' }, { status: 500 });
    }

    const startTime = Date.now();

    // Build the full prompt with context
    const fullPrompt = `${SYSTEM_PROMPT}\n\n--- TRENUTNI PODATKI RESTAVRACIJE ---\n${dataContext}\n\n--- VPRAŠANJE UPORABNIKA ---\n${message}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Gemini API error:', errorText);
      // Return a helpful fallback response instead of erroring
      return NextResponse.json({
        response: generateFallbackResponse(message, type, dataContext),
        type,
        model: 'fallback',
        responseTimeMs,
        isFallback: true,
      });
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Oprostite, nisem mogel generirati odgovora.';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    // Log the conversation
    await db.aIConversation.create({
      data: {
        type,
        userMessage: message,
        aiResponse: aiText,
        model: 'gemini-2.0-flash',
        tokensUsed,
        responseTimeMs,
        employeeId: context.employeeId || null,
      },
    });

    return NextResponse.json({
      response: aiText,
      type,
      model: 'gemini-2.0-flash',
      tokensUsed,
      responseTimeMs,
    });
  } catch (error: any) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      { error: 'Napaka pri AI asistentu' },
      { status: 500 }
    );
  }
}

async function gatherDataContext(context: any): Promise<string> {
  const parts: string[] = [];

  try {
    // Sales summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await db.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'cancelled' } },
      include: { orderItems: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalRevenue = recentOrders.reduce((sum, o) => sum + o.total, 0);
    const avgCheck = recentOrders.length > 0 ? totalRevenue / recentOrders.length : 0;

    parts.push(`PRODAJA (zadnjih 30 dni): Skupaj ${recentOrders.length} naročil, Prihodek: €${totalRevenue.toFixed(2)}, Povprečen ček: €${avgCheck.toFixed(2)}`);

    // Top selling items
    const itemSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    recentOrders.forEach(o => {
      o.orderItems.forEach(oi => {
        if (!oi.voided && oi.menuItem) {
          const key = oi.menuItemId;
          if (!itemSales[key]) {
            itemSales[key] = { name: oi.menuItem.name, qty: 0, revenue: 0 };
          }
          itemSales[key].qty += oi.quantity;
          itemSales[key].revenue += oi.price * oi.quantity;
        }
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    if (topItems.length > 0) {
      parts.push(`TOP 10 ARTIKLI: ${topItems.map((i, idx) => `${idx + 1}. ${i.name} (${i.qty}x, €${i.revenue.toFixed(2)})`).join(', ')}`);
    }

    // Inventory status
    const lowStock = await db.inventoryItem.findMany({
      where: { quantity: { lte: db.inventoryItem.fields.minQuantity } },
      take: 10,
    });

    if (lowStock.length > 0) {
      parts.push(`NIZKA ZALOGA: ${lowStock.map(i => `${i.name} (${i.quantity}/${i.minQuantity} ${i.unit})`).join(', ')}`);
    }

    // Menu items count
    const menuItemCount = await db.menuItem.count({ where: { isAvailable: true } });
    parts.push(`MENI: ${menuItemCount} aktivnih artiklov`);

    // Employees on shift today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeTimeEntries = await db.timeEntry.findMany({
      where: { clockIn: { gte: today }, clockOut: null },
      include: { employee: true },
    });

    if (activeTimeEntries.length > 0) {
      parts.push(`ZAPOSLENI NA IZMENI: ${activeTimeEntries.map(te => te.employee.name).join(', ')}`);
    }

    // Reservations today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reservations = await db.reservation.findMany({
      where: { dateTime: { gte: today, lt: tomorrow }, status: 'confirmed' },
    });

    if (reservations.length > 0) {
      const totalGuests = reservations.reduce((sum, r) => sum + r.partySize, 0);
      parts.push(`REZERVACIJE DANES: ${reservations.length} rezervacij, skupaj ${totalGuests} gostov`);
    }

  } catch (error) {
    parts.push('Podatki trenutno niso dosegljivi');
  }

  return parts.join('\n');
}

function generateFallbackResponse(message: string, type: string, dataContext: string): string {
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

export async function GET() {
  try {
    const conversations = await db.aIConversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(conversations);
  } catch (error) {
    return NextResponse.json([]);
  }
}
