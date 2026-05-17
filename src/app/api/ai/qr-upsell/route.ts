import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// =====================================================================
// AI SMART PAIRING UPSELL - World-Class 2026
// Uporablja Gemini za personalizirane predloge na osnovi:
// 1. Časa dneva (zajtrk/kosilo/večerja)
// 2. Vsebine košarice (pairing logika)
// 3. Zgodovine naročil (popular items)
// =====================================================================

interface CartItem {
  menuItemId: string
  name: string
  category: string
  price: number
}

const HOUR_MAP: Record<string, { label: string; categories: string[] }> = {
  'morning':   { label: 'Zajtrk',   categories: ['Zajtrki', 'Kava', 'Vroče pijače', 'Sadni sokovi', 'Topla predjedi'] },
  'lunch':     { label: 'Kosilo',   categories: ['Juhe', 'Testenine', 'Rižote', 'Glavne jedi', 'Solate'] },
  'afternoon': { label: 'Popoldne', categories: ['Kava', 'Sladice', 'Koktajli', 'Prigrizki'] },
  'evening':   { label: 'Večerja',  categories: ['Predjedi', 'Glavne jedi', 'Jedi z žara', 'Vino', 'Koktajli'] },
  'night':     { label: 'Pozno',    categories: ['Koktajli', 'Pivo', 'Prigrizki', 'Burgerji'] },
}

function getTimeOfDay(hour: number): string {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

// Parjanja na osnovi pravil (fallback brez AI-ja)
const CLASSIC_PAIRINGS: Record<string, Array<{ name: string; reason: string }>> = {
  'beef': [
    { name: 'Cabernet Sauvignon', reason: 'Gosti ob tem steaku najraje naročijo kozarec Cabernet Sauvignona.' },
    { name: 'Malvazija', reason: 'Malvazija odlično poudari okus govedine.' },
  ],
  'fish': [
    { name: 'Sauvignon Blanc', reason: 'Sauvignonignon je klasika ob ribjih jedeh.' },
    { name: 'Rebula', reason: 'Rebula s primorskega je idealna spremljevalka rib.' },
  ],
  'pasta': [
    { name: 'Hišna solata', reason: 'Sveža solata je popolna dopolnitev testenin.' },
    { name: 'Merlot', reason: 'Merlot mehko dopolni paradižnikove omake.' },
  ],
  'pizza': [
    { name: 'Laški teran', reason: 'Teran in pica — slovenska klasika.' },
    { name: 'Coca Cola', reason: 'Osvježujoča Cola k pici vedno pristane.' },
  ],
  'burger': [
    { name: 'Pivo Union', reason: 'Hladno pivo in burger — nepogrešljiva kombinacija.' },
    { name: 'Pommes frites', reason: 'Krompirjev priloga k burgerju je must-have.' },
  ],
  'salad': [
    { name: 'Radenska', reason: 'Mineralna voda poobilno osveži ob solati.' },
    { name: 'Rizling', reason: 'Rizling lajša in dopolnjuje sveže okuse.' },
  ],
  'dessert': [
    { name: 'Kava espresso', reason: 'Espresso je zaključek vsakega sladkega obroka.' },
    { name: 'Tawny Port', reason: 'Sladki portugalec ojača okus sladice.' },
  ],
}

function getCategoryType(catName: string): string {
  const lower = catName.toLowerCase()
  if (lower.includes('mesn') || lower.includes('steak') || lower.includes('glavn') || lower.includes('žar')) return 'beef'
  if (lower.includes('rib') || lower.includes('seafood') || lower.includes('losos')) return 'fish'
  if (lower.includes('testenin') || lower.includes('pasta') || lower.includes('njok') || lower.includes('rižot')) return 'pasta'
  if (lower.includes('pic')) return 'pizza'
  if (lower.includes('burger')) return 'burger'
  if (lower.includes('solat')) return 'salad'
  if (lower.includes('sladic') || lower.includes('dessert')) return 'dessert'
  return 'beef'
}

export async function POST(req: Request) {
  try {
    // FIX: Omejitev velikosti body-ja — prepreči zlorabo z ogromnimi payloadi
    const bodyText = await req.text()
    if (bodyText.length > 10000) {
      return NextResponse.json({ suggestions: [], error: 'Payload prevelik' }, { status: 400 })
    }
    const body = JSON.parse(bodyText)
    const { cartItems, hour }: { cartItems: CartItem[]; hour?: number } = body

    const currentHour = hour ?? new Date().getHours()
    const timeOfDay = getTimeOfDay(currentHour)
    const timeInfo = HOUR_MAP[timeOfDay]

    // 1. TIME-OF-DAY: Kategorije, ki jih poudarimo glede na uro
    const promotedCategories = timeInfo.categories

    // 2. Pridobi vse razpoložljive artikle
    const allItems = await db.menuItem.findMany({
      where: { isAvailable: true },
      include: {
        category: { select: { name: true } },
      },
    })

    // 3. CLASSIC PAIRING LOGIKA (brez AI-ja — hitra in zanesljiva)
    const cartCategoryTypes = new Set<string>()
    const cartItemNames = new Set<string>()
    for (const item of cartItems || []) {
      cartCategoryTypes.add(getCategoryType(item.category || ''))
      cartItemNames.add(item.name)
    }

    const pairingSuggestions: Array<{
      menuItemId: string
      name: string
      price: number
      category: string
      reason: string
      type: 'pairing' | 'time-of-day' | 'popular'
    }> = []

    // Pairing predlogi
    for (const catType of cartCategoryTypes) {
      const pairings = CLASSIC_PAIRINGS[catType] || []
      for (const pairing of pairings) {
        const found = allItems.find(i =>
          i.name.toLowerCase().includes(pairing.name.toLowerCase()) &&
          !cartItemNames.has(i.name)
        )
        if (found && found.category) {
          pairingSuggestions.push({
            menuItemId: found.id,
            name: found.name,
            price: found.price,
            category: found.category.name,
            reason: pairing.reason,
            type: 'pairing',
          })
        }
      }
    }

    // Time-of-day predlogi
    const timeItems = allItems.filter(i =>
      i.category && promotedCategories.includes(i.category.name) && !cartItemNames.has(i.name)
    )
    // Vzemi 3 najbolj priljubljene (po sortOrder)
    const topTimeItems = timeItems
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 3)
    for (const item of topTimeItems) {
      if (!pairingSuggestions.find(p => p.menuItemId === item.id) && item.category) {
        pairingSuggestions.push({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          category: item.category.name,
          reason: `Popolna izbira za ${timeInfo.label.toLowerCase()} — med našimi najbolj priljubljenimi.`,
          type: 'time-of-day',
        })
      }
    }

    // 4. AI GEMINI UPGRADE: Poskusi z AI-jem za boljše predloge
    let aiPowered = false
    try {
      if (cartItems && cartItems.length > 0) {
        const zai = await ZAI.create()
        const cartDesc = cartItems.map(i => `${i.name} (${i.category})`).join(', ')
        const menuSample = allItems.slice(0, 30).map(i => `${i.name} - €${i.price.toFixed(2)} [${i.category?.name || ''}]`).join('\n')

        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `Si sommelier in svetovalec v slovenski restavraciji. Odgovarjajš v slovenščini. Predlagaj 2-3 dopolnilne artikle iz menija, ki se najbolje parjajo z jedmi v košarici. Upoštevaj čas dneva (${timeInfo.label}). Odgovori SAMO v JSON formatu: [{"name":"ime artikla","reason":"razlog zakaj"}]. Največ 3 predlogi.`
            },
            {
              role: 'user',
              content: `V košarici imam: ${cartDesc}\n\nRazpoložljivi artikli:\n${menuSample}\n\nKaj priporočaš?`
            }
          ],
        })

        const aiText = completion.choices?.[0]?.message?.content || ''
        // Poskusi razčleniti JSON iz odgovora
        const jsonMatch = aiText.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
          const aiSuggestions = JSON.parse(jsonMatch[0])
          for (const sug of aiSuggestions.slice(0, 3)) {
            const found = allItems.find(i =>
              i.name.toLowerCase().includes(sug.name?.toLowerCase() || '') &&
              !cartItemNames.has(i.name)
            )
            if (found && found.category && !pairingSuggestions.find(p => p.menuItemId === found.id)) {
              pairingSuggestions.push({
                menuItemId: found.id,
                name: found.name,
                price: found.price,
                category: found.category.name,
                reason: sug.reason || 'AI priporočilo',
                type: 'pairing',
              })
              aiPowered = true
            }
          }
        }
      }
    } catch (aiError) {
      console.log('[AI Upsell] Gemini ni na voljo, uporabljam klasična pravila:', (aiError as Error).message)
    }

    return NextResponse.json({
      suggestions: pairingSuggestions.slice(0, 5),
      timeOfDay: {
        key: timeOfDay,
        label: timeInfo.label,
        promotedCategories,
      },
      aiPowered,
    })

  } catch (error: any) {
    console.error('AI Upsell error:', error)
    return NextResponse.json({
      suggestions: [],
      timeOfDay: { key: 'evening', label: 'Večerja', promotedCategories: [] },
      aiPowered: false,
      error: error.message,
    }, { status: 500 })
  }
}
