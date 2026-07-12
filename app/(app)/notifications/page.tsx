import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { notifTab } from "@/lib/services/notifications";
import { NotificationsFeed } from "@/components/notifications/NotificationsFeed";

// Screen 10 — keep every role informed without digging for updates.
export default async function NotificationsPage() {
  const session = await auth();
  const userId = session!.user.id;
  // Admins/managers see the org-wide activity log; others see their own actions.
  const seesAllActivity = can(session?.user.role, "analytics:viewAll");

  const [notifications, activity] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.activityLog.findMany({
      where: seesAllActivity ? {} : { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const items = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    read: n.read,
    link: n.link,
    tab: notifTab(n.type),
    createdAt: n.createdAt.toISOString(),
  }));

  const logs = activity.map((a) => ({
    id: a.id,
    description: a.description,
    actor: a.actor.name,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Alerts, approvals and bookings — plus a full activity log.
        </p>
      </div>
      <NotificationsFeed items={items} logs={logs} />
    </div>
  );
}
