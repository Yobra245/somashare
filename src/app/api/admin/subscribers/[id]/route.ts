import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** DELETE /api/admin/subscribers/[id] — remove someone from the list. Admin only. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await db.subscriber.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
  }
}
