import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { raiseMaintenance, MaintenanceError } from "@/lib/services/maintenance";

// GET — all maintenance requests for the board.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.maintenanceRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      asset: { select: { tag: true, name: true, status: true } },
      raisedBy: { select: { name: true } },
    },
  });
  return NextResponse.json(requests);
}

const raiseSchema = z.object({
  assetId: z.string().min(1, "Select an asset"),
  description: z.string().min(3, "Describe the issue"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

// POST — raise a new request (any authenticated user).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "maintenance:raise")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = raiseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const created = await raiseMaintenance({
      assetId: parsed.data.assetId,
      description: parsed.data.description,
      priority: parsed.data.priority,
      photoUrl: parsed.data.photoUrl || undefined,
      actorId: session.user.id,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof MaintenanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
