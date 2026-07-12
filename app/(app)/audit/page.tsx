import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { AuditClient } from "./AuditClient";

// Screen 8 — Asset Audit. Reads here (Server Component); mutations via /api/audit*.
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string }>;
}) {
  const { cycleId } = await searchParams;
  const session = await auth();
  const canManage = can(session?.user?.role, "audit:manage");

  const [cycles, departments, locationRows, users] = await Promise.all([
    prisma.auditCycle.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.department.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.asset.findMany({
      where: { location: { not: null } },
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const selectedId = cycleId ?? cycles[0]?.id ?? null;
  const selected = selectedId
    ? await prisma.auditCycle.findUnique({
        where: { id: selectedId },
        include: {
          auditors: { include: { user: { select: { name: true } } } },
          items: {
            include: { asset: { select: { tag: true, name: true } } },
            orderBy: { id: "asc" },
          },
        },
      })
    : null;

  const deptName = (id: string | null) =>
    id ? departments.find((d) => d.id === id)?.name ?? null : null;

  const isAssignedAuditor =
    !!selected && selected.auditors.some((a) => a.userId === session?.user?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asset Audit</h1>
        <p className="text-sm text-muted-foreground">
          Run verification cycles, flag discrepancies, and close with an auto-generated report.
        </p>
      </div>

      <AuditClient
        canManage={canManage}
        canMark={canManage || isAssignedAuditor}
        cycles={cycles.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          itemCount: c._count.items,
        }))}
        selected={
          selected
            ? {
                id: selected.id,
                name: selected.name,
                status: selected.status,
                scopeDept: deptName(selected.scopeDeptId),
                scopeLocation: selected.scopeLocation,
                startDate: selected.startDate.toISOString(),
                endDate: selected.endDate.toISOString(),
                closedAt: selected.closedAt ? selected.closedAt.toISOString() : null,
                auditorNames: selected.auditors.map((a) => a.user.name),
                items: selected.items.map((i) => ({
                  id: i.id,
                  assetTag: i.asset.tag,
                  assetName: i.asset.name,
                  expectedLocation: i.expectedLocation,
                  result: i.result,
                  notes: i.notes,
                })),
              }
            : null
        }
        options={{
          departments,
          locations: locationRows.map((r) => r.location as string),
          users,
        }}
      />
    </div>
  );
}
