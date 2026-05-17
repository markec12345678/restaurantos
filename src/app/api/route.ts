import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";

export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error
  return NextResponse.json({ message: "Hello, world!" });
}