import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { markItem, AuditError } from "@/lib/services/audit";

const schema = z.object({
  result: z.enum(["PENDING", "VERIFIED", "MISSING", "DAMAGED"]),
  notes: z.string().optional(),
});

// PATCH /api/audit/items/[id] — an assigned auditor (or an audit:manage Admin) marks a checklist item.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    // Authorization (assigned-auditor OR audit:manage) is enforced inside the service.
    const item = await markItem(
      id,
      parsed.data.result,
      parsed.data.notes,
      session.user.id,
      session.user.role,
    );
    return NextResponse.json(item, { status: 200 });
  } catch (e) {
    if (e instanceof AuditError) {
      const status =
        e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("PATCH /api/audit/items/[id]", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
