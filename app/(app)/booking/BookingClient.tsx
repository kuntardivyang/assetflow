"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

type DayBooking = {
  id: string;
  startTime: string;
  endTime: string;
  bookedByName: string;
  status: string;
};

type MyBooking = {
  id: string;
  assetLabel: string;
  startTime: string;
  endTime: string;
  status: string;
};

// Default working hours, widened to cover any booking that falls outside them
// so an early/late slot never renders as an empty (falsely free) row.
function gridHours(bookings: { startTime: string; endTime: string }[]) {
  let lo = 8;
  let hi = 18;
  for (const b of bookings) {
    lo = Math.min(lo, new Date(b.startTime).getHours());
    hi = Math.max(hi, new Date(b.endTime).getHours() + (new Date(b.endTime).getMinutes() > 0 ? 1 : 0));
  }
  return Array.from({ length: hi - lo }, (_, i) => lo + i);
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

export function BookingClient({
  resources,
  resourceId,
  date,
  dayBookings,
  myBookings,
  departments,
}: {
  resources: { id: string; tag: string; name: string; status: string }[];
  resourceId: string | null;
  date: string;
  dayBookings: DayBooking[];
  myBookings: MyBooking[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [deptId, setDeptId] = useState("");
  const [conflict, setConflict] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [resched, setResched] = useState<MyBooking | null>(null);
  const [reschedStart, setReschedStart] = useState("");
  const [reschedEnd, setReschedEnd] = useState("");
  const [reschedError, setReschedError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/booking?${next.toString()}`);
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceId) return;
    setConflict("");
    setError("");
    setPending(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: resourceId,
        startTime: new Date(`${date}T${start}:00`).toISOString(),
        endTime: new Date(`${date}T${end}:00`).toISOString(),
        deptId: deptId || null,
      }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Network error — try again");
    const data = await res.json().catch(() => null);
    if (res.status === 409) {
      const clash = data?.conflict
        ? ` Clashes with ${data.conflict.bookedByName ?? "another"}'s booking, ${fmtTime(data.conflict.startTime)} to ${fmtTime(data.conflict.endTime)}.`
        : "";
      return setConflict(`${data?.error ?? "Conflict — slot is unavailable"}.${clash}`);
    }
    if (!res.ok) return setError(data?.error ?? `Request failed (${res.status})`);
    if (!data?.id) return setError("Unexpected response — are you still signed in?");
    router.refresh();
  }

  async function cancel(b: MyBooking) {
    setBusyId(b.id);
    setCancelError("");
    const res = await fetch(`/api/bookings/${b.id}/cancel`, { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusyId(null);
    if (!res || !res.ok) {
      return setCancelError(data?.error ?? (res ? `Request failed (${res.status})` : "Network error"));
    }
    // expired session comes back as a 200 login page, not JSON
    if (!data?.id) return setCancelError("Unexpected response — are you still signed in?");
    router.refresh();
  }

  function openResched(b: MyBooking) {
    setResched(b);
    setReschedStart(new Date(b.startTime).toTimeString().slice(0, 5));
    setReschedEnd(new Date(b.endTime).toTimeString().slice(0, 5));
    setReschedError("");
  }

  async function submitResched(e: React.FormEvent) {
    e.preventDefault();
    if (!resched) return;
    setBusyId(resched.id);
    setReschedError("");
    // local calendar date — slicing the ISO string would give the UTC date,
    // which is a different day for early-morning slots
    const day = new Date(resched.startTime).toLocaleDateString("en-CA");
    const res = await fetch(`/api/bookings/${resched.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date(`${day}T${reschedStart}:00`).toISOString(),
        endTime: new Date(`${day}T${reschedEnd}:00`).toISOString(),
      }),
    }).catch(() => null);
    if (!res) {
      setBusyId(null);
      return setReschedError("Network error — try again");
    }
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) {
      return setReschedError(
        data?.conflict
          ? `${data.error} — clashes with the ${fmtTime(data.conflict.startTime)} to ${fmtTime(data.conflict.endTime)} booking`
          : (data?.error ?? `Request failed (${res.status})`),
      );
    }
    if (!data?.id) return setReschedError("Unexpected response — are you still signed in?");
    setResched(null);
    router.refresh();
  }

  const selected = resources.find((r) => r.id === resourceId);
  const hours = gridHours(dayBookings);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Resource"
            className="max-w-72"
            value={resourceId ?? ""}
            onChange={(e) => setParam("resourceId", e.target.value)}
          >
            {resources.length === 0 && <option value="">No bookable resources yet</option>}
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.tag})
              </option>
            ))}
          </Select>
          <Input
            type="date"
            aria-label="Date"
            className="w-40"
            value={date}
            onChange={(e) => setParam("date", e.target.value)}
          />
        </div>

        {selected && selected.status !== "AVAILABLE" && (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            {selected.name} is currently {selected.status.replaceAll("_", " ").toLowerCase()} and
            can&apos;t take new bookings.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? `${selected.name} — ${date}` : "Pick a resource"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {hours.map((h) => {
              const rowStart = new Date(`${date}T${String(h).padStart(2, "0")}:00:00`);
              const rowEnd = new Date(rowStart.getTime() + 60 * 60 * 1000);
              const starting = dayBookings.filter(
                (b) => new Date(b.startTime) >= rowStart && new Date(b.startTime) < rowEnd,
              );
              const covering = dayBookings.some(
                (b) => new Date(b.startTime) < rowStart && new Date(b.endTime) > rowStart,
              );
              return (
                <div key={h} className="flex min-h-11 items-stretch gap-3 border-b border-border/60 last:border-0">
                  <div className="w-16 shrink-0 pt-2 text-xs text-muted-foreground">
                    {h <= 12 ? h : h - 12}:00 {h < 12 ? "AM" : "PM"}
                  </div>
                  <div className="flex-1 space-y-1 py-1">
                    {starting.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-sm text-accent-foreground"
                      >
                        Booked — {b.bookedByName} — {fmtTime(b.startTime)} to {fmtTime(b.endTime)}
                        <span className="ml-2 inline-block align-middle">
                          <StatusBadge status={b.status} />
                        </span>
                      </div>
                    ))}
                    {starting.length === 0 && covering && (
                      <div className="h-2 rounded bg-primary/10" />
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Book a slot</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={book} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="b-start">Start</Label>
                  <Input
                    id="b-start"
                    type="time"
                    step={1800}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-end">End</Label>
                  <Input
                    id="b-end"
                    type="time"
                    step={1800}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
              {departments.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="b-dept">On behalf of department (optional)</Label>
                  <Select id="b-dept" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                    <option value="">Myself</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {conflict && (
                <p className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                  {conflict}
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending || !resourceId}>
                {pending ? "Booking…" : "Book a slot"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myBookings.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
            )}
            {cancelError && <p className="text-sm text-danger">{cancelError}</p>}
            {myBookings.map((b) => (
              <div key={b.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{b.assetLabel}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.startTime).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {fmtTime(b.startTime)} to {fmtTime(b.endTime)}
                </p>
                {b.status === "UPCOMING" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === b.id}
                      onClick={() => openResched(b)}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === b.id}
                      onClick={() => cancel(b)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!resched}
        onClose={() => {
          if (busyId === null) setResched(null);
        }}
        title={resched ? `Reschedule — ${resched.assetLabel}` : ""}
      >
        <form onSubmit={submitResched} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-start">New start</Label>
              <Input
                id="r-start"
                type="time"
                step={1800}
                value={reschedStart}
                onChange={(e) => setReschedStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-end">New end</Label>
              <Input
                id="r-end"
                type="time"
                step={1800}
                value={reschedEnd}
                onChange={(e) => setReschedEnd(e.target.value)}
                required
              />
            </div>
          </div>
          {reschedError && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {reschedError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={busyId !== null}
              onClick={() => setResched(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busyId !== null}>
              {busyId ? "Saving…" : "Reschedule"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
