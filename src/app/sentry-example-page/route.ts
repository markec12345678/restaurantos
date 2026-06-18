import { NextResponse } from 'next/server'

// ─── Sentry Verification Page ─────────────────────────────────
// GET /sentry-example-page — informational HTML
// POST /sentry-example-page — triggers a test error for Sentry capture
//
// Usage (from Sentry setup wizard):
//   1. Visit /sentry-example-page (GET) — see instructions
//   2. Click "Trigger Test Error" — sends POST → throws Error
//   3. Check Sentry Issues dashboard — error appears in ~5 seconds

export const dynamic = 'force-dynamic'

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sentry Test — RestaurantOS</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { color: #362d59; }
    button { background: #6d28d9; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; cursor: pointer; margin: 10px 0; }
    button:hover { background: #5b21b6; }
    .box { background: #f4f0fb; border-left: 4px solid #6d28d9; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
    .status { margin-top: 20px; font-weight: bold; }
    .ok { color: #16a34a; }
    .err { color: #dc2626; }
  </style>
</head>
<body>
  <h1>Sentry Integration Test</h1>
  <div class="box">
    <p><strong>Klikni spodnji gumb</strong> da sprožiš testno napako. Napaka se bo pojavila v Sentry Issues dashboard v ~5 sekundah.</p>
  </div>
  <button onclick="triggerError()">Sproži testno napako</button>
  <div id="status" class="status"></div>
  <script>
    async function triggerError() {
      const status = document.getElementById('status');
      status.textContent = 'Pošiljam...';
      status.className = 'status';
      try {
        const res = await fetch('/sentry-example-page', { method: 'POST' });
        if (res.ok) {
          status.textContent = '✅ Napaka sprožena! Preveri Sentry dashboard v ~5 sekundah.';
          status.className = 'status ok';
        } else {
          status.textContent = '⚠️ Napaka pri pošiljanju (status ' + res.status + ')';
          status.className = 'status err';
        }
      } catch (e) {
        status.textContent = '✅ Napaka sprožena! Preveri Sentry dashboard.';
        status.className = 'status ok';
      }
    }
  </script>
</body>
</html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function POST() {
  // Sproži testno napako — Sentry.captureException bi moral to ujeti.
  // METODA 1: vržemo exception, ki ga Next.js error boundary ulovi in
  // pošlje Sentry-ju preko onRequestError hook-a.
  const testError = new Error('[Sentry Test] Testna napaka iz /sentry-example-page — ' + new Date().toISOString())
  testError.name = 'SentryTestError'
  throw testError
}
