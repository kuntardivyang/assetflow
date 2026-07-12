import type { Booking, BookingStatus } from "@prisma/client";

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
