import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { OrgTabs } from "./OrgTabs";

// Screen 3 — Organization Setup. The page is Admin-only, and every MUTATING
// org route re-checks org:manage server-side (RBAC gates actions, not just
// menus). GET /api/departments stays open to all signed-in users for picklists.
export default async function OrganizationPage() {
  const session = await auth();
  if (!can(session?.user?.role, "org:manage")) redirect("/dashboard");

  const [departments, employees, categories] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
        head: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    // Full directory (incl. inactive) for the Employees tab; the head picker
    // below filters to active accounts.
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      select: { id: true, name: true, extraFields: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeUsers = employees.filter((u) => u.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization setup</h1>
        <p className="text-sm text-muted-foreground">
          Departments, categories and employee roles — the master data every other screen depends on.
        </p>
      </div>
      <OrgTabs
        departments={departments}
        users={activeUsers}
        employees={employees}
        categories={categories.map((c) => ({
          ...c,
          extraFields: c.extraFields as { warrantyMonths?: number } | null,
        }))}
      />
    </div>
  );
}
