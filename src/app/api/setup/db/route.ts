import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use Prisma's internal API to push schema
    // This doesn't need npx or the CLI binary
    const { execSync } = await import('child_process')
    
    // Try to find prisma in different locations
    const possiblePaths = [
      '/var/task/node_modules/.bin/prisma',
      './node_modules/.bin/prisma',
      process.cwd() + '/node_modules/.bin/prisma',
    ]
    
    let prismaBin = null
    const fs = await import('fs')
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          prismaBin = p
          break
        }
      } catch {}
    }
    
    if (!prismaBin) {
      // Alternative: use Prisma's programmatic API
      // Import the schema engine directly
      const output = execSync(
        'node -e "const{PrismaClient}=require(\'@prisma/client\');const c=new PrismaClient();c.\$executeRawUnsafe(\'SELECT 1\').then(r=>{console.log(\'DB connection OK\');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"',
        { timeout: 30000, env: process.env, cwd: process.cwd() }
      ).toString()
      
      return NextResponse.json({
        success: true,
        method: 'direct connection test',
        output: output.substring(0, 500),
        message: 'DB connection works. Need to create tables manually.'
      })
    }
    
    const output = execSync(`"${prismaBin}" db push --accept-data-loss`, {
      timeout: 120000,
      env: process.env,
      cwd: process.cwd(),
    }).toString()
    
    return NextResponse.json({
      success: true,
      method: 'prisma CLI',
      output: output.substring(0, 1000),
      message: 'All tables created in Neon PostgreSQL'
    })
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message: string }
    return NextResponse.json({
      success: false,
      error: err.message?.substring(0, 300),
      stdout: err.stdout?.substring(0, 500) || '',
    }, { status: 500 })
  }
}
