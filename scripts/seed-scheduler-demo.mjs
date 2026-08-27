// ============================================
// SEED: Staff Availability + Time Off + Demo Employees
// ============================================
// Poženi: bun scripts/seed-scheduler-demo.mjs
//
// Ustvari:
//   - Demo Employees (če jih še ni)
//   - StaffAvailability (razpoložljivost po dnevih)
//   - TimeOffRequest (1-2 demo prošnje za dopust)
//   - WalletPayment demo (za testiranje UI)
// ============================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed] Starting scheduler demo seed...')

  // 1. Pridobi ali kreiraj lokacijo
  let location = await prisma.location.findFirst()
  if (!location) {
    location = await prisma.location.create({
      data: {
        name: 'Glavna restavracija',
        code: 'HQ',
        type: 'restaurant',
        address: 'Slovenska 1',
        city: 'Ljubljana',
        premisesId: 'PREM-001',
      },
    })
    console.log(`[seed] Created location: ${location.name}`)
  } else {
    console.log(`[seed] Using existing location: ${location.name}`)
  }

  // 2. Pridobi ali kreiraj Jobs
  const jobData = [
    { name: 'Natakar', code: 'WTR', basePayRate: 9.5, overtimeRate: 14.25, sortOrder: 1 },
    { name: 'Kuhar', code: 'CHF', basePayRate: 11.0, overtimeRate: 16.5, sortOrder: 2 },
    { name: 'Barman', code: 'BAR', basePayRate: 10.0, overtimeRate: 15.0, sortOrder: 3 },
    { name: 'Vodja izmene', code: 'MGR', basePayRate: 14.0, overtimeRate: 21.0, sortOrder: 4 },
    { name: 'Skladnik', code: 'DSP', basePayRate: 8.5, overtimeRate: 12.75, sortOrder: 5 },
    { name: 'Pripravnik', code: 'PRP', basePayRate: 7.5, overtimeRate: 11.25, sortOrder: 6 },
  ]

  const jobs = []
  for (const jd of jobData) {
    const job = await prisma.job.upsert({
      where: { code: jd.code },
      create: jd,
      update: {},
    })
    jobs.push(job)
  }
  console.log(`[seed] ${jobs.length} jobs ensured`)

  // 3. Demo Employees
  const employeeData = [
    { name: 'Ana Novak', email: 'ana.novak@demo.si', phone: '+38641234501', pin: '1234', role: 'server' },
    { name: 'Marko Horvat', email: 'marko.horvat@demo.si', phone: '+38641234502', pin: '2345', role: 'chef' },
    { name: 'Petra Kovač', email: 'petra.kovac@demo.si', phone: '+38641234503', pin: '3456', role: 'bartender' },
    { name: 'Janez Kranjc', email: 'janez.kranjc@demo.si', phone: '+38641234504', pin: '4567', role: 'manager' },
    { name: 'Maja Zupan', email: 'maja.zupan@demo.si', phone: '+38641234505', pin: '5678', role: 'prep' },
    { name: 'Tomaž Bizjak', email: 'tomaz.bizjak@demo.si', phone: '+38641234506', pin: '6789', role: 'dishwasher' },
    { name: 'Sara Kolar', email: 'sara.kolar@demo.si', phone: '+38641234507', pin: '7890', role: 'server' },
    { name: 'Luka Kos', email: 'luka.kos@demo.si', phone: '+38641234508', pin: '8901', role: 'chef' },
  ]

  const employees = []
  for (const ed of employeeData) {
    const emp = await prisma.employee.upsert({
      where: { email: ed.email },
      create: { ...ed, status: 'active', locationId: location.id },
      update: {},
    })
    employees.push(emp)

    // Poveži z Job (primary)
    const matchingJob = jobs.find((j) => {
      const jn = j.name.toLowerCase()
      const er = ed.role.toLowerCase()
      if (er === 'server' && jn.includes('natakar')) return true
      if (er === 'chef' && jn.includes('kuhar')) return true
      if (er === 'bartender' && jn.includes('barm')) return true
      if (er === 'manager' && jn.includes('vodja')) return true
      if (er === 'prep' && jn.includes('pripravnik')) return true
      if (er === 'dishwasher' && jn.includes('skladnik')) return true
      return false
    })
    if (matchingJob) {
      await prisma.employeeJob.upsert({
        where: { employeeId_jobId: { employeeId: emp.id, jobId: matchingJob.id } },
        create: {
          employeeId: emp.id,
          jobId: matchingJob.id,
          payRate: matchingJob.basePayRate,
          isPrimary: true,
        },
        update: {},
      })
    }
  }
  console.log(`[seed] ${employees.length} demo employees ensured`)

  // 4. StaffAvailability — tipična razpoložljivost
  // 0=nedelja, 1=pon, ..., 6=sob
  const availabilityPatterns = [
    // Ana — ponedeljek-petek dopoldne
    { employeeIdx: 0, slots: [
      { dayOfWeek: 1, startTime: '07:00', endTime: '15:00', isPreferred: true },
      { dayOfWeek: 2, startTime: '07:00', endTime: '15:00', isPreferred: true },
      { dayOfWeek: 3, startTime: '07:00', endTime: '15:00', isPreferred: true },
      { dayOfWeek: 4, startTime: '07:00', endTime: '15:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '07:00', endTime: '15:00', isPreferred: true },
    ]},
    // Marko — ponedeljek-sobota popoldan
    { employeeIdx: 1, slots: [
      { dayOfWeek: 1, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 2, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 3, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 4, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 6, startTime: '15:00', endTime: '23:00', isPreferred: false },
    ]},
    // Petra — torek-sobota večer
    { employeeIdx: 2, slots: [
      { dayOfWeek: 2, startTime: '19:00', endTime: '03:00', isPreferred: true },
      { dayOfWeek: 3, startTime: '19:00', endTime: '03:00', isPreferred: true },
      { dayOfWeek: 4, startTime: '19:00', endTime: '03:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '19:00', endTime: '03:00', isPreferred: true },
      { dayOfWeek: 6, startTime: '19:00', endTime: '03:00', isPreferred: true },
    ]},
    // Janez (manager) — ponedeljek-petek dopoldne
    { employeeIdx: 3, slots: [
      { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isPreferred: true },
      { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', isPreferred: true },
      { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', isPreferred: true },
      { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', isPreferred: true },
    ]},
    // Maja — delno (študentska)
    { employeeIdx: 4, slots: [
      { dayOfWeek: 1, startTime: '11:00', endTime: '19:00', isPreferred: true },
      { dayOfWeek: 3, startTime: '11:00', endTime: '19:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 6, startTime: '11:00', endTime: '19:00', isPreferred: false },
    ]},
    // Tomaž — ponedeljek-petek popoldne (krajevno)
    { employeeIdx: 5, slots: [
      { dayOfWeek: 1, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 2, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 4, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '15:00', endTime: '23:00', isPreferred: true },
    ]},
    // Sara — vikend
    { employeeIdx: 6, slots: [
      { dayOfWeek: 0, startTime: '11:00', endTime: '19:00', isPreferred: true },
      { dayOfWeek: 6, startTime: '11:00', endTime: '19:00', isPreferred: true },
      { dayOfWeek: 6, startTime: '15:00', endTime: '23:00', isPreferred: false },
      { dayOfWeek: 0, startTime: '15:00', endTime: '23:00', isPreferred: false },
    ]},
    // Luka — popoldan/večer
    { employeeIdx: 7, slots: [
      { dayOfWeek: 2, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 3, startTime: '15:00', endTime: '23:00', isPreferred: true },
      { dayOfWeek: 4, startTime: '19:00', endTime: '03:00', isPreferred: true },
      { dayOfWeek: 5, startTime: '19:00', endTime: '03:00', isPreferred: true },
      { dayOfWeek: 6, startTime: '19:00', endTime: '03:00', isPreferred: true },
    ]},
  ]

  let availabilityCount = 0
  for (const pattern of availabilityPatterns) {
    const emp = employees[pattern.employeeIdx]
    if (!emp) continue
    for (const slot of pattern.slots) {
      try {
        await prisma.staffAvailability.upsert({
          where: {
            employeeId_dayOfWeek_startTime_endTime: {
              employeeId: emp.id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          },
          create: { ...slot, employeeId: emp.id },
          update: {},
        })
        availabilityCount++
      } catch (e) {
        // Ignore duplicates
      }
    }
  }
  console.log(`[seed] ${availabilityCount} availability slots ensured`)

  // 5. Demo TimeOffRequest — 1 odobren, 1 pending
  if (employees.length >= 4) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(0, 0, 0, 0)

    const dayAfterNextWeek = new Date(nextWeek)
    dayAfterNextWeek.setDate(dayAfterNextWeek.getDate() + 3)

    try {
      await prisma.timeOffRequest.upsert({
        where: { id: 'demo-timeoff-1' },
        create: {
          id: 'demo-timeoff-1',
          employeeId: employees[0].id,
          type: 'vacation',
          startDate: nextWeek,
          endDate: dayAfterNextWeek,
          status: 'approved',
          reason: 'Družinski izlet',
          reviewedAt: new Date(),
        },
        update: {},
      })

      await prisma.timeOffRequest.upsert({
        where: { id: 'demo-timeoff-2' },
        create: {
          id: 'demo-timeoff-2',
          employeeId: employees[3].id,
          type: 'personal',
          startDate: tomorrow,
          endDate: tomorrow,
          status: 'pending',
          reason: 'Zasebne zadeve',
        },
        update: {},
      })
      console.log('[seed] 2 demo time-off requests ensured')
    } catch (e) {
      console.log('[seed] Time-off skip:', e.message)
    }
  }

  // 6. Demo OutboxEvents (za UI testiranje)
  const demoOutboxEvents = [
    {
      idempotencyKey: 'demo-outbox-1',
      aggregateType: 'order',
      aggregateId: 'demo-order-1',
      eventType: 'created',
      payload: { orderNumber: 1, total: 42.50 },
      target: 'furs',
      status: 'pending',
    },
    {
      idempotencyKey: 'demo-outbox-2',
      aggregateType: 'payment',
      aggregateId: 'demo-payment-1',
      eventType: 'wallet_payment_initiated',
      payload: { walletType: 'apple_pay', amount: 28.90 },
      target: 'stripe',
      status: 'sent',
      processedAt: new Date(),
    },
    {
      idempotencyKey: 'demo-outbox-3',
      aggregateType: 'order',
      aggregateId: 'demo-order-2',
      eventType: 'created',
      payload: { orderNumber: 2, total: 15.20 },
      target: 'email',
      status: 'failed',
      attempts: 2,
      lastError: 'SMTP connection timeout',
      nextRetryAt: new Date(Date.now() + 60000),
    },
    {
      idempotencyKey: 'demo-outbox-4',
      aggregateType: 'customer',
      aggregateId: 'demo-customer-1',
      eventType: 'loyalty_birthday_bonus',
      payload: { to: '+38641234501', body: 'Vse najboljše!' },
      target: 'sms',
      status: 'dead_letter',
      attempts: 5,
      lastError: 'Invalid phone number format',
    },
  ]

  for (const ev of demoOutboxEvents) {
    try {
      await prisma.outboxEvent.upsert({
        where: { idempotencyKey: ev.idempotencyKey },
        create: ev,
        update: {},
      })
    } catch (e) {
      // Ignore
    }
  }
  console.log(`[seed] ${demoOutboxEvents.length} demo outbox events ensured`)

  // 7. Demo WalletPayments (za statistiko)
  const demoWalletPayments = [
    { walletType: 'apple_pay', amount: 42.50, status: 'captured', cardBrand: 'visa', cardLast4: '4242' },
    { walletType: 'google_pay', amount: 18.20, status: 'captured', cardBrand: 'mastercard', cardLast4: '5555' },
    { walletType: 'apple_pay', amount: 65.00, status: 'authorized', cardBrand: 'visa', cardLast4: '1234' },
    { walletType: 'nfc_card', amount: 12.50, status: 'captured', cardBrand: 'maestro', cardLast4: '9876' },
    { walletType: 'google_pay', amount: 28.90, status: 'pending' },
    { walletType: 'apple_pay', amount: 99.99, status: 'failed', errorMessage: 'Insufficient funds' },
  ]

  for (const wp of demoWalletPayments) {
    try {
      await prisma.walletPayment.create({
        data: {
          ...wp,
          paymentToken: 'demo_token_' + Math.random().toString(36).substring(7),
          currency: 'EUR',
          capturedAt: wp.status === 'captured' ? new Date() : null,
        },
      })
    } catch (e) {
      // Ignore
    }
  }
  console.log(`[seed] ${demoWalletPayments.length} demo wallet payments ensured`)

  console.log('[seed] ✅ Done!')
  console.log('[seed] Summary:')
  console.log(`  - Location: ${location.name}`)
  console.log(`  - Jobs: ${jobs.length}`)
  console.log(`  - Employees: ${employees.length}`)
  console.log(`  - Availability slots: ${availabilityCount}`)
  console.log(`  - Time-off requests: 2`)
  console.log(`  - Outbox events: ${demoOutboxEvents.length}`)
  console.log(`  - Wallet payments: ${demoWalletPayments.length}`)
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
