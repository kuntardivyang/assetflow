import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiError } from "@/lib/api";

// GET /api/employees — directory picklist (allocation "To" selector, dept-head
// assignment). Any signed-in user; returns no sensitive fields. Active only by
// default; ?all=1 includes deactivated accounts for the ADMIN directory table.
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const all = new URL(req.url).searchParams.get("all") === "1";
    const employees = await prisma.user.findMany({
      where: all && session.user.role === "ADMIN" ? {} : { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(employees);
  } catch (e) {
    return apiError(e, "GET /api/employees");
  }
}
