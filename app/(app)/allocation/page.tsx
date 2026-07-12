import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { AllocationClient } from "./AllocationClient";

// Screen 5 — Allocation & Transfer. Reads happen here (Server Component);
// mutations go through /api/allocations and /api/transfers.
export default async function AllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId } = await searchParams;
  const session = await auth();

  const [assets, employees, activeAllocation, history, pendingTransfers, allUsers] = await Promise.all([
    prisma.asset.findMany({
      orderBy: { tag: "asc" },
      select: { id: true, tag: true, name: true, status: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: { select: { name: true } },
      },
    }),
    assetId
      ? prisma.allocation.findFirst({
          where: { assetId, status: "ACTIVE" },
          include: {
            toUser: { select: { name: true, department: { select: { name: true } } } },
            toDept: { select: { name: true } },
          },
        })
      : null,
    prisma.allocation.findMany({
      where: assetId ? { assetId } : {},
      orderBy: { allocatedAt: "desc" },
      take: 20,
      include: {
        asset: { select: { tag: true, name: true } },
        toUser: { select: { name: true } },
        allocatedBy: { select: { name: true } },
      },
    }),
    prisma.transferRequest.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "desc" },
      include: { asset: { select: { tag: true, name: true } } },
    }),
    // TransferRequest.fromUserId/toUserId are bare ids (no relation) — resolve names via a lookup.
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const nameOf = new Map(allUsers.map((u) => [u.id, u.name] as const));

  const holder = activeAllocation
    ? {
        name: activeAllocation.toUser?.name ?? "a department",
        dept:
          activeAllocation.toUser?.department?.name ??
          activeAllocation.toDept?.name ??
          null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Allocation &amp; Transfer</h1>
        <p className="text-sm text-muted-foreground">
          Assign assets to people, with conflict rules and full history.
        </p>
      </div>

      <AllocationClient
        assets={assets}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          department: e.department?.name ?? null,
        }))}
        selectedAssetId={assetId ?? null}
        holder={holder}
        canAllocate={can(session?.user?.role, "asset:allocate")}
        canRequestTransfer={can(session?.user?.role, "transfer:request")}
        canApprove={can(session?.user?.role, "transfer:approve")}
        canReturn={can(session?.user?.role, "return:approve")}
        pendingTransfers={pendingTransfers.map((t) => ({
          id: t.id,
          assetTag: t.asset.tag,
          assetName: t.asset.name,
          fromName: t.fromUserId ? nameOf.get(t.fromUserId) ?? "—" : "—",
          toName: nameOf.get(t.toUserId) ?? "—",
          reason: t.reason,
        }))}
        history={history.map((a) => ({
          id: a.id,
          assetTag: a.asset.tag,
          assetName: a.asset.name,
          toName: a.toUser?.name ?? "—",
          status: a.status,
          allocatedAt: a.allocatedAt.toISOString(),
          returnCondition: a.returnCondition,
        }))}
      />
    </div>
  );
}
