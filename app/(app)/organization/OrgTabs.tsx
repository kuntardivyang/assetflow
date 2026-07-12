"use client";

import { useState } from "react";
import { TabStrip } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DepartmentsTab, type Dept, type UserOption } from "./DepartmentsTab";

type Tab = "departments" | "categories" | "employees";

export function OrgTabs({ departments, users }: { departments: Dept[]; users: UserOption[] }) {
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
      {tab === "categories" && <ComingNext label="Categories" />}
      {tab === "employees" && <ComingNext label="Employee directory & role assignment" />}
    </div>
  );
}

function ComingNext({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {label} — coming soon.
      </CardContent>
    </Card>
  );
}
