"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

const fieldClass =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface CycleRow {
  id: string;
  name: string;
  status: string;
  itemCount: number;
}
interface Item {
  id: string;
  assetTag: string;
  assetName: string;
  expectedLocation: string | null;
  result: string;
  notes: string | null;
}
interface SelectedCycle {
  id: string;
  name: string;
  status: string;
  scopeDept: string | null;
  scopeLocation: string | null;
  startDate: string;
  endDate: string;
  closedAt: string | null;
  auditorNames: string[];
  items: Item[];
}
interface Options {
  departments: { id: string; name: string }[];
  locations: string[];
  users: { id: string; name: string }[];
}

export function AuditClient({
  canManage,
  canMark,
  cycles,
  selected,
  options,
}: {
  canManage: boolean;
  canMark: boolean;
  cycles: CycleRow[];
  selected: SelectedCycle | null;
  options: Options;
}) {
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scopeDeptId, setScopeDeptId] = useState("");
  const [scopeLocation, setScopeLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [auditorIds, setAuditorIds] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(
    url: string,
    method: string,
    payload: Record<string, unknown> | null,
    okMsg: string,
  ) {
    setError("");
    setSuccess("");
    setLoading(true);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    }).catch(() => null);
    setLoading(false);
    if (!res) {
      setError("Network error — please check your connection and try again.");
      return false;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return false;
    }
    setSuccess(okMsg);
    router.refresh();
    return true;
  }

  function onSelectCycle(id: string) {
    router.push(id ? `/audit?cycleId=${id}` : "/audit");
  }

  function toggleAuditor(id: string) {
    setAuditorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send(
      "/api/audit",
      "POST",
      {
        name,
        scopeDeptId: scopeDeptId || undefined,
        scopeLocation: scopeLocation || undefined,
        startDate,
        endDate,
        auditorIds,
      },
      "Audit cycle created.",
    );
    if (ok) {
      setShowCreate(false);
      setName("");
      setScopeDeptId("");
      setScopeLocation("");
      setStartDate("");
      setEndDate("");
      setAuditorIds([]);
    }
  }

  function handleMark(itemId: string, result: string) {
    send(`/api/audit/items/${itemId}`, "PATCH", { result }, "Checklist updated.");
  }

  function handleClose() {
    if (!selected) return;
    send(`/api/audit/${selected.id}/close`, "POST", null, "Audit closed — discrepancy report generated.");
  }

  const isOpen = selected?.status === "OPEN";
  const flagged = selected
    ? selected.items.filter((i) => i.result === "MISSING" || i.result === "DAMAGED")
    : [];

  const verifyOptions: { label: string; value: string; variant: "success" | "danger" | "primary" }[] = [
    { label: "Verified", value: "VERIFIED", variant: "success" },
    { label: "Missing", value: "MISSING", variant: "danger" },
    { label: "Damaged", value: "DAMAGED", variant: "primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Cycle picker + create toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="cycle">Audit cycle</Label>
          <select
            id="cycle"
            className={fieldClass}
            value={selected?.id ?? ""}
            onChange={(e) => onSelectCycle(e.target.value)}
          >
            {cycles.length === 0 && <option value="">— No cycles yet —</option>}
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.status.toLowerCase()} ({c.itemCount} items)
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <Button variant={showCreate ? "outline" : "primary"} onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? "Cancel" : "+ New Cycle"}
          </Button>
        )}
      </div>

      {/* Create cycle form */}
      {canManage && showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Audit Cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 Audit — Engineering" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="scopeDept">Scope: department (optional)</Label>
                  <select id="scopeDept" className={fieldClass} value={scopeDeptId} onChange={(e) => setScopeDeptId(e.target.value)}>
                    <option value="">— Any —</option>
                    {options.departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scopeLoc">Scope: location (optional)</Label>
                  <select id="scopeLoc" className={fieldClass} value={scopeLocation} onChange={(e) => setScopeLocation(e.target.value)}>
                    <option value="">— Any —</option>
                    {options.locations.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start">Start date</Label>
                  <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">End date</Label>
                  <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Auditors (one or more)</Label>
                <div className="flex flex-wrap gap-3">
                  {options.users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={auditorIds.includes(u.id)} onChange={() => toggleAuditor(u.id)} />
                      {u.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave both scopes empty to audit the entire asset registry.
                </p>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              {success && <p className="text-sm text-success">{success}</p>}
              <Button type="submit" disabled={loading || auditorIds.length === 0}>
                {loading ? "Creating…" : "Create Cycle"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Selected cycle */}
      {!selected ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No audit cycle selected.{canManage ? " Create one to begin." : ""}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{selected.name}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.scopeDept ? `Dept: ${selected.scopeDept}` : "All departments"}
                  {selected.scopeLocation ? ` · Location: ${selected.scopeLocation}` : ""}
                  {" · Auditors: "}
                  {selected.auditorNames.join(", ") || "—"}
                </p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Live discrepancy banner (yellow) */}
            {flagged.length > 0 && (
              <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning dark:border-amber-900/50 dark:bg-amber-900/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {flagged.length} asset{flagged.length === 1 ? "" : "s"} flagged - discrepancy
                  report generated automatically
                </span>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}

            {/* Checklist */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    <th className="py-2 pr-3 font-medium">Expected location</th>
                    <th className="py-2 font-medium">Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((it) => (
                    <tr key={it.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{it.assetTag}</span> {it.assetName}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {it.expectedLocation ?? "—"}
                      </td>
                      <td className="py-2.5">
                        {isOpen && canMark ? (
                          <div className="flex flex-wrap gap-1.5">
                            {verifyOptions.map((o) => (
                              <Button
                                key={o.value}
                                size="sm"
                                variant={it.result === o.value ? o.variant : "outline"}
                                onClick={() => handleMark(it.id, o.value)}
                                disabled={loading}
                              >
                                {o.label}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <StatusBadge status={it.result} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Close cycle */}
            {isOpen && canManage && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Closing applies MISSING → Lost, DAMAGED → condition flagged, then locks the cycle.
                </p>
                <Button variant="danger" onClick={handleClose} disabled={loading}>
                  {loading ? "Closing…" : "Close Audit Cycle"}
                </Button>
              </div>
            )}
            {!isOpen && (
              <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                Cycle closed{selected.closedAt ? ` on ${new Date(selected.closedAt).toLocaleDateString()}` : ""} — read-only.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
