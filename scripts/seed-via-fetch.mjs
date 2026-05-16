// Seed the database using fetch with proper auth flow
async function seed() {
  console.log('Step 1: Authenticating...');
  const authResp = await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234' })
  });
  const auth = await authResp.json();
  console.log('Auth result:', auth.success, '- Role:', auth.employee?.role);
  
  if (!auth.token) {
    console.error('Authentication failed!');
    return;
  }
  
  console.log('Step 2: Seeding database...');
  const seedResp = await fetch('http://localhost:3000/api/seed', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`
    }
  });
  const seed = await seedResp.json();
  console.log('Seed result:', JSON.stringify(seed).substring(0, 500));
}

seed().catch(console.error);
