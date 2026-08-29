import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Test connection
    await db.$queryRaw`SELECT 1`
    
    // Get existing tables
    const existing = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>
    const existingSet = new Set(existing.map(t => t.tablename))
    
    // Generate CREATE TABLE statements using Prisma's migrate diff
    // Since we can't run prisma CLI, use raw SQL
    // Actually — use db.$executeRawUnsafe with DDL
    
    // Get the schema SQL from the init script
    const { execSync } = await import('child_process')
    
    // Generate SQL from schema using prisma migrate diff
    let sql = ''
    try {
      sql = execSync(
        'node -e "const{execSync}=require(\'child_process\');try{const s=execSync(\'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script\',{encoding:\'utf8\',env:process.env});process.stdout.write(s)}catch(e){process.stderr.write(e.message)}"',
        { encoding: 'utf8', timeout: 60000, env: process.env, cwd: process.cwd() }
      )
    } catch {
      sql = ''
    }
    
    if (!sql) {
      return NextResponse.json({
        success: false,
        error: 'Could not generate SQL from schema',
        existingTables: existing.length,
      }, { status: 500 })
    }
    
    // Execute the SQL (CREATE TABLE IF NOT EXISTS...)
    await db.$executeRawUnsafe(sql)
    
    // Check new table count
    const afterTables = await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ` as Array<{ tablename: string }>
    
    return NextResponse.json({
      success: true,
      beforeCount: existing.length,
      afterCount: afterTables.length,
      created: afterTables.length - existing.length,
      message: `${afterTables.length - existing.length} tables created. Total: ${afterTables.length}`,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.substring(0, 500) : 'Unknown',
    }, { status: 500 })
  }
}
