// ============================================
// app-info — verzija + commit za deploy forenziko
// ============================================
// Zakaj ta modul obstaja: "Ali je produkcija sinhronizirana?" mora biti
// odgovorljiv z ENIM curl-om (/api/health → { version, commit }).
//
//   - getAppVersion: next.config.ts (env.APP_VERSION) inlinira package.json
//     verzijo ob buildu (glej komentar next.config.ts:5-9); runtime
//     process.env.APP_VERSION (npr. Docker override) še vedno prevlada.
//     Legacy hardcodirani fallback '1.0.13' je ubit — health je poročal
//     zastarelo verzijo od runde 84 (package.json bil bumpan šele na 1.11.0).
//     'dev' fallback pokrije le kontekste brez next builda (lokalni skripti).
//
//   - getAppCommit: Vercel samodejno injicira VERCEL_GIT_COMMIT_SHA ob vsakem
//     deployu; GIT_COMMIT / COMMIT_SHA pokrijeta Docker/CI platforme, ki
//     uporabljajo svoja imena. null = commit ni znan (lokalni dev) — polje
//     ostane VEDNO prisotno v health odgovoru (forenzika brez ugibanja).
// ============================================

export function getAppVersion(): string {
  return process.env.APP_VERSION || 'dev'
}

export function getAppCommit(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT ??
    process.env.COMMIT_SHA ??
    null
  )
}
