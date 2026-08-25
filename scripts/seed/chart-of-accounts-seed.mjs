// ============================================
// SEED: Slovenski kontni načrt (SKM 2006) — poenostavljen za restavracije
// ============================================
// Zaženi: node scripts/seed/chart-of-accounts-seed.mjs
// Ali:    curl -X POST http://localhost:3000/api/seed/chart-of-accounts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ACCOUNTS = [
  // === SREDSTVA (Assets) ===
  { code: '1000', name: 'Banka', accountType: 'asset', sortOrder: 1 },
  { code: '1010', name: 'Blagajna', accountType: 'asset', sortOrder: 2 },
  { code: '1100', name: 'Terjatve strank', accountType: 'asset', sortOrder: 3 },
  { code: '1200', name: 'Zaloga surovin', accountType: 'asset', sortOrder: 4 },
  { code: '1210', name: 'Zaloga gotovih izdelkov', accountType: 'asset', sortOrder: 5 },
  { code: '1300', name: 'Oprema', accountType: 'asset', sortOrder: 6 },
  { code: '1310', name: 'Avtosredstva', accountType: 'asset', sortOrder: 7 },

  // === OBVEZNOSTI (Liabilities) ===
  { code: '2000', name: 'Dobavitelji', accountType: 'liability', sortOrder: 10 },
  { code: '2600', name: 'DDV izhodni', accountType: 'liability', sortOrder: 11 },
  { code: '2601', name: 'DDV vhodni', accountType: 'liability', sortOrder: 12 },
  { code: '2700', name: 'Kratkoročne obveznosti', accountType: 'liability', sortOrder: 13 },

  // === KAPITAL (Equity) ===
  { code: '3000', name: 'Temeljni kapital', accountType: 'equity', sortOrder: 20 },
  { code: '3100', name: 'Nerazporejeni dobiček', accountType: 'equity', sortOrder: 21 },

  // === PRIHODKI (Revenue) ===
  { code: '7000', name: 'Promet — na mestu', accountType: 'revenue', sortOrder: 30 },
  { code: '7010', name: 'Promet — s seboj', accountType: 'revenue', sortOrder: 31 },
  { code: '7020', name: 'Promet — dostava', accountType: 'revenue', sortOrder: 32 },
  { code: '7600', name: 'Napitnine', accountType: 'revenue', sortOrder: 33 },
  { code: '7900', name: 'Drugi prihodki', accountType: 'revenue', sortOrder: 34 },

  // === STROŠKI (Expenses) ===
  { code: '4000', name: 'Stroški materiala (COGS)', accountType: 'expense', sortOrder: 40 },
  { code: '4100', name: 'Stroški zaposlenih', accountType: 'expense', sortOrder: 41 },
  { code: '4110', name: 'Bruto plače', accountType: 'expense', sortOrder: 42 },
  { code: '4120', name: 'Prispevki delodajalca', accountType: 'expense', sortOrder: 43 },
  { code: '4200', name: 'Stroški najemnine', accountType: 'expense', sortOrder: 44 },
  { code: '4300', name: 'Stroški komunalnih storitev', accountType: 'expense', sortOrder: 45 },
  { code: '4400', name: 'Stroški energije', accountType: 'expense', sortOrder: 46 },
  { code: '4500', name: 'Stroški oglaševanja', accountType: 'expense', sortOrder: 47 },
  { code: '4600', name: 'Stroški vzdrževanja', accountType: 'expense', sortOrder: 48 },
  { code: '4900', name: 'Drugi stroški poslovanja', accountType: 'expense', sortOrder: 49 },
  { code: '5000', name: 'Amortizacija', accountType: 'expense', sortOrder: 50 },
]

async function main() {
  console.log('Seeding Chart of Accounts...')

  for (const account of ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      update: { name: account.name, accountType: account.accountType, sortOrder: account.sortOrder },
      create: account,
    })
    console.log(`  ✓ ${account.code} — ${account.name}`)
  }

  console.log(`\n✅ Seeded ${ACCOUNTS.length} accounts`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
