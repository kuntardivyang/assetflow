import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCan, PermissionError } from "@/lib/rbac";
import { requestTransfer, AllocationError } from "@/lib/services/allocation";

const schema = z.object({
  assetId: z.string().min(1, "Select an asset"),
  toUserId: z.string().min(1, "Choose an employee to transfer to"),
  reason: z.string().min(3, "Give a short reason for the transfer"),
});

// POST /api/transfers — file a transfer request (does not move the asset until approved).
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
    assertCan(session.user.role, "transfer:request");
    const tr = await requestTransfer(parsed.data, session.user.id);
    return NextResponse.json(tr, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AllocationError) {
      const status = e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("POST /api/transfers", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
