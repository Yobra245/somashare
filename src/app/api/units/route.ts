import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/units — all course units with their resource counts. */
export async function GET() {
  const units = await db.unit.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { resources: true } } },
  });

  return NextResponse.json({
    units: units.map((u) => ({
      id: u.id,
      code: u.code,
      title: u.title,
      department: u.department,
      shortLabel: u.shortLabel,
      resourceCount: u._count.resources,
    })),
  });
}
