import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deriveBookingStatus, generateReminders } from "@/lib/services/booking";
import { BookingClient } from "./BookingClient";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Screen 6 — time-slot booking of shared resources.
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, spRaw] = await Promise.all([auth(), searchParams]);
  const userId = session!.user.id;
  const role = session!.user.role;

  const resources = await prisma.asset.findMany({
    where: { bookable: true },
    select: { id: true, tag: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const resourceId = first(spRaw.resourceId) ?? resources[0]?.id ?? null;
  const dateStr = first(spRaw.date) ?? new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  await generateReminders(userId);

  const [dayBookings, myBookings, departments] = await Promise.all([
    resourceId
      ? prisma.booking.findMany({
          where: {
            assetId: resourceId,
            status: { not: "CANCELLED" },
            startTime: { lt: dayEnd },
            endTime: { gt: dayStart },
          },
          include: { bookedBy: { select: { name: true } } },
          orderBy: { startTime: "asc" },
        })
      : Promise.resolve([]),
    prisma.booking.findMany({
      where: { bookedById: userId, status: { not: "CANCELLED" }, endTime: { gt: new Date() } },
      include: { asset: { select: { tag: true, name: true } } },
      orderBy: { startTime: "asc" },
      take: 10,
    }),
    ["DEPARTMENT_HEAD", "ADMIN"].includes(role)
      ? prisma.department.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resource Booking</h1>
        <p className="text-sm text-muted-foreground">
          Book shared resources by time slot — overlapping requests are rejected.
        </p>
      </div>
      <BookingClient
        resources={resources}
        resourceId={resourceId}
        date={dateStr}
        dayBookings={dayBookings.map((b) => ({
          id: b.id,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
          bookedByName: b.bookedBy?.name ?? "Someone",
          status: deriveBookingStatus(b),
        }))}
        myBookings={myBookings.map((b) => ({
          id: b.id,
          assetLabel: `${b.asset.name} (${b.asset.tag})`,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
          status: deriveBookingStatus(b),
        }))}
        departments={departments}
      />
    </div>
  );
}
