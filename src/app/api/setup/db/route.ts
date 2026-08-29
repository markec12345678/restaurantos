import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

// GET /api/setup/db — Run prisma db push to create all tables in Neon
export async function GET() {
  try {
    const output = execSync('npx prisma db push --accept-data-loss', {
      encoding: 'utf8',
      timeout: 60000,
      env: process.env,
    })
    return NextResponse.json({ 
      success: true, 
      message: 'Database tables created',
      output: output.substring(0, 500) 
    })
  } catch (error: unknown) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
