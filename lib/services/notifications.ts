import { prisma } from "@/lib/db";
import type { NotifType } from "@prisma/client";

/**
 * Shared helpers used by every domain service (allocation, booking,
 * maintenance, audit) so notifications + the activity log stay consistent.
 * Screen 10 reads from both tables.
 */

export async function notify(params: {
  userId: string;
  type: NotifType;
  message: string;
  link?: string;
}) {
  return prisma.notification.create({ data: params });
}

export async function logActivity(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
}) {
  return prisma.activityLog.create({ data: params });
}

/** Map a notification type to the Screen 10 filter tab. */
export function notifTab(type: NotifType): "alerts" | "approvals" | "bookings" {
  switch (type) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_REMINDER":
      return "bookings";
    case "MAINT_APPROVED":
    case "MAINT_REJECTED":
    case "TRANSFER_APPROVED":
      return "approvals";
    default:
      return "alerts"; // ASSET_ASSIGNED, OVERDUE_RETURN, AUDIT_DISCREPANCY
  }
}
