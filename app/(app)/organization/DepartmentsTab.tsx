"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";

export type Dept = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  head: { id: string; name: string | null } | null;
  parent: { id: string; name: string } | null;
};

export type UserOption = { id: string; name: string | null; email: string; role: string };

const EMPTY_FORM = { name: "", code: "", headId: "", parentId: "" };

export function DepartmentsTab({ departments, users }: { departments: Dept[]; users: UserOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState("");

  // Keep the dialog up while a save is in flight so its error stays visible.
  function closeDialog() {
    if (!pending) setOpen(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setOpen(true);
  }

  function openEdit(d: Dept) {
    setEditing(d);
    setForm({ name: d.name, code: d.code, headId: d.head?.id ?? "", parentId: d.parent?.id ?? "" });
    setError("");
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      headId: form.headId || null,
      parentId: form.parentId || null,
    };
    const res = await fetch(editing ? `/api/departments/${editing.id}` : "/api/departments", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Network error — try again");
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? `Request failed (${res.status})`);
    // A 2xx without the entity means we were redirected (e.g. expired session)
    // — don't report a save that never happened.
    if (!data?.id) return setError("Unexpected response — are you still signed in?");
    setOpen(false);
    router.refresh();
  }

  async function toggleActive(d: Dept) {
    setTogglingId(d.id);
    setToggleError("");
    const res = await fetch(`/api/departments/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    }).catch(() => null);
    setTogglingId(null);
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => null) : null;
      setToggleError(
        data?.error ?? (res ? `Request failed (${res.status})` : "Network error — try again"),
      );
      return; // don't refresh into stale state on failure
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Editing a department here also drives the picklists in Assets & Allocation.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      {toggleError && <p className="text-sm text-danger">{toggleError}</p>}

      <Table>
        <THead>
          <TR>
            <TH>Department</TH>
            <TH>Code</TH>
            <TH>Head</TH>
            <TH>Parent Dept</TH>
            <TH>Status</TH>
            <TH className="w-40 text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {departments.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                No departments yet — add the first one.
              </TD>
            </TR>
          )}
          {departments.map((d) => (
            <TR key={d.id} className={d.active ? "" : "opacity-60"}>
              <TD className="font-medium">{d.name}</TD>
              <TD className="text-muted-foreground">{d.code}</TD>
              <TD>{d.head?.name ?? "--"}</TD>
              <TD>{d.parent?.name ?? "--"}</TD>
              <TD>
                <StatusBadge status={d.active ? "ACTIVE" : "INACTIVE"} />
              </TD>
              <TD className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={togglingId === d.id}
                    onClick={() => toggleActive(d)}
                  >
                    {d.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog
        open={open}
        onClose={closeDialog}
        title={editing ? `Edit ${editing.name}` : "Add Department"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Engineering"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-code">Code</Label>
            <Input
              id="dept-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="ENG"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-head">Department Head</Label>
            <Select
              id="dept-head"
              value={form.headId}
              onChange={(e) => setForm({ ...form, headId: e.target.value })}
            >
              <option value="">— none —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-parent">Parent Department (optional)</Label>
            <Select
              id="dept-parent"
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">— none —</option>
              {departments
                .filter((d) => d.active && d.id !== editing?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create department"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
