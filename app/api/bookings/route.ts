import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAction, requireSession, apiError } from "@/lib/api";
import {
  createBooking,
  deriveBookingStatus,
  generateReminders,
  fmtRange,
  BookingConflictError,
  BookingRuleError,
} from "@/lib/services/booking";

const createSchema = z
  .object({
    assetId: z.string().min(1, "Pick a resource"),
    startTime: z.iso.datetime({ error: "Invalid start time" }),
    endTime: z.iso.datetime({ error: "Invalid end time" }),
    deptId: z.string().nullable().optional(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    error: "End time must be after start time",
  });

// GET /api/bookings?assetId=...&date=YYYY-MM-DD — one resource's bookings for
// a day. Statuses derived at read time; also drops due reminders for the caller.
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const p = new URL(req.url).searchParams;
    const assetId = p.get("assetId");
    if (!assetId) return NextResponse.json({ error: "assetId is required" }, { status: 400 });

    const day = p.get("date") ? new Date(`${p.get("date")}T00:00:00`) : new Date();
    if (Number.isNaN(day.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);

    await generateReminders(session.user.id);

    const bookings = await prisma.booking.findMany({
      where: {
        assetId,
        status: { not: "CANCELLED" },
        startTime: { lt: dayEnd },
        endTime: { gt: day },
      },
      include: { bookedBy: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(
      bookings.map((b) => ({ ...b, status: deriveBookingStatus(b) })),
    );
  } catch (e) {
    return apiError(e, "GET /api/bookings");
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAction("booking:create");
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // only dept heads / admins can book on behalf of a department
    const deptId =
      d.deptId && ["DEPARTMENT_HEAD", "ADMIN"].includes(session.user.role) ? d.deptId : null;

    try {
      const booking = await createBooking({
        assetId: d.assetId,
        bookedById: session.user.id,
        deptId,
        startTime: new Date(d.startTime),
        endTime: new Date(d.endTime),
      });
      return NextResponse.json(booking, { status: 201 });
    } catch (e) {
      if (e instanceof BookingConflictError) {
        return NextResponse.json(
          {
            error: `Requested ${fmtRange(new Date(d.startTime), new Date(d.endTime))} - conflict - slot is unavailable`,
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
    return apiError(e, "POST /api/bookings");
  }
}
