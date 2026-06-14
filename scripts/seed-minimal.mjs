// Direct seed script that creates just enough to get the system running
// Then we can use the web UI to re-seed with full menu data

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating minimal seed data...');

  // Create admin employee so we can authenticate
  const admin = await prisma.employee.create({
    data: {
      name: 'Ana Novak',
      email: 'ana@restaurant.com',
      pin: '1234',
      role: 'admin',
      active: true,
    }
  });
  console.log('Created admin employee:', admin.name);

  // Create manager
  const manager = await prisma.employee.create({
    data: {
      name: 'Marko Horvat',
      email: 'marko@restaurant.com',
      pin: '5678',
      role: 'manager',
      active: true,
    }
  });
  console.log('Created manager employee:', manager.name);

  // Create some tables
  for (let i = 1; i <= 15; i++) {
    await prisma.table.create({
      data: {
        number: i,
        capacity: i <= 5 ? 2 : i <= 10 ? 4 : 6,
        area: i <= 5 ? 'notranji' : i <= 10 ? 'terasa' : 'vip',
        active: true,
      }
    });
  }
  console.log('Created 15 tables');

  // Create jobs
  const jobs = ['Natakar', 'Kuhar', 'Barman', 'Hostesa', 'Vodja smene'];
  for (const jobName of jobs) {
    await prisma.job.create({ data: { name: jobName } });
  }
  console.log('Created 5 jobs');

  // Create tax rates
  await prisma.taxRate.create({ data: { name: 'DDV 22%', rate: 22, active: true } });
  await prisma.taxRate.create({ data: { name: 'DDV 9.5%', rate: 9.5, active: true } });
  console.log('Created tax rates');

  // Create void reasons
  const voidReasons = ['Naročilnica napaka', 'Stranka spremenila mnenje', 'Izdelek ni na zalogi', 'Kuhinja napaka', 'Drugo'];
  for (const reason of voidReasons) {
    await prisma.voidReason.create({ data: { reason, active: true } });
  }
  console.log('Created void reasons');

  // Create no-sale reasons
  const noSaleReasons = ['Odmor', 'Zamenjava smene', 'Sestanek', 'Drugo'];
  for (const reason of noSaleReasons) {
    await prisma.noSaleReason.create({ data: { reason, active: true } });
  }
  console.log('Created no-sale reasons');

  console.log('\nMinimal seed complete!');
  console.log('Now login with PIN 1234 in the browser and use the admin panel to run full seed.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
