import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertCan, PermissionError } from "@/lib/rbac";
import { closeCycle, AuditError } from "@/lib/services/audit";

// POST /api/audit/[id]/close — Admin / Asset Manager closes a cycle (the resolution step).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    assertCan(session.user.role, "audit:manage");
    const result = await closeCycle(id, session.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AuditError) {
      const status =
        e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("POST /api/audit/[id]/close", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
