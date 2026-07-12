"use client";

import { useState } from "react";
import { TabStrip } from "@/components/ui/tabs";
import { DepartmentsTab, type Dept, type UserOption } from "./DepartmentsTab";
import { CategoriesTab, type Category } from "./CategoriesTab";
import { EmployeesTab, type Employee } from "./EmployeesTab";

type Tab = "departments" | "categories" | "employees";

export function OrgTabs({
  departments,
  users,
  categories,
  employees,
}: {
  departments: Dept[];
  users: UserOption[];
  categories: Category[];
  employees: Employee[];
}) {
  const [tab, setTab] = useState<Tab>("departments");

  return (
    <div className="space-y-4">
      <TabStrip
        tabs={[
          { value: "departments" as Tab, label: "Departments" },
          { value: "categories" as Tab, label: "Categories" },
          { value: "employees" as Tab, label: "Employees" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "departments" && <DepartmentsTab departments={departments} users={users} />}
      {tab === "categories" && <CategoriesTab categories={categories} />}
      {tab === "employees" && (
        <EmployeesTab
          employees={employees}
          departments={departments.map((d) => ({ id: d.id, name: d.name, active: d.active }))}
        />
      )}
    </div>
  );
}
