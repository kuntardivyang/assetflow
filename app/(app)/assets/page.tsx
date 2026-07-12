import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import type { Prisma, AssetStatus } from "@prisma/client";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ASSET_STATUSES } from "@/lib/statuses";
import { FilterBar } from "./FilterBar";
import { RegisterAsset } from "./RegisterAsset";

// Screen 4 — asset registry. All filtering happens in the DB query.
// repeated query keys come through as arrays — take the first
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, spRaw] = await Promise.all([auth(), searchParams]);
  const sp = {
    q: first(spRaw.q),
    categoryId: first(spRaw.categoryId),
    status: first(spRaw.status),
    deptId: first(spRaw.deptId),
    location: first(spRaw.location),
  };
  const q = sp.q?.trim();
  const status = ASSET_STATUSES.includes(sp.status as AssetStatus)
    ? (sp.status as AssetStatus)
    : undefined;

  const where: Prisma.AssetWhereInput = {
    ...(q && {
      OR: [
        { tag: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(sp.categoryId && { categoryId: sp.categoryId }),
    ...(status && { status }),
    ...(sp.deptId && { currentDeptId: sp.deptId }),
    ...(sp.location && { location: sp.location }),
  };

  const [assets, total, categories, departments, locationRows] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { tag: "asc" },
      take: 50,
    }),
    prisma.asset.count({ where }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { location: { not: null } },
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
    }),
  ]);

  const canRegister = can(session?.user?.role, "asset:manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">
            {total} asset{total === 1 ? "" : "s"}
            {total > 50 ? " — showing first 50, refine your search" : ""}
          </p>
        </div>
        {canRegister && <RegisterAsset categories={categories} />}
      </div>

      <FilterBar
        categories={categories}
        departments={departments}
        locations={locationRows.map((r) => r.location!).filter(Boolean)}
      />

      <Table>
        <THead>
          <TR>
            <TH>Tag</TH>
            <TH>Name</TH>
            <TH>Category</TH>
            <TH>Status</TH>
            <TH>Location</TH>
          </TR>
        </THead>
        <TBody>
          {assets.length === 0 && (
            <TR>
              <TD colSpan={5} className="py-10 text-center text-muted-foreground">
                No assets match — adjust the search or filters.
              </TD>
            </TR>
          )}
          {assets.map((a) => (
            <TR key={a.id}>
              <TD>
                <Link href={`/assets/${a.id}`} className="font-medium text-primary hover:underline">
                  {a.tag}
                </Link>
              </TD>
              <TD>{a.name}</TD>
              <TD className="text-muted-foreground">{a.category.name}</TD>
              <TD>
                <StatusBadge status={a.status} />
              </TD>
              <TD className="text-muted-foreground">{a.location ?? "--"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
