"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Single-series charts using the app's brand token (var(--primary)) so they
// re-theme in dark mode. Grid/axes are recessive; each chart's title names the
// one series, so no legend is needed.

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {payload[0].name}:{" "}
        <span className="font-medium text-foreground">{payload[0].value}</span>
      </p>
    </div>
  );
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };
const axisLine = { stroke: "var(--border)" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HEAT_HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 08:00–19:00

export function ReportCharts({
  utilization,
  maintenance,
  heatmap,
}: {
  utilization: { dept: string; count: number }[];
  maintenance: { month: string; count: number }[];
  heatmap: number[][];
}) {
  const heatMax = Math.max(1, ...heatmap.flat());

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Utilization by department</CardTitle>
        </CardHeader>
        <CardContent>
          {utilization.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={utilization} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="dept" tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip />} />
                <Bar dataKey="count" name="Active allocations" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance frequency (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={maintenance} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={axisTick} axisLine={axisLine} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="count"
                name="Requests"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--primary)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Booking heatmap (peak windows)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-grid gap-1" style={{ gridTemplateColumns: `3rem repeat(${HEAT_HOURS.length}, 1.75rem)` }}>
              <div />
              {HEAT_HOURS.map((h) => (
                <div key={h} className="text-center text-[10px] text-muted-foreground">
                  {h}
                </div>
              ))}
              {DAYS.map((day, d) => (
                <FragmentRow key={day} day={day} counts={HEAT_HOURS.map((h) => heatmap[d]?.[h] ?? 0)} max={heatMax} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Hours 08:00–19:00 · darker = more bookings</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FragmentRow({ day, counts, max }: { day: string; counts: number[]; max: number }) {
  return (
    <>
      <div className="flex items-center text-xs text-muted-foreground">{day}</div>
      {counts.map((count, i) => (
        <div
          key={i}
          title={`${count} booking${count === 1 ? "" : "s"}`}
          className="h-7 rounded-[4px] border border-border"
          style={{
            backgroundColor: count ? "var(--primary)" : "var(--muted)",
            opacity: count ? 0.3 + 0.7 * (count / max) : 1,
          }}
        />
      ))}
    </>
  );
}

function Empty() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}
