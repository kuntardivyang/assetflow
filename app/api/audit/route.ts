import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCan, PermissionError } from "@/lib/rbac";
import { createCycle, AuditError } from "@/lib/services/audit";

const schema = z
  .object({
    name: z.string().min(2, "Name the audit cycle"),
    scopeDeptId: z.string().min(1).optional(),
    scopeLocation: z.string().min(1).optional(),
    startDate: z.coerce.date({ error: "Invalid start date" }),
    endDate: z.coerce.date({ error: "Invalid end date" }),
    auditorIds: z.array(z.string().min(1)).min(1, "Assign at least one auditor"),
  })
  .refine((d) => d.endDate >= d.startDate, {
    error: "End date must be on or after the start date",
    path: ["endDate"],
  });

// POST /api/audit — create an audit cycle and snapshot its checklist.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    assertCan(session.user.role, "audit:manage");
    const { name, scopeDeptId, scopeLocation, startDate, endDate, auditorIds } = parsed.data;
    const cycle = await createCycle(
      { name, scopeDeptId, scopeLocation, startDate, endDate, auditorIds },
      session.user.id,
    );
    return NextResponse.json(cycle, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AuditError) {
      const status =
        e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("POST /api/audit", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
