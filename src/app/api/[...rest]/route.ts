// ============================================
// RUNDA 69: Catch-all za neznane /api/* poti → 404 JSON
// ============================================
// KOREN RAZKRITEGA BUGA (R69 produkcija): neznana API pot (npr.
// PATCH /api/happy-hour/xxx, ko ruta še ni obstajala) je Next vrnil kot
// 200 + HTML not-found stran. Vsak client, ki preverja samo res.ok
// (authFetch vzorec), je TAKO videl uspeh → tihi lažni uspehi ("Izbrisano"
// toast, ampak se nič ni izbrisalo). Ta catch-all vrne 404 JSON za vse
// nespecificirane /api/* poti — specifične in dinamične rute imajo v
// Next routerju VEDNO prednost pred catch-all, zato je to čisto aditivno.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function jsonNotFound(): NextResponse {
  return NextResponse.json(
    { error: 'Neznana API pot — preverite URL in HTTP metodo.' },
    { status: 404 }
  )
}

export async function GET() { return jsonNotFound() }
export async function POST() { return jsonNotFound() }
export async function PUT() { return jsonNotFound() }
export async function PATCH() { return jsonNotFound() }
export async function DELETE() { return jsonNotFound() }
export async function OPTIONS() { return jsonNotFound() }
