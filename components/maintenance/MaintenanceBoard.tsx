"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check, X, Play, Wrench, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MaintStatus, Priority } from "@prisma/client";

type Card = {
  id: string;
  status: MaintStatus;
  priority: Priority;
  description: string;
  technicianName: string | null;
  assetTag: string;
  assetName: string;
  raisedBy: string;
};

type AssetOption = { id: string; tag: string; name: string };

const COLUMNS: { key: MaintStatus; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "TECHNICIAN_ASSIGNED", label: "Technician assigned" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
];

const PRIORITY_TONE: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function MaintenanceBoard({
  cards,
  assets,
  canManage,
}: {
  cards: Card[];
  assets: AssetOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function move(id: string, to: MaintStatus, technicianName?: string) {
    setBusy(id);
    const res = await fetch(`/api/maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, technicianName }),
    });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not move card");
      return;
    }
    toast.success(`Moved to ${to.replaceAll("_", " ").toLowerCase()}`);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setRaiseOpen(true)}>
          <Plus className="h-4 w-4" /> Raise Request
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.status === col.key);
          return (
            <div key={col.key} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {colCards.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {colCards.map((c) => (
                  <MaintCard
                    key={c.id}
                    card={c}
                    canManage={canManage}
                    busy={busy === c.id}
                    onMove={move}
                  />
                ))}
                {colCards.length === 0 && (
                  <div className="rounded-[var(--radius)] border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {raiseOpen && (
        <RaiseDialog assets={assets} onClose={() => setRaiseOpen(false)} onDone={() => { setRaiseOpen(false); router.refresh(); }} />
      )}
    </>
  );
}

function MaintCard({
  card,
  canManage,
  busy,
  onMove,
}: {
  card: Card;
  canManage: boolean;
  busy: boolean;
  onMove: (id: string, to: MaintStatus, technicianName?: string) => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const [tech, setTech] = useState("");

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{card.assetTag}</p>
          <p className="truncate text-xs text-muted-foreground">{card.assetName}</p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", PRIORITY_TONE[card.priority])}>
          {card.priority}
        </span>
      </div>
      <p className="mt-2 text-sm">{card.description}</p>
      {card.technicianName && (
        <p className="mt-1 text-xs text-muted-foreground">Technician: {card.technicianName}</p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">Raised by {card.raisedBy}</p>

      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.status === "PENDING" && (
            <>
              <Button size="sm" variant="success" disabled={busy} onClick={() => onMove(card.id, "APPROVED")}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onMove(card.id, "REJECTED")}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {card.status === "APPROVED" && !assigning && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setAssigning(true)}>
              <Wrench className="h-3.5 w-3.5" /> Assign technician
            </Button>
          )}
          {card.status === "APPROVED" && assigning && (
            <div className="flex w-full flex-col gap-2">
              <Input
                autoFocus
                placeholder="Technician name"
                value={tech}
                onChange={(e) => setTech(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !tech.trim()} onClick={() => onMove(card.id, "TECHNICIAN_ASSIGNED", tech.trim())}>
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAssigning(false); setTech(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {card.status === "TECHNICIAN_ASSIGNED" && (
            <Button size="sm" disabled={busy} onClick={() => onMove(card.id, "IN_PROGRESS")}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {card.status === "IN_PROGRESS" && (
            <Button size="sm" variant="success" disabled={busy} onClick={() => onMove(card.id, "RESOLVED")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function RaiseDialog({
  assets,
  onClose,
  onDone,
}: {
  assets: AssetOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, description, priority }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Could not raise request");
      return;
    }
    toast.success("Maintenance request raised");
    onDone();
  }

  return (
    <Dialog open onClose={onClose} title="Raise maintenance request" className="max-w-md">
      <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset">Asset</Label>
            <Select id="asset" value={assetId} onChange={(e) => setAssetId(e.target.value)} required>
              <option value="" disabled>Select an asset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Issue</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem…" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prio">Priority</Label>
            <Select id="prio" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !assetId}>{saving ? "Saving…" : "Raise request"}</Button>
          </div>
      </form>
    </Dialog>
  );
}
