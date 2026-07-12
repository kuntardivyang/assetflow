import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, apiError } from "@/lib/api";
import { logActivity } from "@/lib/services/notifications";

const patchSchema = z.object({
  name: z.string().min(2, "Name is too short").optional(),
  code: z
    .string()
    .min(2, "Code is too short")
    .max(12, "Code is too long")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters/digits (e.g. ENG)")
    .optional(),
  headId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  // Deactivation only hides the department from picklists (GET defaults to
  // active-only) — no cascade (review D9).
  active: z.boolean().optional(),
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
    // Walk the parent chain so re-parenting can't create a cycle (A→B→A);
    // covers direct self-parenting on the first iteration.
    if (parsed.data.parentId) {
      let cursor: string | null = parsed.data.parentId;
      for (let depth = 0; cursor && depth < 20; depth++) {
        if (cursor === id) {
          return NextResponse.json(
            { error: "That parent would create a cycle in the department hierarchy" },
            { status: 400 },
          );
        }
        const parent: { parentId: string | null } | null = await prisma.department.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = parent?.parentId ?? null;
      }
    }

    // Mirror the create route's duplicate-name guard — without this, an edit
    // could rename a department into a duplicate (best-effort, not race-safe).
    if (parsed.data.name) {
      const dupe = await prisma.department.findFirst({
        where: { name: { equals: parsed.data.name, mode: "insensitive" }, id: { not: id } },
      });
      if (dupe) {
        return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 });
      }
    }

    try {
      const dept = await prisma.department.update({ where: { id }, data: parsed.data });
      // Mutation already succeeded — a logging failure must not surface as a 500.
      await logActivity({
        actorId: session.user.id,
        action: parsed.data.active === false ? "department.deactivate" : "department.update",
        entityType: "Department",
        entityId: dept.id,
        description:
          parsed.data.active === false
            ? `Deactivated department ${dept.name}`
            : `Updated department ${dept.name}`,
      }).catch((err) => console.error("[PATCH /api/departments/:id] activity log failed", err));
      return NextResponse.json(dept);
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "This department code is already in use" }, { status: 409 });
      }
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2025") {
        return NextResponse.json({ error: "Department not found" }, { status: 404 });
      }
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2003") {
        return NextResponse.json(
          { error: "Selected head or parent department no longer exists — refresh and try again" },
          { status: 400 },
        );
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "PATCH /api/departments/:id");
  }
}
