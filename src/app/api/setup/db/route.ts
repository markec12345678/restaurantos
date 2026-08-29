import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFileSync } from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Test connection
    await db.$queryRaw`SELECT 1 as test`
    
    // Get existing tables
    const existing = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>
    
    if (existing.length >= 90) {
      return NextResponse.json({
        success: true,
        message: `${existing.length} tables already exist — no action needed`,
        tableCount: existing.length,
      })
    }
    
    // Read the pre-generated SQL file
    const sqlPath = path.join(process.cwd(), 'prisma', 'schema.sql')
    let sql = ''
    try {
      sql = readFileSync(sqlPath, 'utf8')
    } catch {
      return NextResponse.json({
        success: false,
        error: 'schema.sql file not found at ' + sqlPath,
      }, { status: 500 })
    }
    
    // Execute the SQL — creates all tables
    // Split by semicolons to avoid timeout
    const statements = sql.split(';').filter(s => s.trim().length > 0)
    let created = 0
    let errors = 0
    
    for (const stmt of statements) {
      try {
        await db.$executeRawUnsafe(stmt + ';')
        created++
      } catch {
        // Table might already exist — skip
        errors++
      }
    }
    
    // Check final count
    const afterTables = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>
    
    return NextResponse.json({
      success: true,
      beforeCount: existing.length,
      afterCount: afterTables.length,
      created: created,
      errors: errors,
      message: `Tables: ${existing.length} → ${afterTables.length} (${created} created, ${errors} skipped)`,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.substring(0, 500) : 'Unknown',
    }, { status: 500 })
  }
}
