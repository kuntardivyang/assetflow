import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertCan, PermissionError } from "@/lib/rbac";
import { rejectTransfer, AllocationError } from "@/lib/services/allocation";

// POST /api/transfers/[id]/reject — Asset Manager / Dept Head rejects a transfer.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    assertCan(session.user.role, "transfer:approve");
    const result = await rejectTransfer(id, session.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AllocationError) {
      const status = e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("POST /api/transfers/[id]/reject", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
