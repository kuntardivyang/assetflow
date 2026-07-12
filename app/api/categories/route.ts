import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, requireSession, apiError } from "@/lib/api";
import { logActivity } from "@/lib/services/notifications";

const createSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  // Category-specific extra field (e.g. warranty for Electronics) — stored in
  // the extraFields JSON column so new categories don't need migrations.
  warrantyMonths: z
    .number({ error: "Warranty must be a number of months" })
    .int("Warranty must be whole months")
    .positive("Warranty must be positive")
    .nullable()
    .optional(),
});

// GET /api/categories — picklist for any signed-in user (Assets register form).
export async function GET() {
  try {
    await requireSession();
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(categories);
  } catch (e) {
    return apiError(e, "GET /api/categories");
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

    const { name, warrantyMonths } = parsed.data;
    // DB @unique is case-sensitive — pre-check insensitively so "laptops"
    // can't slip in next to "Laptops" (parity with departments).
    const dupe = await prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (dupe) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    try {
      const category = await prisma.category.create({
        data: { name, extraFields: warrantyMonths ? { warrantyMonths } : undefined },
      });
      await logActivity({
        actorId: session.user.id,
        action: "category.create",
        entityType: "Category",
        entityId: category.id,
        description: `Created category ${category.name}`,
      }).catch((err) => console.error("[POST /api/categories] activity log failed", err));
      return NextResponse.json(category, { status: 201 });
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "POST /api/categories");
  }
}
