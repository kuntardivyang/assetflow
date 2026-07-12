import { prisma } from "@/lib/db";

/**
 * Screen 9 — Reports & Analytics aggregations.
 *
 * All functions return plain, client-serializable data (no Prisma.Decimal or
 * Date objects cross the server→client boundary — costs are Number()'d, dates
 * are pre-formatted). Time-bucketed views (month, hour×day) can't use Prisma
 * groupBy, so they findMany + reduce in JS.
 */

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;
const IDLE_DAYS = 90;
const RETIRE_YEARS = 5;

/** 1. Utilization by department — active allocations per department. */
export async function utilizationByDept() {
  const [groups, depts] = await Promise.all([
    prisma.allocation.groupBy({
      by: ["toDeptId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(depts.map((d) => [d.id, d.name] as const));
  return groups
    .map((g) => ({
      dept: g.toDeptId ? nameOf.get(g.toDeptId) ?? "Unknown" : "Unassigned",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

/** 2. Maintenance frequency by month — last N months, zero-filled for a clean axis. */
export async function maintenanceByMonth(months = 6) {
  const now = new Date();
  const buckets: { month: string; count: number }[] = [];
  const indexOf = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    indexOf.set(key, buckets.length);
    buckets.push({ month: d.toLocaleString("en", { month: "short" }), count: 0 });
  }
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const reqs = await prisma.maintenanceRequest.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  for (const r of reqs) {
    const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}`;
    const idx = indexOf.get(key);
    if (idx != null) buckets[idx].count++;
  }
  return buckets;
}

/** 3a. Most-used assets — combined allocation + booking count. */
export async function mostUsedAssets(limit = 5) {
  const [allocs, books] = await Promise.all([
    prisma.allocation.groupBy({ by: ["assetId"], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["assetId"],
      where: { status: { not: "CANCELLED" } },
      _count: { _all: true },
    }),
  ]);
  const score = new Map<string, number>();
  for (const a of allocs) score.set(a.assetId, (score.get(a.assetId) ?? 0) + a._count._all);
  for (const b of books) score.set(b.assetId, (score.get(b.assetId) ?? 0) + b._count._all);

  const top = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];
  const assets = await prisma.asset.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, tag: true, name: true },
  });
  const info = new Map(assets.map((a) => [a.id, a] as const));
  return top.map(([id, uses]) => ({
    tag: info.get(id)?.tag ?? "?",
    name: info.get(id)?.name ?? "",
    uses,
  }));
}

/** 3b. Idle assets — no allocation/booking activity for IDLE_DAYS (baseline = acquisition date). */
export async function idleAssets(limit = 8, days = IDLE_DAYS) {
  const now = Date.now();
  const cutoff = now - days * DAY;
  const [assets, allocMax, bookMax, activeAllocs] = await Promise.all([
    prisma.asset.findMany({
      where: { status: { notIn: ["RETIRED", "DISPOSED"] } },
      select: { id: true, tag: true, name: true, createdAt: true, acquisitionDate: true },
    }),
    prisma.allocation.groupBy({ by: ["assetId"], _max: { allocatedAt: true } }),
    prisma.booking.groupBy({
      by: ["assetId"],
      where: { status: { not: "CANCELLED" } },
      _max: { startTime: true },
    }),
    prisma.allocation.findMany({ where: { status: "ACTIVE" }, select: { assetId: true } }),
  ]);
  const lastAlloc = new Map(allocMax.map((a) => [a.assetId, a._max.allocatedAt] as const));
  const lastBook = new Map(bookMax.map((b) => [b.assetId, b._max.startTime] as const));
  const inUse = new Set(activeAllocs.map((a) => a.assetId));

  return assets
    .filter((a) => !inUse.has(a.id)) // a currently-held asset is in use, not idle
    .map((a) => {
      const times = [lastAlloc.get(a.id), lastBook.get(a.id)].filter(Boolean) as Date[];
      const baseline = a.acquisitionDate ?? a.createdAt;
      const last = times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : baseline;
      return { tag: a.tag, name: a.name, lastMs: last.getTime() };
    })
    .filter((r) => r.lastMs < cutoff)
    .sort((a, b) => a.lastMs - b.lastMs)
    .slice(0, limit)
    .map((r) => ({ tag: r.tag, name: r.name, idleDays: Math.floor((now - r.lastMs) / DAY) }));
}

/** 4. Assets nearing retirement — acquired ≥ RETIRE_YEARS ago, still in service. */
export async function nearingRetirement(years = RETIRE_YEARS, limit = 10) {
  const cutoff = new Date(Date.now() - years * YEAR);
  const assets = await prisma.asset.findMany({
    where: { acquisitionDate: { lte: cutoff }, status: { notIn: ["RETIRED", "DISPOSED"] } },
    select: { tag: true, name: true, acquisitionDate: true },
    orderBy: { acquisitionDate: "asc" },
    take: limit,
  });
  return assets.map((a) => ({
    tag: a.tag,
    name: a.name,
    ageYears: a.acquisitionDate
      ? Math.round(((Date.now() - a.acquisitionDate.getTime()) / YEAR) * 10) / 10
      : null,
  }));
}

/** 5. Department-wise allocation summary — active vs returned per department. */
export async function deptAllocationSummary() {
  const [groups, depts] = await Promise.all([
    prisma.allocation.groupBy({ by: ["toDeptId", "status"], _count: { _all: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = (id: string | null) =>
    id ? depts.find((d) => d.id === id)?.name ?? "Unknown" : "Unassigned";
  const rows = new Map<string, { dept: string; active: number; returned: number }>();
  for (const g of groups) {
    const key = g.toDeptId ?? "none";
    const row = rows.get(key) ?? { dept: nameOf(g.toDeptId), active: 0, returned: 0 };
    if (g.status === "ACTIVE") row.active += g._count._all;
    else row.returned += g._count._all;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.active - a.active);
}

/** 6. Booking heatmap — non-cancelled bookings bucketed by weekday × hour. */
export async function bookingHeatmap() {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { startTime: true, endTime: true },
  });
  // 7 weekdays × 24 hours, incrementing every hour a booking spans.
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const b of bookings) {
    const day = b.startTime.getDay();
    const startH = b.startTime.getHours();
    const endH = Math.max(startH + 1, b.endTime.getHours());
    for (let h = startH; h < endH && h < 24; h++) matrix[day][h]++;
  }
  return matrix;
}

/** Top-level KPIs for the report header. */
export async function reportKpis() {
  const now = new Date();
  const retireCutoff = new Date(Date.now() - RETIRE_YEARS * YEAR);
  const [total, inUse, nearing, idle] = await Promise.all([
    prisma.asset.count({ where: { status: { notIn: ["DISPOSED"] } } }),
    prisma.allocation.count({ where: { status: "ACTIVE" } }),
    prisma.asset.count({
      where: { acquisitionDate: { lte: retireCutoff }, status: { notIn: ["RETIRED", "DISPOSED"] } },
    }),
    idleAssets(9999).then((rows) => rows.length),
  ]);
  void now;
  return { total, inUse, nearing, idle };
}

/** Flat asset report for CSV export (one row per asset). */
export async function assetReport() {
  const assets = await prisma.asset.findMany({
    orderBy: { tag: "asc" },
    include: {
      category: { select: { name: true } },
      currentDept: { select: { name: true } },
      _count: { select: { allocations: true, bookings: true } },
    },
  });
  return assets.map((a) => ({
    tag: a.tag,
    name: a.name,
    category: a.category.name,
    status: a.status,
    location: a.location ?? "",
    department: a.currentDept?.name ?? "",
    acquisitionDate: a.acquisitionDate ? a.acquisitionDate.toISOString().slice(0, 10) : "",
    acquisitionCost: a.acquisitionCost != null ? Number(a.acquisitionCost) : "",
    allocations: a._count.allocations,
    bookings: a._count.bookings,
  }));
}
