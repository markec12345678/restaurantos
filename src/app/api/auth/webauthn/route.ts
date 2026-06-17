// GET /api/auth/webauthn — Generiraj WebAuthn challenge za biometric login
// POST /api/auth/webauthn — Verificiraj WebAuthn assertion + login
import { NextResponse } from 'next/server'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth-middleware/session-store'
import { generateChallenge, base64urlEncode, verifyAssertion } from '@/lib/webauthn'


// In-memory challenge store (v produkciji: Redis ali DB)
const challenges = new Map<string, { challenge: string; expires: number }>()

export async function GET() {
  try {
    const challenge = generateChallenge()
    const challengeB64 = base64urlEncode(challenge)
    const challengeId = crypto.randomUUID()
    challenges.set(challengeId, { challenge: challengeB64, expires: Date.now() + 5 * 60 * 1000 })

    return NextResponse.json({
      challengeId,
      challenge: challengeB64,
      rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      timeout: 60000,
      userVerification: 'required',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/auth/webauthn', 'Napaka pri WebAuthn challenge')
  }
}

export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { challengeId, assertion, employeeId } = bodyResult.data as {
      challengeId: string
      assertion: { credentialId: string; authenticatorData: string; clientDataJSON: string; signature: string }
      employeeId: string
    }

    // Pridobi in validiraj challenge
    const stored = challenges.get(challengeId)
    if (!stored || stored.expires < Date.now()) {
      return NextResponse.json({ error: 'Challenge je potekel' }, { status: 400 })
    }
    challenges.delete(challengeId) // One-time use

    // Verificiraj assertion
    if (!verifyAssertion(assertion, stored.challenge)) {
      return NextResponse.json({ error: 'Biometric avtentikacija ni uspela' }, { status: 401 })
    }

    // Pridobi zaposlenega
    const employee = await db.employee.findUnique({
      where: { id: employeeId, status: 'active' },
      include: { jobs: { include: { job: true } } },
    })
    if (!employee) return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })

    // Kreiraj sejo
    const allPermissions: string[] = []
    for (const ej of employee.jobs) {
      try {
        const perms = JSON.parse(ej.job.permissions || '[]')
        allPermissions.push(...perms)
      } catch { /* ignore */ }
    }
    const permissions = [...new Set(allPermissions)]
    const token = createSession({
      id: employee.id,
      role: employee.role,
      permissions,
    })

    return NextResponse.json({
      success: true,
      token,
      employee: { id: employee.id, name: employee.name, role: employee.role, permissions },
      message: `Biometric prijava uspešna — ${employee.name}`,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/auth/webauthn', 'Napaka pri WebAuthn login')
  }
}
