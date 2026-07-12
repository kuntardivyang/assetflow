import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, requireSession, apiError } from "@/lib/api";
import { logActivity } from "@/lib/services/notifications";

const createSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  code: z
    .string()
    .min(2, "Code is too short")
    .max(12, "Code is too long")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters/digits (e.g. ENG)"),
  headId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

// Picklist for any signed-in user, active depts only. ?all=1 (admin) includes
// inactive. The org-setup table itself reads Prisma directly in page.tsx.
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const all = new URL(req.url).searchParams.get("all") === "1";
    const departments = await prisma.department.findMany({
      where: all && session.user.role === "ADMIN" ? {} : { active: true },
      include: { head: { select: { id: true, name: true } }, parent: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(departments);
  } catch (e) {
    return apiError(e, "GET /api/departments");
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAction("org:manage");
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { name, code, headId, parentId } = parsed.data;
    // name has no unique constraint — best-effort check so we don't end up
    // with two "Engineering" rows
    const dupe = await prisma.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (dupe) {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 });
    }

    try {
      const dept = await prisma.department.create({
        data: { name, code, headId: headId || null, parentId: parentId || null },
      });
      // create succeeded — don't let a failed log entry turn it into a 500
      await logActivity({
        actorId: session.user.id,
        action: "department.create",
        entityType: "Department",
        entityId: dept.id,
        description: `Created department ${dept.name} (${dept.code})`,
      }).catch((err) => console.error("[POST /api/departments] activity log failed", err));
      return NextResponse.json(dept, { status: 201 });
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "This department code is already in use" }, { status: 409 });
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
    return apiError(e, "POST /api/departments");
  }
}
