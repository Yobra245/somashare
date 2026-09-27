import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/admin/subscribers            → JSON list + count
 * GET /api/admin/subscribers?format=csv → CSV export (mail-merge friendly)
 * Admin only (ADMIN_EMAILS env).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const subscribers = await db.subscriber.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  const format = new URL(req.url).searchParams.get("format");
  if (format === "csv") {
    const rows = [
      ["email", "name", "source", "signedUpAt"],
      ...subscribers.map((s) => [s.email, s.name, s.source, s.createdAt.toISOString()]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="somashare-subscribers-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    count: subscribers.length,
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}
