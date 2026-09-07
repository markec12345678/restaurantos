#!/usr/bin/env node
// ============================================
// CREATE UPSTASH REDIS — Free tier (10K commands/day)
// ============================================
// Ta script pomaga ustvariti brezplačni Upstash Redis instanco
// in nastaviti REDIS_URL na Vercel.
//
// Uporaba:
//   1. Ustvari račun na https://upstash.com (brezplačno)
//   2. Pojdi na Dashboard → API Keys → Create API Key
//   3. Zaženi: UPSTASH_EMAIL=xxx UPSTASH_API_KEY=xxx node scripts/create-upstash-redis.mjs
//
// Brezplačni tier:
//   - 10,000 commands/day
//   - 256MB storage
//   - Global multi-region
//   - Compatible with Redis protocol
// ============================================

const UPSTASH_EMAIL = process.env.UPSTASH_EMAIL
const UPSTASH_API_KEY = process.env.UPSTASH_API_KEY
const VERCEL_TOKEN = process.env.VERCEL_TOKEN // Set via env var, do NOT hardcode
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_8ymcBYAdqRj5QERaW8eWFK9xwBMn'

if (!UPSTASH_EMAIL || !UPSTASH_API_KEY) {
  console.log(`
🔴 Manjkajo Upstash credentials!

1. Ustvari račun na https://upstash.com (brezplačno)
2. Pojdi na Dashboard → API Keys → Create API Key
3. Zaženi:
   UPSTASH_EMAIL=your@email.com UPSTASH_API_KEY=xxx VERCEL_TOKEN=xxx node scripts/create-upstash-redis.mjs

Brezplačni tier vključuje:
  - 10,000 commands/day
  - 256MB storage
  - Global multi-region

ALTERNATIVA: Aplikacija deluje tudi brez Redis (MemoryCacheAdapter).
Redis je potreben samo za multi-replica production deploy.
Za single-instance Vercel Hobby deploy, MemoryCacheAdapter je dovolj.
`)
  process.exit(1)
}

if (!VERCEL_TOKEN) {
  console.log('🔴 Manjka VERCEL_TOKEN env var!')
  console.log('   Ustvari token na: https://vercel.com/account/tokens')
  process.exit(1)
}

async function createRedis() {
  console.log('🔄 Ustvarjam Upstash Redis instanco...')

  // 1. Ustvari Redis database
  const createResp = await fetch('https://api.upstash.com/v2/redis/database', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${UPSTASH_EMAIL}:${UPSTASH_API_KEY}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'restaurantos-prod',
      region: 'eu-central-1', // Frankfurt — najbližje Sloveniji
      tls: true,
    }),
  })

  if (!createResp.ok) {
    const err = await createResp.text()
    throw new Error(`Upstash create failed: ${createResp.status} ${err}`)
  }

  const db = await createResp.json()
  console.log('✅ Redis database ustvarjen!')
  console.log(`   ID: ${db.database_id}`)
  console.log(`   Region: ${db.region}`)
  console.log(`   Endpoint: ${db.endpoint}`)

  const redisUrl = `rediss://default:${db.password}@${db.endpoint}:6379`
  console.log(`   REDIS_URL: ${redisUrl.replace(db.password, '***')}`)

  // 2. Nastavi na Vercel
  console.log('\n🔄 Nastavljam REDIS_URL na Vercel...')

  // Production
  const prodResp = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: 'REDIS_URL',
        value: redisUrl,
        type: 'encrypted',
        target: ['production'],
      }),
    }
  )

  if (!prodResp.ok) {
    const err = await prodResp.text()
    throw new Error(`Vercel env set failed: ${prodResp.status} ${err}`)
  }

  console.log('✅ REDIS_URL nastavljen na Vercel (production)')

  // Preview
  await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: 'REDIS_URL',
        value: redisUrl,
        type: 'encrypted',
        target: ['preview'],
      }),
    }
  )

  console.log('✅ REDIS_URL nastavljen na Vercel (preview)')

  console.log('\n🎉 Redis je konfiguriran!')
  console.log('   Aplikacija bo samodejno uporabila RedisCacheAdapter.')
  console.log('   Health check: https://restaurantos-theta.vercel.app/api/health?detailed=true')
}

createRedis().catch(err => {
  console.error('❌ Napaka:', err.message)
  process.exit(1)
})
