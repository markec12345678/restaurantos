// Direct seed script that creates just enough to get the system running
// Then we can use the web UI to re-seed with full menu data
//
// IDEMPOTENTEN (runda 29 fix): create-if-missing — nikoli ne podvaja
// obstoječih vrstic in ne pregazi podatkov na Neon produkciji.
// Workflow "DB Push to Neon" (db-push.yml) požene ta skript po db push,
// zato mora biti varen za ponovne poglede.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating minimal seed data (idempotent — skip-if-exists)...');

  // Create admin employee so we can authenticate
  const adminEmail = 'ana@restaurant.com';
  const existingAdmin = await prisma.employee.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log('Admin employee already exists:', existingAdmin.name, '— skipping');
  } else {
    const admin = await prisma.employee.create({
      data: {
        name: 'Ana Novak',
        email: adminEmail,
        pin: '1234',
        role: 'admin',
        active: true,
      }
    });
    console.log('Created admin employee:', admin.name);
  }

  // Create manager
  const managerEmail = 'marko@restaurant.com';
  const existingManager = await prisma.employee.findUnique({ where: { email: managerEmail } });
  if (existingManager) {
    console.log('Manager employee already exists:', existingManager.name, '— skipping');
  } else {
    const manager = await prisma.employee.create({
      data: {
        name: 'Marko Horvat',
        email: managerEmail,
        pin: '5678',
        role: 'manager',
        active: true,
      }
    });
    console.log('Created manager employee:', manager.name);
  }

  // Create tables (skip-if-exists by unique number)
  const existingTables = await prisma.table.count();
  if (existingTables > 0) {
    console.log(`Tables already present (${existingTables}) — skipping table seed`);
  } else {
    for (let i = 1; i <= 15; i++) {
      await prisma.table.create({
        data: {
          number: i,
          capacity: i <= 5 ? 2 : i <= 10 ? 4 : 6,
          area: i <= 5 ? 'notranji' : i <= 10 ? 'terasa' : 'vip',
          active: true,
        },
      });
    }
    console.log('Created 15 tables');
  }

  // Create jobs (skip-if-exists by name)
  const jobs = ['Natakar', 'Kuhar', 'Barman', 'Hostesa', 'Vodja smene'];
  let jobsCreated = 0;
  for (const jobName of jobs) {
    const existing = await prisma.job.findFirst({ where: { name: jobName } });
    if (!existing) {
      await prisma.job.create({ data: { name: jobName } });
      jobsCreated++;
    }
  }
  console.log(jobsCreated === 0 ? 'Jobs already present — skipping' : `Created ${jobsCreated} jobs`);

  // Create tax rates (skip-if-exists by name)
  const taxRates = [
    { name: 'DDV 22%', rate: 22 },
    { name: 'DDV 9.5%', rate: 9.5 },
  ];
  let taxesCreated = 0;
  for (const t of taxRates) {
    const existing = await prisma.taxRate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.taxRate.create({ data: { ...t, active: true } });
      taxesCreated++;
    }
  }
  console.log(taxesCreated === 0 ? 'Tax rates already present — skipping' : `Created ${taxesCreated} tax rates`);

  // Create void reasons (skip-if-exists by reason)
  const voidReasons = ['Naročilnica napaka', 'Stranka spremenila mnenje', 'Izdelek ni na zalogi', 'Kuhinja napaka', 'Drugo'];
  let voidsCreated = 0;
  for (const reason of voidReasons) {
    const existing = await prisma.voidReason.findFirst({ where: { reason } });
    if (!existing) {
      await prisma.voidReason.create({ data: { reason, active: true } });
      voidsCreated++;
    }
  }
  console.log(voidsCreated === 0 ? 'Void reasons already present — skipping' : `Created ${voidsCreated} void reasons`);

  // Create no-sale reasons (skip-if-exists by reason)
  const noSaleReasons = ['Odmor', 'Zamenjava smene', 'Sestanek', 'Drugo'];
  let noSalesCreated = 0;
  for (const reason of noSaleReasons) {
    const existing = await prisma.noSaleReason.findFirst({ where: { reason } });
    if (!existing) {
      await prisma.noSaleReason.create({ data: { reason, active: true } });
      noSalesCreated++;
    }
  }
  console.log(noSalesCreated === 0 ? 'No-sale reasons already present — skipping' : `Created ${noSalesCreated} no-sale reasons`);

  console.log('\nMinimal seed complete (idempotent)!  Now login with PIN 1234 in the browser and use the admin panel to run full seed.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
