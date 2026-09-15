import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** GET /api/auth/me — current session user (null if signed out). */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}
