import { prisma } from "@/lib/db";
import type { AssetStatus, Prisma } from "@prisma/client";

/**
 * Race-free, delete-proof asset tags via a Postgres sequence (review B2).
 * NEVER use count()+1 — it collides after deletions and under concurrency.
 * Pass the transaction client when registering inside a $transaction.
 */
export async function nextTag(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const rows = await client.$queryRaw<
    { nextval: bigint }[]
  >`SELECT nextval('asset_tag_seq')`;
  return `AF-${String(rows[0].nextval).padStart(4, "0")}`;
}

/**
 * Legal manual status transitions for the guarded "Change status" action
 * (Admin / Asset Manager only). This is the ONLY way an asset reaches
 * RESERVED / RETIRED / DISPOSED / LOST — those are never set by a workflow
 * (review B6). Allocation, booking, maintenance own the other transitions.
 */
const MANUAL_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  AVAILABLE: ["RESERVED", "RETIRED", "DISPOSED", "LOST"],
  RESERVED: ["AVAILABLE", "RETIRED", "DISPOSED"],
  ALLOCATED: [], // released only by returning the allocation
  UNDER_MAINTENANCE: [], // released only by resolving maintenance
  LOST: ["AVAILABLE", "DISPOSED"], // found again, or written off
  RETIRED: ["DISPOSED"],
  DISPOSED: [],
};

export function canChangeStatus(from: AssetStatus, to: AssetStatus): boolean {
  return MANUAL_TRANSITIONS[from].includes(to);
}
