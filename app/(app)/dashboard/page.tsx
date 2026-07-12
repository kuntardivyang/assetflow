import Link from "next/link";
import {
  Boxes,
  PackageCheck,
  Wrench,
  CalendarClock,
  ArrowLeftRight,
  Undo2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

// Screen 2 — real-time operational snapshot for every role.
export default async function DashboardPage() {
  const now = new Date();
  const session = await auth();
  // Only Admin/Asset Manager see the org-wide feed; everyone else sees their own.
  const seesAllActivity = can(session?.user.role, "analytics:viewAll");

  const [
    available,
    allocated,
    openMaintenance,
    activeBookings,
    pendingTransfers,
    upcomingReturns,
    overdue,
    recent,
  ] = await Promise.all([
    prisma.asset.count({ where: { status: "AVAILABLE" } }),
    prisma.asset.count({ where: { status: "ALLOCATED" } }),
    // "Open Maintenance" — anything not yet resolved/rejected (review D7).
    prisma.maintenanceRequest.count({
      where: { status: { notIn: ["RESOLVED", "REJECTED"] } },
    }),
    // "Active Bookings" — derived: not cancelled and not yet ended (review B5).
    prisma.booking.count({
      where: { status: { not: "CANCELLED" }, endTime: { gt: now } },
    }),
    prisma.transferRequest.count({ where: { status: "REQUESTED" } }),
    prisma.allocation.count({
      where: { status: "ACTIVE", expectedReturnDate: { gte: now } },
    }),
    prisma.allocation.count({
      where: { status: "ACTIVE", expectedReturnDate: { lt: now } },
    }),
    prisma.activityLog.findMany({
      where: seesAllActivity ? {} : { actorId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const kpis = [
    { label: "Available", value: available, icon: Boxes, tone: "success" as const },
    { label: "Allocated", value: allocated, icon: PackageCheck, tone: "default" as const },
    { label: "Open Maintenance", value: openMaintenance, icon: Wrench, tone: "warning" as const },
    { label: "Active Bookings", value: activeBookings, icon: CalendarClock, tone: "default" as const },
    { label: "Pending Transfers", value: pendingTransfers, icon: ArrowLeftRight, tone: "default" as const },
    { label: "Upcoming Returns", value: upcomingReturns, icon: Undo2, tone: "default" as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s Overview</h1>
        <p className="text-sm text-muted-foreground">
          Real-time snapshot of your assets and resources.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger dark:border-red-900/50 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {overdue} asset{overdue === 1 ? "" : "s"} overdue for return - flagged
            for follow-up
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/assets">
          <Button>
            <Plus className="h-4 w-4" /> Register Asset
          </Button>
        </Link>
        <Link href="/booking">
          <Button variant="outline">
            <CalendarClock className="h-4 w-4" /> Book Resource
          </Button>
        </Link>
        <Link href="/maintenance">
          <Button variant="outline">
            <Wrench className="h-4 w-4" /> Raise Maintenance Request
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{a.description}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
