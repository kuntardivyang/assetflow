import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCan, PermissionError } from "@/lib/rbac";
import { returnAsset, AllocationError } from "@/lib/services/allocation";

const schema = z
  .object({
    assetId: z.string().min(1).optional(),
    allocationId: z.string().min(1).optional(),
    returnCondition: z.string().optional(),
  })
  .refine((d) => d.assetId || d.allocationId, {
    message: "An asset or allocation is required to return",
  });

// POST /api/allocations/return — Asset Manager performs the return (one step, per review B7).
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
    assertCan(session.user.role, "return:approve");
    const result = await returnAsset(parsed.data, session.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AllocationError) {
      const status = e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("POST /api/allocations/return", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
