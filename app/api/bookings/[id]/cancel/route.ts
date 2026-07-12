import { NextResponse } from "next/server";
import { requireSession, apiError } from "@/lib/api";
import { cancelBooking, BookingRuleError } from "@/lib/services/booking";

// POST /api/bookings/:id/cancel — owner, or Admin/Asset Manager for anyone's.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    try {
      const booking = await cancelBooking({
        bookingId: id,
        actorId: session.user.id,
        isManager: ["ADMIN", "ASSET_MANAGER"].includes(session.user.role),
      });
      return NextResponse.json(booking);
    } catch (e) {
      if (e instanceof BookingRuleError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  } catch (e) {
    return apiError(e, "POST /api/bookings/:id/cancel");
  }
}
