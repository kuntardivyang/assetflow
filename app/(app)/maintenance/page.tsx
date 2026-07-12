import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { MaintenanceBoard } from "@/components/maintenance/MaintenanceBoard";

// Screen 7 — route repairs through an approval workflow (Kanban board).
export default async function MaintenancePage() {
  const session = await auth();
  const canManage = can(session?.user.role, "maintenance:approve");

  const [requests, assets] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        asset: { select: { tag: true, name: true } },
        raisedBy: { select: { name: true } },
      },
    }),
    prisma.asset.findMany({
      where: { status: { notIn: ["RETIRED", "DISPOSED"] } },
      orderBy: { tag: "asc" },
      select: { id: true, tag: true, name: true },
    }),
  ]);

  const cards = requests.map((r) => ({
    id: r.id,
    status: r.status,
    priority: r.priority,
    description: r.description,
    technicianName: r.technicianName,
    assetTag: r.asset.tag,
    assetName: r.asset.name,
    raisedBy: r.raisedBy.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="text-sm text-muted-foreground">
          Route repairs through approval. Approving a card moves the asset to Under
          Maintenance; resolving returns it to Available.
        </p>
      </div>
      <MaintenanceBoard cards={cards} assets={assets} canManage={canManage} />
    </div>
  );
}
