import { NextResponse } from "next/server";
import { requireAction, apiError } from "@/lib/api";
import { assetReport } from "@/lib/services/reports";

const HEADERS = [
  "Tag",
  "Name",
  "Category",
  "Status",
  "Location",
  "Department",
  "Acquisition Date",
  "Acquisition Cost",
  "Allocations",
  "Bookings",
];

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

// GET /api/reports/export — org-wide asset report as CSV (Admin only).
export async function GET() {
  try {
    await requireAction("analytics:viewAll");
    const rows = await assetReport();
    const csv = [
      HEADERS.join(","),
      ...rows.map((r) =>
        [
          r.tag,
          r.name,
          r.category,
          r.status,
          r.location,
          r.department,
          r.acquisitionDate,
          r.acquisitionCost,
          r.allocations,
          r.bookings,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n") + "\n";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="assetflow-report.csv"',
      },
    });
  } catch (e) {
    return apiError(e, "GET /api/reports/export");
  }
}
