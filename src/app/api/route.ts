import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";

import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error
    return NextResponse.json({ message: "Hello, world!" });
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/unknown', 'Internal server error')
  }
}
