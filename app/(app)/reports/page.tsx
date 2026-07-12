import { redirect } from "next/navigation";
import { Boxes, PackageCheck, Clock, AlertTriangle, Download } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { KpiCard } from "@/components/KpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ReportCharts } from "@/components/reports/ReportCharts";
import {
  reportKpis,
  utilizationByDept,
  maintenanceByMonth,
  mostUsedAssets,
  idleAssets,
  nearingRetirement,
  deptAllocationSummary,
  bookingHeatmap,
} from "@/lib/services/reports";

// Screen 9 — Reports & Analytics. Org-wide analytics are Admin-only (rbac).
export default async function ReportsPage() {
  const session = await auth();
  if (!can(session?.user?.role, "analytics:viewAll")) redirect("/dashboard");

  const [kpis, utilization, maintenance, mostUsed, idle, nearing, deptSummary, heatmap] =
    await Promise.all([
      reportKpis(),
      utilizationByDept(),
      maintenanceByMonth(),
      mostUsedAssets(),
      idleAssets(),
      nearingRetirement(),
      deptAllocationSummary(),
      bookingHeatmap(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Organisation-wide operational insight across assets, allocations, and maintenance.
          </p>
        </div>
        <a href="/api/reports/export">
          <Button variant="outline">
            <Download className="h-4 w-4" /> Export report (CSV)
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Assets" value={kpis.total} icon={Boxes} />
        <KpiCard label="In Use" value={kpis.inUse} icon={PackageCheck} tone="success" />
        <KpiCard label="Idle (90d+)" value={kpis.idle} icon={Clock} tone="warning" />
        <KpiCard label="Nearing Retirement" value={kpis.nearing} icon={AlertTriangle} tone="danger" />
      </div>

      <ReportCharts utilization={utilization} maintenance={maintenance} heatmap={heatmap} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most-used assets</CardTitle>
          </CardHeader>
          <CardContent>
            <ListTable
              head={["Tag", "Name", "Uses"]}
              rows={mostUsed.map((a) => [a.tag, a.name, a.uses])}
              empty="No usage recorded yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Idle assets</CardTitle>
          </CardHeader>
          <CardContent>
            <ListTable
              head={["Tag", "Name", "Idle (days)"]}
              rows={idle.map((a) => [a.tag, a.name, a.idleDays])}
              empty="No idle assets."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nearing retirement</CardTitle>
          </CardHeader>
          <CardContent>
            <ListTable
              head={["Tag", "Name", "Age (yrs)"]}
              rows={nearing.map((a) => [a.tag, a.name, a.ageYears ?? "—"])}
              empty="No assets nearing retirement."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department allocation summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ListTable
              head={["Department", "Active", "Returned"]}
              rows={deptSummary.map((d) => [d.dept, d.active, d.returned])}
              empty="No allocations yet."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ListTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <Table>
      <THead>
        <TR>
          {head.map((h, i) => (
            <TH key={h} className={i === 0 ? "" : "text-right"}>
              {h}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((r, ri) => (
          <TR key={ri}>
            {r.map((c, ci) => (
              <TD key={ci} className={ci === 0 ? "font-medium" : "text-right tabular-nums"}>
                {c}
              </TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
