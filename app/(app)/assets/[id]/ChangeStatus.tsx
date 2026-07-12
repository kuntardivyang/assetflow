"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function ChangeStatus({ assetId, targets }: { assetId: string; targets: string[] }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (targets.length === 0) return null;

  async function submit() {
    if (!target) return;
    setPending(true);
    setError("");
    const res = await fetch(`/api/assets/${assetId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Network error — try again");
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? `Request failed (${res.status})`);
    setTarget("");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Change status"
          className="w-44"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Change status…</option>
          {targets.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
            </option>
          ))}
        </Select>
        <Button size="sm" disabled={!target || pending} onClick={submit}>
          {pending ? "Applying…" : "Apply"}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
