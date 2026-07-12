"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

// Native <select>/<textarea> reuse the Input primitive's styling so the screen
// stays visually consistent without pulling in a component library.
const fieldClass =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface Asset {
  id: string;
  tag: string;
  name: string;
  status: string;
}
interface Employee {
  id: string;
  name: string;
  department: string | null;
}
interface HistoryRow {
  id: string;
  assetTag: string;
  assetName: string;
  toName: string;
  status: string;
  allocatedAt: string;
  returnCondition: string | null;
}
interface PendingTransfer {
  id: string;
  assetTag: string;
  assetName: string;
  fromName: string;
  toName: string;
  reason: string;
}

export function AllocationClient({
  assets,
  employees,
  selectedAssetId,
  holder,
  canAllocate,
  canRequestTransfer,
  canApprove,
  canReturn,
  history,
  pendingTransfers,
}: {
  assets: Asset[];
  employees: Employee[];
  selectedAssetId: string | null;
  holder: { name: string; dept: string | null } | null;
  canAllocate: boolean;
  canRequestTransfer: boolean;
  canApprove: boolean;
  canReturn: boolean;
  history: HistoryRow[];
  pendingTransfers: PendingTransfer[];
}) {
  const router = useRouter();
  const selected = assets.find((a) => a.id === selectedAssetId) ?? null;

  const [toUserId, setToUserId] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [reason, setReason] = useState("");
  const [returnCondition, setReturnCondition] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset the form whenever the selected asset changes.
  useEffect(() => {
    setToUserId("");
    setExpectedReturnDate("");
    setReason("");
    setReturnCondition("");
    setError("");
    setSuccess("");
  }, [selectedAssetId]);

  function onSelectAsset(id: string) {
    router.push(id ? `/allocation?assetId=${id}` : "/allocation");
  }

  async function submit(url: string, payload: Record<string, unknown>, okMsg: string) {
    setError("");
    setSuccess("");
    setLoading(true);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setSuccess(okMsg);
    setToUserId("");
    setExpectedReturnDate("");
    setReason("");
    setReturnCondition("");
    router.refresh();
  }

  function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    submit(
      "/api/allocations",
      { assetId: selected.id, toUserId, expectedReturnDate: expectedReturnDate || undefined },
      "Asset allocated.",
    );
  }

  function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    submit(
      "/api/transfers",
      { assetId: selected.id, toUserId, reason },
      "Transfer request submitted for approval.",
    );
  }

  function handleReturn() {
    if (!selected) return;
    submit(
      "/api/allocations/return",
      { assetId: selected.id, returnCondition: returnCondition || undefined },
      "Asset returned and marked available.",
    );
  }

  function handleApprove(id: string) {
    submit(`/api/transfers/${id}/approve`, {}, "Transfer approved.");
  }

  function handleReject(id: string) {
    submit(`/api/transfers/${id}/reject`, {}, "Transfer rejected.");
  }

  const isAllocated = !!holder;
  const isAvailable = selected?.status === "AVAILABLE";

  return (
    <div className="space-y-6">
      {/* Pending transfer approvals (Asset Manager / Dept Head) */}
      {canApprove && pendingTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Transfer Requests ({pendingTransfers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {pendingTransfers.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{t.assetTag}</span> {t.assetName} ·{" "}
                      {t.fromName} → {t.toName}
                    </p>
                    <p className="text-xs text-muted-foreground">Reason: {t.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleApprove(t.id)}
                      disabled={loading}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(t.id)}
                      disabled={loading}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: selector + action form */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="asset">Select an asset</Label>
              <select
                id="asset"
                className={fieldClass}
                value={selectedAssetId ?? ""}
                onChange={(e) => onSelectAsset(e.target.value)}
              >
                <option value="">— Choose an asset —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.tag} · {a.name} ({a.status.replaceAll("_", " ").toLowerCase()})
                  </option>
                ))}
              </select>
            </div>

            {!selected && (
              <p className="text-sm text-muted-foreground">
                Select an asset to allocate it, or to transfer it if it is already held.
              </p>
            )}

            {/* R1 — double-allocation block */}
            {selected && isAllocated && (
              <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger dark:border-red-900/50 dark:bg-red-900/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Already Allocated to <strong>{holder!.name}</strong>
                  {holder!.dept ? ` (${holder!.dept})` : ""}. Direct re-allocation is
                  blocked - submit a transfer request below.
                </span>
              </div>
            )}

            {/* Transfer form (asset is held) */}
            {selected && isAllocated && (
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="from">From</Label>
                  <Input id="from" value={holder!.name} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">To</Label>
                  <select
                    id="to"
                    className={fieldClass}
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                    required
                  >
                    <option value="">— Select employee —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                        {emp.department ? ` · ${emp.department}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Reason</Label>
                  <textarea
                    id="reason"
                    className={`${fieldClass} h-20 py-2`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this transfer needed?"
                    required
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                {success && <p className="text-sm text-success">{success}</p>}
                <Button type="submit" disabled={loading || !canRequestTransfer}>
                  {loading ? "Submitting…" : "Submit Transfer Request"}
                </Button>
                {!canRequestTransfer && (
                  <p className="text-xs text-muted-foreground">
                    You don&apos;t have permission to request transfers.
                  </p>
                )}
              </form>
            )}

            {/* Return (Asset Manager) — held asset back to available */}
            {selected && isAllocated && canReturn && (
              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="returnCond">Return asset</Label>
                <Input
                  id="returnCond"
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  placeholder="Condition on return (optional)"
                />
                <Button variant="outline" onClick={handleReturn} disabled={loading}>
                  {loading ? "Working…" : "Mark Returned"}
                </Button>
              </div>
            )}

            {/* Allocate form (asset is available) */}
            {selected && !isAllocated && isAvailable && (
              <form onSubmit={handleAllocate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="allocTo">Allocate to</Label>
                  <select
                    id="allocTo"
                    className={fieldClass}
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                    required
                  >
                    <option value="">— Select employee —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                        {emp.department ? ` · ${emp.department}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="return">Expected return date (optional)</Label>
                  <Input
                    id="return"
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                {success && <p className="text-sm text-success">{success}</p>}
                <Button type="submit" disabled={loading || !canAllocate}>
                  {loading ? "Allocating…" : "Allocate Asset"}
                </Button>
                {!canAllocate && (
                  <p className="text-xs text-muted-foreground">
                    You don&apos;t have permission to allocate assets.
                  </p>
                )}
              </form>
            )}

            {/* Not allocatable (under maintenance / reserved / retired …) */}
            {selected && !isAllocated && !isAvailable && (
              <p className="text-sm text-muted-foreground">
                This asset is <StatusBadge status={selected.status} /> and cannot be
                allocated right now.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column: allocation history */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selected ? `History — ${selected.tag}` : "Recent Allocations"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No allocation history yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{h.assetTag}</span> → {h.toName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(h.allocatedAt), { addSuffix: true })}
                      {h.returnCondition ? ` · returned: ${h.returnCondition}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={h.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
