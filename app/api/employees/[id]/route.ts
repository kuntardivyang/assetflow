import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, apiError } from "@/lib/api";
import { logActivity } from "@/lib/services/notifications";
import { ROLE_LABELS } from "@/lib/rbac";

const patchSchema = z.object({
  // Role whitelist deliberately EXCLUDES ADMIN: this endpoint can promote to
  // Department Head / Asset Manager only — no path mints another Admin, even
  // for an Admin caller (no self-elevation, spec requirement).
  role: z.enum(["EMPLOYEE", "DEPARTMENT_HEAD", "ASSET_MANAGER"], {
    error: "Role must be Employee, Department Head or Asset Manager",
  }).optional(),
  departmentId: z.string().nullable().optional(),
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

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    // Admin accounts are managed outside this screen — the directory can
    // neither demote an Admin nor deactivate one.
    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "Admin accounts cannot be edited here" }, { status: 403 });
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: parsed.data,
        select: { id: true, name: true, role: true, active: true, departmentId: true },
      });
      const roleChanged = parsed.data.role && parsed.data.role !== target.role;
      await logActivity({
        actorId: session.user.id,
        action: roleChanged ? "employee.role" : "employee.update",
        entityType: "User",
        entityId: user.id,
        description: roleChanged
          ? `Changed ${user.name}'s role to ${ROLE_LABELS[user.role]}`
          : `Updated employee ${user.name}`,
      }).catch((err) => console.error("[PATCH /api/employees/:id] activity log failed", err));
      return NextResponse.json(user);
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2003") {
        return NextResponse.json(
          { error: "Selected department no longer exists — refresh and try again" },
          { status: 400 },
        );
      }
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2025") {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "PATCH /api/employees/:id");
  }
}
