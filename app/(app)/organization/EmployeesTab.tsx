"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";

export type Employee = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  department: { id: string; name: string } | null;
};

const ROLE_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "DEPARTMENT_HEAD", label: "Department Head" },
  { value: "ASSET_MANAGER", label: "Asset Manager" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ASSET_MANAGER: "Asset Manager",
  DEPARTMENT_HEAD: "Department Head",
  EMPLOYEE: "Employee",
};

export function EmployeesTab({
  employees,
  departments,
}: {
  employees: Employee[];
  departments: { id: string; name: string; active: boolean }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ role: "EMPLOYEE", departmentId: "", active: "true" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function closeDialog() {
    if (!pending) setEditing(null);
  }

  function openEdit(u: Employee) {
    setEditing(u);
    setForm({
      role: u.role,
      departmentId: u.department?.id ?? "",
      active: String(u.active),
    });
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    setError("");
    const res = await fetch(`/api/employees/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: form.role,
        departmentId: form.departmentId || null,
        active: form.active === "true",
      }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Network error — try again");
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? `Request failed (${res.status})`);
    if (!data?.id) return setError("Unexpected response — are you still signed in?");
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sign-up always creates an Employee — this directory is the <b>only</b> place roles are
        assigned. Admin accounts can&apos;t be edited here.
      </p>

      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Department</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH className="w-24 text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {employees.map((u) => (
            <TR key={u.id} className={u.active ? "" : "opacity-60"}>
              <TD className="font-medium">{u.name ?? "--"}</TD>
              <TD className="text-muted-foreground">{u.email}</TD>
              <TD>{u.department?.name ?? "--"}</TD>
              <TD>{ROLE_LABEL[u.role] ?? u.role}</TD>
              <TD>
                <StatusBadge status={u.active ? "ACTIVE" : "INACTIVE"} />
              </TD>
              <TD className="text-right">
                {u.role === "ADMIN" ? (
                  <span className="text-xs text-muted-foreground">--</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={!!editing} onClose={closeDialog} title={editing ? `Edit ${editing.name ?? editing.email}` : ""}>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emp-role">Role</Label>
            <Select
              id="emp-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Promoting to Admin is not possible from this screen.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Select
              id="emp-dept"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">— none —</option>
              {departments
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-active">Status</Label>
            <Select
              id="emp-active"
              value={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.value })}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
