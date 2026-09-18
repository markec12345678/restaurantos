
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AI_ASSISTANT_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'
import { SYSTEM_PROMPT, gatherDataSnapshot, generateLocalAnswer } from './_helpers'
import { logger } from '@/lib/logger'


export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za AI asistenta
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX: Omejitev hitrosti — AI klici stanejo denar, prepreči zlorabo
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimitAsync('ai-assistant', ip, AI_ASSISTANT_LIMIT)
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

    // RUNDA 34: strukturerani podatki — poganjajo LOKALNO inteligenco,
    // Gemini pa dobi isti kontekst kot prompt dodatek.
    const { snapshot, context: dataContext } = await gatherDataSnapshot();

    const apiKey = process.env.GEMINI_API_KEY;
    const startTime = Date.now();

    let aiText: string;
    let model: string;
    let isFallback = false;

    if (apiKey) {
      // ─── Pot 1: Gemini (če je ključ nastavljen) ───
      const fullPrompt = `${SYSTEM_PROMPT}\n\n--- TRENUTNI PODATKI RESTAVRACIJE ---\n${dataContext}\n\n--- VPRAŠANJE UPORABNIKA ---\n${message}`;
      try {
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

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('API', 'Gemini API error:', errorText);
          throw new Error(`Gemini ${response.status}`);
        }

        const geminiData = await response.json();
        aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!aiText) throw new Error('Gemini empty response');
        model = 'gemini-2.0-flash';
      } catch (geminiError) {
        // RUNDA 34: Gemini odpovedal → lokalna inteligenca (data-driven)
        logger.error('API', 'Gemini ni na voljo, uporabljam lokalni odgovor:', geminiError);
        aiText = generateLocalAnswer(message, snapshot);
        model = 'local-v1';
        isFallback = true;
      }
    } else {
      // ─── Pot 2 (runda 34): BREZ zunanjega API-ja — lokalna inteligenca
      // na realnih DB podatkih. Prej: 500 "Gemini API ključ ni nastavljen"
      // → klient vedno prikazal "prišlo je do napake".
      aiText = generateLocalAnswer(message, snapshot);
      model = 'local-v1';
      isFallback = true;
    }

    const responseTimeMs = Date.now() - startTime;

    // Log the conversation
    await db.aIConversation.create({
      data: {
        type,
        userMessage: message,
        aiResponse: aiText,
        model,
        tokensUsed: 0,
        responseTimeMs,
        employeeId: (context.employeeId as string) || null,
      },
    }).catch((logError) => {
      // Log-pisanje ne sme podreti odgovora
      logger.error('API', 'AI conversation log failed:', logError);
    });

    return NextResponse.json({
      response: aiText,
      type,
      model,
      tokensUsed: 0,
      responseTimeMs,
      ...(isFallback ? { isFallback: true } : {}),
    });
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ai-assistant', 'Napaka pri AI asistentu')
  }
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
    return NextResponse.json(deepToNumbers(conversations));
  } catch (error: unknown) {
    // FIX: prej je ta koda tiho vrnila [] — admin je videl prazen seznam
    // brez indikacije napake. Sedaj logiraj in vrni 500.
    return handleApiError(error, 'GET /api/ai-assistant', 'Napaka pri pridobivanju AI pogovorov')
  }
}
