import { cpSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const staticDir = '.next/static'
const standaloneStatic = '.next/standalone/.next/static'
const publicDir = 'public'
const standalonePublic = '.next/standalone/public'

// FIX: Ensure target directories exist before cpSync (prevents ENOENT)
function ensureDir(dir) {
  if (!existsSync(dirname(dir))) {
    mkdirSync(dirname(dir), { recursive: true })
  }
}

if (existsSync(staticDir)) {
  ensureDir(standaloneStatic)
  cpSync(staticDir, standaloneStatic, { recursive: true })
  console.log('[build] Copied .next/static → .next/standalone/.next/static')
} else {
  console.warn('[build] Warning: .next/static not found — skipping copy')
}

if (existsSync(publicDir)) {
  ensureDir(standalonePublic)
  cpSync(publicDir, standalonePublic, { recursive: true })
  console.log('[build] Copied public/ → .next/standalone/public')
} else {
  console.warn('[build] Warning: public/ not found — skipping copy')
}
