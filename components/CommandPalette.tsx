"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Boxes, User, Building2, Search } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@prisma/client";

type Data = {
  assets: { id: string; tag: string; name: string; status: string }[];
  users: { id: string; name: string; role: Role }[];
  departments: { id: string; name: string; code: string }[];
};

// Global ⌘K / Ctrl+K search over assets, people and departments.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);

  // Toggle on ⌘K / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load the (small) dataset the first time it opens.
  useEffect(() => {
    if (open && !data) {
      fetch("/api/search")
        .then((r) => r.json())
        .then(setData)
        .catch(() => setData({ assets: [], users: [], departments: [] }));
    }
  }, [open, data]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        loop
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Command.Input
            autoFocus
            placeholder="Search assets, people, departments…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            {data ? "No results found." : "Loading…"}
          </Command.Empty>

          {data && data.assets.length > 0 && (
            <Command.Group heading="Assets" className="px-1 text-xs font-medium text-muted-foreground">
              {data.assets.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`${a.tag} ${a.name}`}
                  onSelect={() => go(`/assets/${a.id}`)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{a.tag}</span>
                  <span className="text-muted-foreground">— {a.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {data && data.users.length > 0 && (
            <Command.Group heading="People" className="px-1 text-xs font-medium text-muted-foreground">
              {data.users.map((u) => (
                <Command.Item
                  key={u.id}
                  value={`${u.name} ${u.role}`}
                  onSelect={() => go("/organization")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground">— {ROLE_LABELS[u.role]}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {data && data.departments.length > 0 && (
            <Command.Group heading="Departments" className="px-1 text-xs font-medium text-muted-foreground">
              {data.departments.map((d) => (
                <Command.Item
                  key={d.id}
                  value={`${d.name} ${d.code}`}
                  onSelect={() => go("/organization")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">— {d.code}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          Press <kbd className="rounded bg-muted px-1">Esc</kbd> to close ·{" "}
          <kbd className="rounded bg-muted px-1">⌘K</kbd> to toggle
        </div>
      </Command>
    </div>
  );
}
