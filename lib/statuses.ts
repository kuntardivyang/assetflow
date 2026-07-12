import type { AssetStatus } from "@prisma/client";

// Client-safe (type-only import, no Prisma runtime) so the registry filter,
// the server page and the API all share one status list + order.
export const ASSET_STATUSES: AssetStatus[] = [
  "AVAILABLE",
  "ALLOCATED",
  "RESERVED",
  "UNDER_MAINTENANCE",
  "LOST",
  "RETIRED",
  "DISPOSED",
];

export function humanizeStatus(s: string) {
  return s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
