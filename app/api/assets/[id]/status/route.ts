import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, apiError } from "@/lib/api";
import { canChangeStatus } from "@/lib/services/assets";
import { logActivity } from "@/lib/services/notifications";

// Guarded manual status change (review B6) — the ONLY way an asset reaches
// RESERVED / RETIRED / DISPOSED / LOST outside the audit flow. Transitions are
// whitelisted in lib/services/assets.ts; workflow-owned states (ALLOCATED,
// UNDER_MAINTENANCE) cannot be entered or exited here.
const schema = z.object({
  status: z.enum(["AVAILABLE", "RESERVED", "LOST", "RETIRED", "DISPOSED"], {
    error: "Pick a valid target status",
  }),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAction("asset:manage");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, tag: true, name: true, status: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (!canChangeStatus(asset.status, parsed.data.status)) {
      return NextResponse.json(
        {
          error: `Can't move ${asset.tag} from ${asset.status.replaceAll("_", " ").toLowerCase()} to ${parsed.data.status.toLowerCase()} — release it through its workflow first`,
        },
        { status: 409 },
      );
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    await logActivity({
      actorId: session.user.id,
      action: "asset.status",
      entityType: "Asset",
      entityId: updated.id,
      description: `Changed ${updated.tag} status: ${asset.status} → ${updated.status}`,
    }).catch((err) => console.error("[POST /api/assets/:id/status] activity log failed", err));
    return NextResponse.json(updated);
  } catch (e) {
    return apiError(e, "POST /api/assets/:id/status");
  }
}
