import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, apiError } from "@/lib/api";
import {
  rescheduleBooking,
  fmtRange,
  BookingConflictError,
  BookingRuleError,
} from "@/lib/services/booking";

const rescheduleSchema = z
  .object({
    startTime: z.iso.datetime({ error: "Invalid start time" }),
    endTime: z.iso.datetime({ error: "Invalid end time" }),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    error: "End time must be after start time",
  });

// PATCH /api/bookings/:id — reschedule. Owner may reschedule their own
// booking; Admin/Asset Manager may reschedule anyone's.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    try {
      const booking = await rescheduleBooking({
        bookingId: id,
        actorId: session.user.id,
        isManager: ["ADMIN", "ASSET_MANAGER"].includes(session.user.role),
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
      });
      return NextResponse.json(booking);
    } catch (e) {
      if (e instanceof BookingConflictError) {
        return NextResponse.json(
          {
            error: `Requested ${fmtRange(new Date(parsed.data.startTime), new Date(parsed.data.endTime))} - conflict - slot is unavailable`,
            conflict: e.conflict,
          },
          { status: 409 },
        );
      }
      if (e instanceof BookingRuleError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "PATCH /api/bookings/:id");
  }
}
