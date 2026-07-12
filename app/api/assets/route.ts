import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma, AssetStatus } from "@prisma/client";
import { requireAction, requireSession, apiError } from "@/lib/api";
import { nextTag } from "@/lib/services/assets";
import { logActivity } from "@/lib/services/notifications";

const ASSET_STATUSES = [
  "AVAILABLE",
  "ALLOCATED",
  "RESERVED",
  "UNDER_MAINTENANCE",
  "LOST",
  "RETIRED",
  "DISPOSED",
] as const;

const createSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  categoryId: z.string().min(1, "Pick a category"),
  serialNumber: z.string().nullable().optional(),
  acquisitionDate: z.iso.datetime({ error: "Invalid acquisition date" }).nullable().optional(),
  // Reports/ranking only — never tied to accounting (spec).
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

// GET /api/assets — searchable directory for any signed-in user.
// Filters: q (tag/serial/name — the "QR code" search is the same text match),
// categoryId, status, deptId, location (PDF requires all four dropdowns).
export async function GET(req: Request) {
  try {
    await requireSession();
    const p = new URL(req.url).searchParams;
    const q = p.get("q")?.trim();
    const status = p.get("status") as AssetStatus | null;

    const where: Prisma.AssetWhereInput = {
      ...(q && {
        OR: [
          { tag: { contains: q, mode: "insensitive" } },
          { serialNumber: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(p.get("categoryId") && { categoryId: p.get("categoryId")! }),
      ...(status && ASSET_STATUSES.includes(status) && { status }),
      ...(p.get("deptId") && { currentDeptId: p.get("deptId")! }),
      ...(p.get("location") && { location: p.get("location")! }),
    };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { tag: "asc" },
        take: 50,
      }),
      prisma.asset.count({ where }),
    ]);
    return NextResponse.json({ assets, total });
  } catch (e) {
    return apiError(e, "GET /api/assets");
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAction("asset:manage");
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // Tag comes from the Postgres sequence inside the same transaction as the
    // insert — race-free and delete-proof (review B2). Never count()+1.
    // (A rolled-back create leaves a tag gap; uniqueness, not gaplessness,
    // is the invariant.)
    let asset;
    try {
      asset = await prisma.$transaction(async (tx) => {
        const tag = await nextTag(tx);
        return tx.asset.create({
        data: {
          tag,
          name: d.name,
          categoryId: d.categoryId,
          serialNumber: d.serialNumber || null,
          acquisitionDate: d.acquisitionDate ? new Date(d.acquisitionDate) : null,
          acquisitionCost: d.acquisitionCost ?? null,
          condition: d.condition || null,
          location: d.location || null,
          photoUrl: d.photoUrl || null,
          bookable: d.bookable ?? false,
        },
          include: { category: { select: { id: true, name: true } } },
        });
      });
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === "P2003") {
        return NextResponse.json(
          { error: "Selected category no longer exists — refresh and try again" },
          { status: 400 },
        );
      }
      throw e;
    }

    await logActivity({
      actorId: session.user.id,
      action: "asset.register",
      entityType: "Asset",
      entityId: asset.id,
      description: `Registered asset ${asset.tag} — ${asset.name}`,
    }).catch((err) => console.error("[POST /api/assets] activity log failed", err));

    return NextResponse.json(asset, { status: 201 });
  } catch (e) {
    return apiError(e, "POST /api/assets");
  }
}
