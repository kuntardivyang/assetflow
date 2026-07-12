import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { PermissionError } from "@/lib/rbac";
import { moveMaintenance, MaintenanceError } from "@/lib/services/maintenance";

const moveSchema = z.object({
  to: z.enum(["APPROVED", "REJECTED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS", "RESOLVED"]),
  technicianName: z.string().optional(),
});

// PATCH — move a card to the next stage (drives the R3 asset-status coupling).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = moveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const updated = await moveMaintenance({
      id,
      to: parsed.data.to,
      technicianName: parsed.data.technicianName,
      actor: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof MaintenanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
