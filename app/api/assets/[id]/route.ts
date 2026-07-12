import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, apiError } from "@/lib/api";
import { logActivity } from "@/lib/services/notifications";

// Edit schema deliberately EXCLUDES `status` — lifecycle status moves only
// through workflows (allocation/maintenance/audit) or the guarded status
// endpoint with its legal-transition whitelist (review B6).
const patchSchema = z.object({
  name: z.string().min(2, "Name is too short").optional(),
  categoryId: z.string().min(1).optional(),
  serialNumber: z.string().nullable().optional(),
  acquisitionDate: z.iso.datetime({ error: "Invalid acquisition date" }).nullable().optional(),
  acquisitionCost: z
    .number({ error: "Cost must be a number" })
    .nonnegative("Cost can't be negative")
    .nullable()
    .optional(),
  condition: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  photoUrl: z.union([z.url("Photo must be a valid URL"), z.literal("")]).nullable().optional(),
  bookable: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAction("asset:manage");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const d = parsed.data;

    try {
      const asset = await prisma.asset.update({
        where: { id },
        data: {
          ...(d.name !== undefined && { name: d.name }),
          ...(d.categoryId !== undefined && { categoryId: d.categoryId }),
          ...(d.serialNumber !== undefined && { serialNumber: d.serialNumber || null }),
          ...(d.acquisitionDate !== undefined && {
            acquisitionDate: d.acquisitionDate ? new Date(d.acquisitionDate) : null,
          }),
          ...(d.acquisitionCost !== undefined && { acquisitionCost: d.acquisitionCost }),
          ...(d.condition !== undefined && { condition: d.condition || null }),
          ...(d.location !== undefined && { location: d.location || null }),
          ...(d.photoUrl !== undefined && { photoUrl: d.photoUrl || null }),
          ...(d.bookable !== undefined && { bookable: d.bookable }),
        },
      });
      await logActivity({
        actorId: session.user.id,
        action: "asset.update",
        entityType: "Asset",
        entityId: asset.id,
        description: `Updated asset ${asset.tag} — ${asset.name}`,
      }).catch((err) => console.error("[PATCH /api/assets/:id] activity log failed", err));
      return NextResponse.json(asset);
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2025") {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2003") {
        return NextResponse.json(
          { error: "Selected category no longer exists — refresh and try again" },
          { status: 400 },
        );
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "PATCH /api/assets/:id");
  }
}
