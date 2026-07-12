"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  Check,
  X,
  CalendarClock,
  Package,
  CheckCheck,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotifType } from "@prisma/client";

type Item = {
  id: string;
  type: NotifType;
  message: string;
  read: boolean;
  link: string | null;
  tab: "alerts" | "approvals" | "bookings";
  createdAt: string;
};

type Log = { id: string; description: string; actor: string; createdAt: string };

const TABS = [
  { key: "all", label: "All" },
  { key: "alerts", label: "Alerts" },
  { key: "approvals", label: "Approvals" },
  { key: "bookings", label: "Bookings" },
] as const;

const ICON: Record<NotifType, { icon: LucideIcon; tone: string }> = {
  OVERDUE_RETURN: { icon: AlertTriangle, tone: "text-danger" },
  AUDIT_DISCREPANCY: { icon: AlertTriangle, tone: "text-danger" },
  MAINT_REJECTED: { icon: X, tone: "text-danger" },
  TRANSFER_REJECTED: { icon: X, tone: "text-danger" },
  MAINT_APPROVED: { icon: Check, tone: "text-success" },
  TRANSFER_APPROVED: { icon: Check, tone: "text-success" },
  BOOKING_CONFIRMED: { icon: CalendarClock, tone: "text-primary" },
  BOOKING_CANCELLED: { icon: CalendarClock, tone: "text-danger" },
  BOOKING_REMINDER: { icon: CalendarClock, tone: "text-warning" },
  ASSET_ASSIGNED: { icon: Package, tone: "text-primary" },
};

export function NotificationsFeed({ items, logs }: { items: Item[]; logs: Log[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  const filtered = tab === "all" ? items : items.filter((i) => i.tab === tab);
  const unread = items.filter((i) => !i.read).length;

  async function markRead(id: string, link: string | null) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    if (link) router.push(link);
    else router.refresh();
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const count = t.key === "all" ? items.length : items.filter((i) => i.tab === t.key).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    tab === t.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t.label}
                  <span className="ml-1.5 text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <Bell className="h-6 w-6" />
                <p className="text-sm">No notifications here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((n) => {
                  const { icon: Icon, tone } = ICON[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => markRead(n.id, n.link)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                          !n.read && "bg-accent/40",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
                        <span className="flex-1 text-sm">{n.message}</span>
                        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {logs.map((l) => (
                <li key={l.id} className="text-sm">
                  <p>{l.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.actor} · {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
