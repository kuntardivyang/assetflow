import { prisma } from "@/lib/db";
import type { Booking, BookingStatus, Prisma } from "@prisma/client";
import { notify, logActivity } from "@/lib/services/notifications";

/**
 * Booking status is DERIVED at read time (review B5). Nothing transitions
 * UPCOMING→ONGOING→COMPLETED in `npm run dev` (no cron), so only CANCELLED is
 * real stored state. Compute the rest from the clock.
 */
export function deriveBookingStatus(
  b: Pick<Booking, "status" | "startTime" | "endTime">,
  now: Date = new Date(),
): BookingStatus {
  if (b.status === "CANCELLED") return "CANCELLED";
  if (now < b.startTime) return "UPCOMING";
  if (now < b.endTime) return "ONGOING";
  return "COMPLETED";
}

/** A booking is "active" for KPI purposes if it isn't cancelled and hasn't ended. */
export function isActiveBooking(
  b: Pick<Booking, "status" | "endTime">,
  now: Date = new Date(),
): boolean {
  return b.status !== "CANCELLED" && b.endTime > now;
}

/**
 * Overlap test for a proposed [start, end) against an existing booking.
 * Half-open intervals: 9–10 and 10–11 do NOT overlap. For the reschedule
 * path, exclude the booking's own row by id before calling this (review B3).
 */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Thrown when the requested slot overlaps an existing booking (R2). */
export class BookingConflictError extends Error {
  constructor(
    public conflict: { startTime: Date; endTime: Date; bookedByName: string | null },
  ) {
    super("slot is unavailable");
    this.name = "BookingConflictError";
  }
}

/** Thrown when a booking request breaks a business rule (not a conflict). */
export class BookingRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingRuleError";
  }
}

const STATUS_LABEL: Record<string, string> = {
  UNDER_MAINTENANCE: "under maintenance",
  LOST: "lost",
  RETIRED: "retired",
  DISPOSED: "disposed",
  ALLOCATED: "allocated",
  RESERVED: "reserved",
};

async function findClash(
  tx: Prisma.TransactionClient,
  assetId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string,
) {
  return tx.booking.findFirst({
    where: {
      assetId,
      status: { not: "CANCELLED" },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeId && { id: { not: excludeId } }),
    },
    include: { bookedBy: { select: { name: true } } },
  });
}

// R2. Lock the asset row first so two requests for the same resource
// serialize — the second one re-runs its overlap check and sees the first.
export async function createBooking(params: {
  assetId: string;
  bookedById: string;
  deptId?: string | null;
  startTime: Date;
  endTime: Date;
}) {
  const booking = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${params.assetId} FOR UPDATE`;

    const asset = await tx.asset.findUnique({
      where: { id: params.assetId },
      select: { id: true, tag: true, name: true, bookable: true, status: true },
    });
    if (!asset) throw new BookingRuleError("Resource not found");
    // bookable assets only; bookings never touch asset.status
    if (!asset.bookable) throw new BookingRuleError("This asset is not a bookable resource");
    if (asset.status !== "AVAILABLE") {
      throw new BookingRuleError(
        `${asset.name} is ${STATUS_LABEL[asset.status] ?? asset.status.toLowerCase()} and can't be booked right now`,
      );
    }

    const clash = await findClash(tx, params.assetId, params.startTime, params.endTime);
    if (clash) {
      throw new BookingConflictError({
        startTime: clash.startTime,
        endTime: clash.endTime,
        bookedByName: clash.bookedBy?.name ?? null,
      });
    }

    return tx.booking.create({
      data: {
        assetId: params.assetId,
        bookedById: params.bookedById,
        deptId: params.deptId ?? null,
        startTime: params.startTime,
        endTime: params.endTime,
      },
      include: {
        asset: { select: { tag: true, name: true } },
        bookedBy: { select: { name: true } },
      },
    });
  });

  await Promise.all([
    notify({
      userId: params.bookedById,
      type: "BOOKING_CONFIRMED",
      message: `Booking confirmed: ${booking.asset.name} — ${fmtRange(booking.startTime, booking.endTime)}`,
      link: "/booking",
    }).catch((err) => console.error("[booking.create] notify failed", err)),
    logActivity({
      actorId: params.bookedById,
      action: "booking.create",
      entityType: "Booking",
      entityId: booking.id,
      description: `Booked ${booking.asset.name} (${booking.asset.tag}) ${fmtRange(booking.startTime, booking.endTime)}`,
    }).catch((err) => console.error("[booking.create] log failed", err)),
  ]);

  return booking;
}

export async function rescheduleBooking(params: {
  bookingId: string;
  actorId: string;
  isManager: boolean;
  startTime: Date;
  endTime: Date;
}) {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: params.bookingId },
      include: { asset: { select: { id: true, tag: true, name: true } } },
    });
    if (!existing) throw new BookingRuleError("Booking not found");
    if (existing.bookedById !== params.actorId && !params.isManager) {
      throw new BookingRuleError("You can only reschedule your own bookings");
    }
    if (deriveBookingStatus(existing) !== "UPCOMING") {
      throw new BookingRuleError("Only upcoming bookings can be rescheduled");
    }

    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${existing.asset.id} FOR UPDATE`;
    const clash = await findClash(
      tx,
      existing.asset.id,
      params.startTime,
      params.endTime,
      existing.id, // don't conflict with our own slot
    );
    if (clash) {
      throw new BookingConflictError({
        startTime: clash.startTime,
        endTime: clash.endTime,
        bookedByName: null,
      });
    }

    return tx.booking.update({
      where: { id: existing.id },
      data: { startTime: params.startTime, endTime: params.endTime },
      include: {
        asset: { select: { tag: true, name: true } },
        bookedBy: { select: { name: true } },
      },
    });
  });

  await Promise.all([
    notify({
      userId: booking.bookedById,
      type: "BOOKING_CONFIRMED",
      message: `Booking rescheduled: ${booking.asset.name} — ${fmtRange(booking.startTime, booking.endTime)}`,
      link: "/booking",
    }).catch((err) => console.error("[booking.reschedule] notify failed", err)),
    logActivity({
      actorId: params.actorId,
      action: "booking.reschedule",
      entityType: "Booking",
      entityId: booking.id,
      description: `Rescheduled ${booking.asset.name} to ${fmtRange(booking.startTime, booking.endTime)}`,
    }).catch((err) => console.error("[booking.reschedule] log failed", err)),
  ]);

  return booking;
}

export async function cancelBooking(params: {
  bookingId: string;
  actorId: string;
  isManager: boolean;
}) {
  const existing = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { asset: { select: { tag: true, name: true } } },
  });
  if (!existing) throw new BookingRuleError("Booking not found");
  if (existing.bookedById !== params.actorId && !params.isManager) {
    throw new BookingRuleError("You can only cancel your own bookings");
  }
  if (deriveBookingStatus(existing) === "COMPLETED") {
    throw new BookingRuleError("This booking already ended");
  }
  if (existing.status === "CANCELLED") return existing;

  const booking = await prisma.booking.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
  });

  await Promise.all([
    notify({
      userId: existing.bookedById,
      type: "BOOKING_CANCELLED",
      message: `Booking cancelled: ${existing.asset.name} — ${fmtRange(existing.startTime, existing.endTime)}`,
      link: "/booking",
    }).catch((err) => console.error("[booking.cancel] notify failed", err)),
    logActivity({
      actorId: params.actorId,
      action: "booking.cancel",
      entityType: "Booking",
      entityId: booking.id,
      description: `Cancelled booking of ${existing.asset.name} (${existing.asset.tag})`,
    }).catch((err) => console.error("[booking.cancel] log failed", err)),
  ]);

  return booking;
}

// Reminders for bookings starting within the hour. dedupeKey + skipDuplicates
// makes this safe to call on every page load. Best-effort all the way — a
// failure here must never take down the page that called it.
export async function generateReminders(userId: string, now: Date = new Date()) {
  try {
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    const upcoming = await prisma.booking.findMany({
      where: {
        bookedById: userId,
        status: { not: "CANCELLED" },
        startTime: { gt: now, lte: soon },
      },
      include: { asset: { select: { name: true } } },
    });
    if (upcoming.length === 0) return;
    await prisma.notification.createMany({
      data: upcoming.map((b) => ({
        userId,
        type: "BOOKING_REMINDER" as const,
        message: `Reminder: ${b.asset.name} booked ${fmtRange(b.startTime, b.endTime)}`,
        link: "/booking",
        dedupeKey: `BOOKING_REMINDER:${b.id}`,
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[booking.reminders] failed", err);
  }
}

export function fmtRange(start: Date, end: Date): string {
  const t = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${t(start)} to ${t(end)}`;
}
