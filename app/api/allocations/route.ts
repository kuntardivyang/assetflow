import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCan, PermissionError } from "@/lib/rbac";
import { allocate, AllocationError } from "@/lib/services/allocation";

const schema = z
  .object({
    assetId: z.string().min(1, "Select an asset"),
    toUserId: z.string().min(1).optional(),
    toDeptId: z.string().min(1).optional(),
    expectedReturnDate: z.string().optional(),
  })
  .refine((d) => d.toUserId || d.toDeptId, {
    message: "Choose an employee or department to allocate to",
  });

// POST /api/allocations — allocate an available asset. Enforces R1 (double-allocation block).
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
    assertCan(session.user.role, "asset:allocate");
    const { assetId, toUserId, toDeptId, expectedReturnDate } = parsed.data;
    const allocation = await allocate(
      {
        assetId,
        toUserId,
        toDeptId,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : undefined,
      },
      session.user.id,
    );
    return NextResponse.json(allocation, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AllocationError) {
      const status = e.code === "CONFLICT" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("POST /api/allocations", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
