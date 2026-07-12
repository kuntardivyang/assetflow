import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import type { AssetStatus } from "@prisma/client";
import { canChangeStatus } from "@/lib/services/assets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ChangeStatus } from "./ChangeStatus";

const MANUAL_TARGETS: AssetStatus[] = ["AVAILABLE", "RESERVED", "LOST", "RETIRED", "DISPOSED"];

// Per-asset detail: lifecycle status + allocation & maintenance history (PDF).
export default async function AssetDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), ctx.params]);

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      currentDept: { select: { name: true } },
      allocations: {
        orderBy: { allocatedAt: "desc" },
        include: {
          toUser: { select: { name: true } },
          toDept: { select: { name: true } },
        },
      },
      maintenanceRequests: {
        orderBy: { createdAt: "desc" },
        select: { id: true, description: true, status: true, priority: true, createdAt: true },
      },
    },
  });
  if (!asset) notFound();

  // Holder is derived from the ACTIVE allocation (currentHolderId is a bare
  // string column with no relation — don't trust it for display).
  const activeAllocation = asset.allocations.find((a) => a.status === "ACTIVE");
  const holder = activeAllocation?.toUser?.name ?? activeAllocation?.toDept?.name ?? null;
  const canManage = can(session?.user?.role, "asset:manage");
  const targets = canManage
    ? MANUAL_TARGETS.filter((t) => canChangeStatus(asset.status, t))
    : [];

  const facts: [string, string][] = [
    ["Category", asset.category.name],
    ["Serial number", asset.serialNumber ?? "--"],
    ["Location", asset.location ?? "--"],
    ["Department", asset.currentDept?.name ?? "--"],
    ["Condition", asset.condition ?? "--"],
    ["Acquired", asset.acquisitionDate ? format(asset.acquisitionDate, "d MMM yyyy") : "--"],
    ["Bookable", asset.bookable ? "Yes — shared resource" : "No"],
    ["Held by", holder ?? "--"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/assets" className="hover:underline">
              Assets
            </Link>{" "}
            / {asset.tag}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {asset.tag} — {asset.name}
          </h1>
          <div className="mt-2">
            <StatusBadge status={asset.status} />
          </div>
        </div>
        <ChangeStatus assetId={asset.id} targets={targets} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {asset.allocations.length === 0 && (
              <p className="text-muted-foreground">Never allocated.</p>
            )}
            {asset.allocations.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {a.toUser?.name ?? a.toDept?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(a.allocatedAt, "d MMM yyyy")}
                    {a.returnedAt
                      ? ` → returned ${format(a.returnedAt, "d MMM yyyy")}${a.returnCondition ? ` · condition: ${a.returnCondition}` : ""}`
                      : a.expectedReturnDate
                        ? ` · due ${format(a.expectedReturnDate, "d MMM yyyy")}`
                        : ""}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {asset.maintenanceRequests.length === 0 && (
              <p className="text-muted-foreground">No maintenance recorded.</p>
            )}
            {asset.maintenanceRequests.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{m.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(m.createdAt, "d MMM yyyy")} · {m.priority.toLowerCase()} priority
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
