// GET /api/auth/webauthn — Generiraj WebAuthn challenge za biometric login
// POST /api/auth/webauthn — Verificiraj WebAuthn assertion + login
//
// ⚠️ SECURITY: WebAuthn implementation is INCOMPLETE.
// `verifyAssertion()` v `src/lib/webauthn/index.ts` NE preverja kriptografskega podpisa —
// preverja samo `clientData.challenge`, kar napadalec lahko trivialno ponaredi.
// To pomeni, da lahko vsak, ki pozna `employeeId`, dobi veljaven session token.
//
// Dokler ne bo integriran `@simplewebauthn/server` za pravo preverjanje podpisa,
// je ta route onemogočen, razen če je env spremenljivka `WEBAUTHN_ENABLED=true`.
// Tudi takrat naj se uporablja samo v zaprtem testnem okolju.
//
// TODO: integriraj @simplewebauthn/server (verifyAuthenticationResponse + verifyRegistrationResponse)
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function webauthnDisabled() {
  return NextResponse.json(
    {
      error: 'WebAuthn biometric login je trenutno onemogočen.',
      reason: 'implementacija preverjanja podpisa ni dokončana — varnostna luknja',
      hint: 'uporabljajte PIN prijavo ali nastavite WEBAUTHN_ENABLED=true v .env (samo za testno okolje)',
      docs: 'https://github.com/markec12345678/restaurantos/security',
    },
    { status: 503 }
  )
}

export async function GET() {
  if (process.env.WEBAUTHN_ENABLED !== 'true') {
    return webauthnDisabled()
  }
  // Eksperimentalna pot — vrani jasno opozorilo, da implementacija ni varna
  return NextResponse.json({
    warning: 'WebAuthn je v eksperimentalnem načinu — preverjanje podpisa NI implementirano!',
    rpId: process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : 'localhost',
    timeout: 60000,
    userVerification: 'required',
    experimental: true,
  })
}

export async function POST() {
  // Tudi z WEBAUTHN_ENABLED=true onemogočimo POST, ker verifyAssertion() ne preverja podpisa.
  // Za pravo WebAuthn podporo je treba najprej integrirati @simplewebauthn/server.
  return webauthnDisabled()
}
