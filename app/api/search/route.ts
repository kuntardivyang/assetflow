import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Lightweight global search feeding the ⌘K command palette.
// Dataset is small, so we return a capped set and let the client filter.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [assets, users, departments] = await Promise.all([
    prisma.asset.findMany({
      take: 100,
      orderBy: { tag: "asc" },
      select: { id: true, tag: true, name: true, status: true },
    }),
    prisma.user.findMany({
      take: 100,
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.department.findMany({
      take: 100,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return NextResponse.json({ assets, users, departments });
}
