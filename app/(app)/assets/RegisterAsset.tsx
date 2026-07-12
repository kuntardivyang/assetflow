"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";

const EMPTY = {
  name: "",
  categoryId: "",
  serialNumber: "",
  acquisitionDate: "",
  acquisitionCost: "",
  condition: "",
  location: "",
  photoUrl: "",
  bookable: false,
};

export function RegisterAsset({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function closeDialog() {
    if (!pending) setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cost = form.acquisitionCost.trim() === "" ? null : Number(form.acquisitionCost);
    if (cost !== null && Number.isNaN(cost)) return setError("Cost must be a number");
    // validate before setPending — a throw after it would leave the dialog stuck
    if (form.acquisitionDate && Number.isNaN(Date.parse(form.acquisitionDate))) {
      return setError("Invalid acquisition date");
    }
    setPending(true);
    setError("");
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        categoryId: form.categoryId,
        serialNumber: form.serialNumber.trim() || null,
        acquisitionDate: form.acquisitionDate ? new Date(form.acquisitionDate).toISOString() : null,
        acquisitionCost: cost,
        condition: form.condition.trim() || null,
        location: form.location.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        bookable: form.bookable,
      }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Network error — try again");
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? `Request failed (${res.status})`);
    if (!data?.id) return setError("Unexpected response — are you still signed in?");
    setOpen(false);
    setForm(EMPTY);
    router.refresh();
  }

  return (
    <>
      <Button
        onClick={() => {
          setForm(EMPTY);
          setError("");
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> Register Asset
      </Button>

      <Dialog open={open} onClose={closeDialog} title="Register Asset">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Asset tag is generated automatically (AF-0001 series) when you save.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="a-name">Name</Label>
              <Input
                id="a-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Dell Laptop"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-cat">Category</Label>
              <Select
                id="a-cat"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                required
              >
                <option value="">— pick —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-serial">Serial Number</Label>
              <Input
                id="a-serial"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-date">Acquisition Date</Label>
              <Input
                id="a-date"
                type="date"
                value={form.acquisitionDate}
                onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-cost">Acquisition Cost</Label>
              <Input
                id="a-cost"
                type="number"
                min={0}
                step="0.01"
                value={form.acquisitionCost}
                onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                placeholder="reports only"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-cond">Condition</Label>
              <Input
                id="a-cond"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                placeholder="Good"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-loc">Location</Label>
              <Input
                id="a-loc"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="HQ floor 2"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="a-photo">Photo URL (optional)</Label>
              <Input
                id="a-photo"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.bookable}
              onChange={(e) => setForm({ ...form, bookable: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Shared / bookable resource (appears in Resource Booking)
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Registering…" : "Register asset"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
