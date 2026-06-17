import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { toNum } from '@/lib/decimal'
import { checkRateLimit, getClientIp, AI_UPSELL_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import {
  HOUR_MAP,
  getTimeOfDay,
  getClassicPairingSuggestions,
  type CartItem,

} from './_helpers'

import ZAI from 'z-ai-web-dev-sdk'


// =====================================================================
// AI SMART PAIRING UPSELL - World-Class 2026
// Uporablja Gemini za personalizirane predloge na osnovi:
// 1. Časa dneva (zajtrk/kosilo/večerja)
// 2. Vsebine košarice (pairing logika)
// 3. Zgodovine naročil (popular items)
// =====================================================================

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX AUTH: AI endpoint zahteva avtentikacijo — prepreči zlorabo in stroške
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX: Omejitev hitrosti — AI upsell klici stanejo denar
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit('ai-upsell', ip, AI_UPSELL_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { suggestions: [], error: 'Preveč zahtevkov. Poskusite znova čez nekaj časa.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)) } }
      )
    }

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
    const cartItemNames = new Set<string>()
    for (const item of cartItems || []) {
      cartItemNames.add(item.name)
    }

    const pairingSuggestions = getClassicPairingSuggestions(cartItems, allItems)

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
          price: toNum(item.price),
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
        const menuSample = allItems.slice(0, 30).map(i => `${i.name} - €${toNum(i.price).toFixed(2)} [${i.category?.name || ''}]`).join('\n')

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
                price: toNum(found.price),
                category: found.category.name,
                reason: sug.reason || 'AI priporočilo',
                type: 'pairing',
              })
              aiPowered = true
            }
          }
        }
      }
    } catch (aiError: unknown) {
      logger.info('AI-Upsell', 'Gemini ni na voljo, uporabljam klasična pravila:', (aiError as Error).message)
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

  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ai/qr-upsell', 'Napaka pri pridobivanju predlogov')
  }
}
