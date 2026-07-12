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

/**
 * Map a notification type to the Screen 10 filter tab (review D8).
 * Defined once here so both dashboard and notifications screens agree.
 */
export function notifTab(type: NotifType): "alerts" | "approvals" | "bookings" {
  switch (type) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_REMINDER":
      return "bookings";
    case "MAINT_APPROVED":
    case "TRANSFER_APPROVED":
      return "approvals";
    default:
      // Alerts: OVERDUE_RETURN, AUDIT_DISCREPANCY, MAINT_REJECTED,
      // TRANSFER_REJECTED, ASSET_ASSIGNED
      return "alerts";
  }
}
