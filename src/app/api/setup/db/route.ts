import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Test DB connection
    const testResult = await db.$queryRaw`SELECT 1 as test`
    
    // Check what tables exist
    const tables = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    ` as Array<{ tablename: string }>
    
    return NextResponse.json({
      success: true,
      connection: 'OK',
      tableCount: tables.length,
      tables: tables.map(t => t.tablename).slice(0, 20),
      message: tables.length > 0 
        ? `${tables.length} tables exist. Missing tables need manual creation.`
        : 'No tables exist. Need to run prisma db push.',
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.substring(0, 300) : 'Unknown error',
    }, { status: 500 })
  }
}
