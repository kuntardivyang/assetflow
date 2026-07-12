"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export type Category = {
  id: string;
  name: string;
  extraFields: { warrantyMonths?: number } | null;
};

export function CategoriesTab({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [warranty, setWarranty] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function closeDialog() {
    if (!pending) setOpen(false);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setWarranty("");
    setError("");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setWarranty(c.extraFields?.warrantyMonths?.toString() ?? "");
    setError("");
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const warrantyNum = warranty.trim() === "" ? null : Number(warranty);
    if (warrantyNum !== null && Number.isNaN(warrantyNum)) {
      return setError("Warranty must be a number of months");
    }
    setPending(true);
    setError("");
    const payload = {
      name: name.trim(),
      warrantyMonths: warrantyNum,
    };
    const res = await fetch(editing ? `/api/categories/${editing.id}` : "/api/categories", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Network error — try again");
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? `Request failed (${res.status})`);
    if (!data?.id) return setError("Unexpected response — are you still signed in?");
    toast.success(editing ? "Category updated" : "Category created");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Categories drive the Assets register form; the optional warranty field shows how
          category-specific fields work.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Category</TH>
            <TH>Warranty period</TH>
            <TH className="w-28 text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {categories.length === 0 && (
            <TR>
              <TD colSpan={3} className="py-10 text-center text-muted-foreground">
                No categories yet — add the first one.
              </TD>
            </TR>
          )}
          {categories.map((c) => (
            <TR key={c.id}>
              <TD className="font-medium">{c.name}</TD>
              <TD className="text-muted-foreground">
                {c.extraFields?.warrantyMonths ? `${c.extraFields.warrantyMonths} months` : "--"}
              </TD>
              <TD className="text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={open} onClose={closeDialog} title={editing ? `Edit ${editing.name}` : "Add Category"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Electronics"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-warranty">Warranty period in months (optional)</Label>
            <Input
              id="cat-warranty"
              type="number"
              min={1}
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              placeholder="24"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
