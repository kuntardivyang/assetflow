import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, apiError } from "@/lib/api";
import { logActivity } from "@/lib/services/notifications";

const patchSchema = z.object({
  name: z.string().min(2, "Name is too short").optional(),
  warrantyMonths: z
    .number({ error: "Warranty must be a number of months" })
    .int("Warranty must be whole months")
    .positive("Warranty must be positive")
    .nullable()
    .optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAction("org:manage");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { name, warrantyMonths } = parsed.data;
    try {
      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          // undefined = leave as-is; null = clear the warranty field.
          ...(warrantyMonths !== undefined && {
            extraFields: warrantyMonths === null ? {} : { warrantyMonths },
          }),
        },
      });
      await logActivity({
        actorId: session.user.id,
        action: "category.update",
        entityType: "Category",
        entityId: category.id,
        description: `Updated category ${category.name}`,
      }).catch((err) => console.error("[PATCH /api/categories/:id] activity log failed", err));
      return NextResponse.json(category);
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
      }
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2025") {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "PATCH /api/categories/:id");
  }
}
