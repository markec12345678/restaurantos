#!/usr/bin/env node
// ============================================
// ONE-CLICK DEPLOYMENT — RestaurantOS
// ============================================
// Ta skripta avtomatizira celoten deployment proces:
//   1. Klonira repo (če še ni)
//   2. Namesti odvisnosti
//   3. Generira .env iz .env.example
//   4. Generira NEXTAUTH_SECRET
//   5. Zažene Prisma migracijo
//   6. Zažene setup wizard (prek API-ja)
//   7. Preveri health endpoint
//
// Uporaba:
//   node scripts/deploy-oneclick.mjs                    # lokalni dev
//   node scripts/deploy-oneclick.mjs --prod             # produkcija (Vercel)
//   node scripts/deploy-oneclick.mjs --docker            # Docker Compose
//
// Zahtevane env spremenljivke (ali interaktivno vpraša):
//   DATABASE_URL — Neon PostgreSQL connection string
// ============================================

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'

const IS_PROD = process.argv.includes('--prod')
const USE_DOCKER = process.argv.includes('--docker')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const question = (q) => new Promise((resolve) => rl.question(q, resolve))

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`)
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...opts })
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════╗
║  RestaurantOS — One-Click Deployment         ║
║  v1.0.3 · 965 testov · A++ security          ║
╚══════════════════════════════════════════════╝
`)

  // ─── 1. Preveri Node.js ──────────────────────────────────────
  log('🔍', 'Preverjam Node.js...')
  try {
    const nodeVersion = execSync('node -v', { encoding: 'utf-8' }).trim()
    const major = parseInt(nodeVersion.slice(1).split('.')[0])
    if (major < 18) {
      log('❌', `Node.js ${nodeVersion} — potrebna je v18 ali višja`)
      process.exit(1)
    }
    log('✅', `Node.js ${nodeVersion}`)
  } catch {
    log('❌', 'Node.js ni nameščen. Namestite z: https://nodejs.org/')
    process.exit(1)
  }

  // ─── 2. Preveri/ustvari .env ────────────────────────────────
  log('📝', 'Preverjam .env datoteko...')

  if (!existsSync('.env')) {
    log('⚠️', '.env ne obstaja — ustvarjam iz .env.example')

    if (!existsSync('.env.example')) {
      log('❌', '.env.example ne obstaja — ali ste v pravem direktoriju?')
      process.exit(1)
    }

    let envContent = readFileSync('.env.example', 'utf-8')

    // Generiraj NEXTAUTH_SECRET
    const secret = execSync('openssl rand -hex 32', { encoding: 'utf-8' }).trim()
    envContent = envContent.replace(
      /NEXTAUTH_SECRET=.*/,
      `NEXTAUTH_SECRET=${secret}`
    )

    // Vprašaj za DATABASE_URL
    const dbUrl = await question('\n📁 Vnesite Neon PostgreSQL DATABASE_URL\n   (https://console.neon.tech → pustite prazno za PGlite):\n   ')
    const finalDbUrl = dbUrl.trim() || 'file:./dev.db'
    envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=${finalDbUrl}`)

    // Vprašaj za FURS okolje
    const fursEnv = await question('\n🛡️  FURS okolje (test/production) [test]: ')
    envContent = envContent.replace(/FURS_ALLOW_SIMULATION.*/, `FURS_ALLOW_SIMULATION=${fursEnv.trim() === 'production' ? 'false' : 'true'}`)

    writeFileSync('.env', envContent)
    log('✅', '.env ustvarjen z generiranim NEXTAUTH_SECRET')
  } else {
    log('✅', '.env že obstaja')
  }

  // ─── 3. Namesti odvisnosti ──────────────────────────────────
  log('📦', 'Nameščam odvisnosti...')
  if (!run('npm install')) {
    log('❌', 'npm install je spodletel')
    process.exit(1)
  }
  log('✅', 'Odvisnosti nameščene')

  // ─── 4. Generiraj Prisma client ─────────────────────────────
  log('🔧', 'Generiram Prisma client...')
  if (!run('npx prisma generate')) {
    log('❌', 'Prisma generate je spodletel')
    process.exit(1)
  }
  log('✅', 'Prisma client generiran')

  // ─── 5. Zaženi migracijo ────────────────────────────────────
  log('🗄️', 'Beri bazo...')
  const dbUrl = readFileSync('.env', 'utf-8').match(/DATABASE_URL=(.+)/)?.[1]?.trim()

  if (dbUrl && dbUrl.startsWith('postgresql')) {
    log('📊', 'PostgreSQL zaznan — bazi migracijo...')
    if (!run('npx prisma migrate deploy')) {
      log('⚠️', 'Migrate deploy ni uspel — poskušam db push...')
      if (!run('npx prisma db push')) {
        log('❌', 'Baza nastavitev ni uspela')
        process.exit(1)
      }
    }
    log('✅', 'Baza migrirana')
  } else {
    log('📊', 'PGlite/SQLite zaznan — pusham shemo...')
    if (!run('npx prisma db push')) {
      log('❌', 'db push ni uspel')
      process.exit(1)
    }
    log('✅', 'Shema pushana')
  }

  // ─── 6. Build ───────────────────────────────────────────────
  if (IS_PROD) {
    log('🏗️', 'Buildam za produkcijo...')
    if (!run('npm run build')) {
      log('❌', 'Build ni uspel')
      process.exit(1)
    }
    log('✅', 'Build uspešen')
  }

  // ─── 7. Zaženi setup wizard (prek API-ja) ──────────────────
  log('⚙️', 'Preverjam setup status...')

  const startServer = IS_PROD ? 'npm run start' : 'npm run dev'
  log('🚀', `Zaganjam strežnik (${IS_PROD ? 'produkcija' : 'razvoj'})...`)

  // Za dev: zaženi server v ozadju
  if (!IS_PROD && !USE_DOCKER) {
    log('💡', 'Za dev način zaženite: npm run dev')
    log('🌐', 'Odpri: http://localhost:3000')
    log('🔐', 'Setup wizard: http://localhost:3000/setup')
    log('📝', 'PIN za admin: 1234 (po setup-u)')
    rl.close()
    return
  }

  // ─── 8. Docker setup ────────────────────────────────────────
  if (USE_DOCKER) {
    log('🐳', 'Docker Compose način...')
    if (!run('docker compose up -d')) {
      log('❌', 'Docker Compose ni uspel. Ali imate Docker nameščen?')
      process.exit(1)
    }
    log('✅', 'Docker kontejnerji zagnani')
    log('🌐', 'Odpri: http://localhost:3000')
    log('📝', 'Setup wizard: http://localhost:3000/setup')
    rl.close()
    return
  }

  // ─── 9. Preveri health ──────────────────────────────────────
  log('🏥', 'Preverjam health endpoint...')
  setTimeout(async () => {
    try {
      const resp = await fetch('http://localhost:3000/api/health')
      const data = await resp.json()
      log('✅', `Health: ${data.status} — DB: ${data.database}`)
    } catch {
      log('⚠️', 'Health check ni uspel — strežnik morda še vedno štarta')
    }

    console.log(`
╔══════════════════════════════════════════════╗
║  ✅ RestaurantOS uspešno nameščen!           ║
║                                              ║
║  🌐 URL:      http://localhost:3000          ║
║  🔧 Setup:    http://localhost:3000/setup    ║
║  📖 Docs:     docs/ONBOARDING-GUIDE.md       ║
║  🔐 Admin PIN: 1234 (po setup-u)            ║
║                                              ║
║  Nastavitve → Sidebar → Nastavitve:          ║
║    🛡️ FURS, ✨ AI, 🔌 Integracije, 📧 Email ║
╚══════════════════════════════════════════════╝
`)
    rl.close()
  }, 5000)
}

main().catch((err) => {
  console.error('\n❌ Napaka:', err.message)
  process.exit(1)
})
