// ============================================
// CRON WORKER — Scheduled emaili (obdelava čakajočih poročil)
// ============================================
// R164 (R163-S1, opcija 1 iz issue #140): Vercel Cron pošilja GET, ampak
// /api/scheduled-emails/process ima GET = read-only statistika za admin
// dashboard (kontrakt R85-4c platformAdminGate + R160 LJ poslovni dan)
// BREZ CRON_SECRET poti → registrirani cron (0 2) je dobil 401 in
// procesiranje prek Vercel Crona NE bi teklo.
//
// Ta wrapper je ločen cron path z GET === POST delegacijo (vzorec
// /api/cron/outbox :18-20): GET (Vercel Cron) in POST (ročni klic) tečeta
// skozi ISTO obdelavno logiko kot POST /api/scheduled-emails/process —
// CRON_SECRET Bearer (fail-closed) → sicer requireAuth admin +
// platformAdminGate. Stats kontrakt GET /api/scheduled-emails/process
// ostane NESPREMENJEN (dashboard pini R85-4c / R160 nedotaknjeni).
//
// Registracija (vercel.json — avtoritativni vir urnikov, R164):
//   { "crons": [{ "path": "/api/cron/scheduled-emails-process", "schedule": "0 2 * * *" }] }
// Vnos je PREUSMERJEN, ne dodan (ostane 2/2 cron mest na dokazanem Hobby
// planu — cron_jobs_limits_reached @ 398c24fb).
// ============================================

import { POST as processPOST } from '@/app/api/scheduled-emails/process/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // email batch + PDF generacija

// Vercel Cron pošilja GET → delegiraj na obdelavo (isto kot POST).
export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  return processPOST(req)
}
