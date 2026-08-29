import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Run prisma db push using the DATABASE_URL from env
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      timeout: 120000,
      env: process.env,
      cwd: process.cwd(),
    })
    
    return NextResponse.json({
      success: true,
      message: 'Database tables created in Neon PostgreSQL',
      stdout: stdout.substring(0, 1000),
      stderr: stderr.substring(0, 500),
    })
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message: string }
    return NextResponse.json({
      success: false,
      error: err.message,
      stdout: err.stdout?.substring(0, 500) || '',
      stderr: err.stderr?.substring(0, 500) || '',
    }, { status: 500 })
  }
}
