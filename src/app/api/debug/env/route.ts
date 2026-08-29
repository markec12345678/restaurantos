import { NextResponse } from 'next/server'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  const masked = dbUrl.replace(/([^:]+):\/\/([^:]+):([^@]+)@/, '$1://$2:****@')
  
  return NextResponse.json({
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    POSTGRES_URL_set: !!process.env.POSTGRES_URL,
    DATABASE_URL_preview: dbUrl ? dbUrl.substring(0, 30) + '...' : 'NOT SET',
    FULL_MASKED: masked,
    POSTGRES_HOST: process.env.POSTGRES_HOST || 'NOT SET',
    PGDATABASE: process.env.PGDATABASE || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  })
}
