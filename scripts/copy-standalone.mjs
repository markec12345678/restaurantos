import { cpSync, existsSync } from 'fs'
import { join } from 'path'

const staticDir = '.next/static'
const standaloneStatic = '.next/standalone/.next/static'
const publicDir = 'public'
const standalonePublic = '.next/standalone/public'

if (existsSync(staticDir)) {
  cpSync(staticDir, standaloneStatic, { recursive: true })
  console.log('[build] Copied .next/static → .next/standalone/.next/static')
}

if (existsSync(publicDir)) {
  cpSync(publicDir, standalonePublic, { recursive: true })
  console.log('[build] Copied public/ → .next/standalone/public')
}
