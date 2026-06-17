
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, AI_ASSISTANT_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'
import { SYSTEM_PROMPT, gatherDataContext, generateFallbackResponse } from './_helpers'
import { logger } from '@/lib/logger'


export const dynamic = 'force-dynamic'

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
