// POST /api/ai/voice-order — AI Voice Ordering z Gemini
// Sprejme text (transkript glasu) ali audio (base64) in vrne strukturirano naročilo
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { z } from 'zod'

const voiceOrderSchema = z.object({
  transcript: z.string().min(1, 'Transkript je obvezen'),
  tableId: z.string().nullable().optional(),
  customerName: z.string().max(100).default('Voice Order'),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    let data
    try { data = voiceOrderSchema.parse(bodyResult.data) } catch { return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }

    // Pridobi vse aktivne meni artikle za AI matching
    const menuItems = await db.menuItem.findMany({
      where: { isAvailable: true },
      select: { id: true, name: true, price: true, vatRate: true, description: true },
    })

    // AI parsing z Gemini (z-ai-web-dev-sdk) — fallback na simple keyword matching
    let parsedItems: Array<{ menuItemId: string; name: string; quantity: number }> = []
    let aiPowered = false

    try {
      // Poskusi z Gemini AI
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const menuContext = menuItems.map(m => `- ${m.name} (€${m.price})`).join('\n')
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: `Si pomočnik v restavraciji. Stranka je naročila z glasom. Prepoznaj artikle in količine. Vrni JSON array format: [{"name":"ime artikla","quantity":število}]. Meni:\n${menuContext}` },
          { role: 'user', content: data.transcript },
        ],
        thinking: { type: 'disabled' },
      })
      const aiResponse = completion.choices[0]?.message?.content || ''
      // Parse AI JSON response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const aiItems = JSON.parse(jsonMatch[0]) as Array<{ name: string; quantity: number }>
        for (const ai of aiItems) {
          const match = menuItems.find(m =>
            m.name.toLowerCase().includes(ai.name.toLowerCase()) ||
            ai.name.toLowerCase().includes(m.name.toLowerCase())
          )
          if (match) {
            parsedItems.push({ menuItemId: match.id, name: match.name, quantity: Math.max(1, ai.quantity || 1) })
          }
        }
        aiPowered = true
      }
    } catch {
      // Fallback: simple keyword matching
    }

    // Fallback keyword matching če AI ni uspel
    if (parsedItems.length === 0) {
      const transcriptLower = data.transcript.toLowerCase()
      for (const mi of menuItems) {
        const nameLower = mi.name.toLowerCase()
        if (transcriptLower.includes(nameLower)) {
          // Poizkusi najti količino (npr. "dve pivi" → 2)
          const qtyMatch = transcriptLower.match(new RegExp(`(\\d+)\\s*${nameLower}`))
          const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1
          parsedItems.push({ menuItemId: mi.id, name: mi.name, quantity })
        }
      }
    }

    if (parsedItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ni bilo mogoče prepoznati artiklov iz glasu',
        transcript: data.transcript,
        aiPowered,
      }, { status: 404 })
    }

    // Izračunaj skupni znesek
    let total = 0
    const itemsWithPrice = parsedItems.map(pi => {
      const mi = menuItems.find(m => m.id === pi.menuItemId)!
      const lineTotal = Number(mi.price) * pi.quantity
      total += lineTotal
      return { ...pi, price: Number(mi.price), lineTotal, vatRate: Number(mi.vatRate) }
    })

    return NextResponse.json({
      success: true,
      aiPowered,
      transcript: data.transcript,
      items: itemsWithPrice,
      total: Math.round(total * 100) / 100,
      tableId: data.tableId,
      customerName: data.customerName,
      message: `Prepoznano ${itemsWithPrice.length} artiklov (AI: ${aiPowered ? 'da' : 'ne'})`,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ai/voice-order', 'Napaka pri AI voice ordering')
  }
}
