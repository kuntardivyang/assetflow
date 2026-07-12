"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const STATUSES = [
  "AVAILABLE",
  "ALLOCATED",
  "RESERVED",
  "UNDER_MAINTENANCE",
  "LOST",
  "RETIRED",
  "DISPOSED",
];

export function FilterBar({
  categories,
  departments,
  locations,
}: {
  categories: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  locations: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/assets?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative min-w-56 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          const q = (new FormData(e.currentTarget).get("q") as string) ?? "";
          setParam("q", q.trim());
        }}
      >
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search by tag, serial, or QR code…"
          className="pl-9"
        />
      </form>
      <Select
        aria-label="Category"
        className="w-40"
        value={params.get("categoryId") ?? ""}
        onChange={(e) => setParam("categoryId", e.target.value)}
      >
        <option value="">Category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Status"
        className="w-44"
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">Status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Department"
        className="w-40"
        value={params.get("deptId") ?? ""}
        onChange={(e) => setParam("deptId", e.target.value)}
      >
        <option value="">Department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Location"
        className="w-40"
        value={params.get("location") ?? ""}
        onChange={(e) => setParam("location", e.target.value)}
      >
        <option value="">Location</option>
        {locations.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}
