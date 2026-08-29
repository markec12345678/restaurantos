import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  
  // Mask password
  const masked = dbUrl.replace(/(postgresql|postgres):\/\/([^:]+):([^@]+)@/, '$1://$2:****@')
  
  return NextResponse.json({
    DATABASE_URL: masked ? masked.substring(0, 60) + '...' : 'NOT SET',
    POSTGRES_URL: process.env.POSTGRES_URL ? 'SET (starts with: ' + process.env.POSTGRES_URL.substring(0, 20) + '...)' : 'NOT SET',
    POSTGRES_USER: process.env.POSTGRES_USER || 'NOT SET',
    POSTGRES_HOST: process.env.POSTGRES_HOST || 'NOT SET',
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ? 'SET (length: ' + process.env.POSTGRES_PASSWORD.length + ')' : 'NOT SET',
    PGDATABASE: process.env.PGDATABASE || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    // Show full masked URL so we can reconstruct it
    FULL_MASKED: masked,
  })
}
