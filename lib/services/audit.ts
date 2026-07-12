import { prisma } from "@/lib/db";
import { notify, logActivity } from "@/lib/services/notifications";

/**
 * Best-effort post-commit side effects: the cycle change already committed, so a
 * notification or activity-log failure must not fail the request. Logged, not thrown.
 */
async function notifySafe(params: Parameters<typeof notify>[0]) {
  try {
    await notify(params);
  } catch (e) {
    console.error("[audit] post-commit notify failed", e);
  }
}
async function logSafe(params: Parameters<typeof logActivity>[0]) {
  try {
    await logActivity(params);
  } catch (e) {
    console.error("[audit] post-commit activity log failed", e);
  }
}
import { can } from "@/lib/rbac";
import type { Role, AuditResult } from "@prisma/client";

/**
 * Screen 8 — Audit cycles (differentiator R4).
 *
 * Design (see 06-PROBLEMS-AND-FIXES):
 *  - [B8] The checklist is MATERIALIZED at cycle creation: one AuditItem per
 *    in-scope asset, with expectedLocation frozen to the asset's location then.
 *    We never recompute against live data.
 *  - [C3] The discrepancy report is derived LIVE from item results (MISSING /
 *    DAMAGED) — the UI shows it as auditors mark, before closing.
 *  - [C1] Closing a cycle requires `audit:manage` (Admin / Asset Manager), so
 *    the person closing IS the approver — LOST is never applied unapproved.
 *  - [B8] DAMAGED sets asset.condition = "Damaged"; it does NOT auto-create a
 *    MaintenanceRequest.
 */

export type AuditErrorCode = "CONFLICT" | "NOT_FOUND" | "INVALID_STATE" | "FORBIDDEN";

export class AuditError extends Error {
  code: AuditErrorCode;
  constructor(code: AuditErrorCode, message: string) {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

export interface CreateCycleInput {
  name: string;
  scopeDeptId?: string;
  scopeLocation?: string;
  startDate: Date;
  endDate: Date;
  auditorIds: string[];
}

/**
 * Create a cycle and snapshot its checklist. In-scope assets = those whose
 * currentDeptId == scopeDeptId OR location == scopeLocation. If neither scope
 * is given, every asset is included.
 */
export async function createCycle(input: CreateCycleInput, actorId: string) {
  const { name, scopeDeptId, scopeLocation, startDate, endDate, auditorIds } = input;

  const where =
    scopeDeptId || scopeLocation
      ? {
          OR: [
            ...(scopeDeptId ? [{ currentDeptId: scopeDeptId }] : []),
            ...(scopeLocation ? [{ location: scopeLocation }] : []),
          ],
        }
      : {};

  const assets = await prisma.asset.findMany({
    where,
    select: { id: true, location: true },
  });
  if (assets.length === 0) {
    throw new AuditError("INVALID_STATE", "No assets match this audit scope.");
  }

  const cycle = await prisma.auditCycle.create({
    data: {
      name,
      scopeDeptId: scopeDeptId ?? null,
      scopeLocation: scopeLocation ?? null,
      startDate,
      endDate,
      status: "OPEN",
      createdById: actorId,
      auditors: { create: auditorIds.map((userId) => ({ userId })) },
      items: {
        create: assets.map((a) => ({
          assetId: a.id,
          expectedLocation: a.location ?? null, // frozen snapshot
          result: "PENDING" as AuditResult,
        })),
      },
    },
  });

  await logSafe({
    actorId,
    action: "audit.create",
    entityType: "AuditCycle",
    entityId: cycle.id,
    description: `Opened audit cycle "${name}" (${assets.length} assets)`,
  });

  return cycle;
}

/** Mark a checklist item. Allowed for an assigned auditor OR an `audit:manage` role. */
export async function markItem(
  itemId: string,
  result: AuditResult,
  notes: string | undefined,
  actorId: string,
  role: Role | undefined,
) {
  const item = await prisma.auditItem.findUnique({
    where: { id: itemId },
    include: { cycle: { include: { auditors: { select: { userId: true } } } } },
  });
  if (!item) throw new AuditError("NOT_FOUND", "Audit item not found.");
  if (item.cycle.status !== "OPEN") {
    throw new AuditError("INVALID_STATE", "This audit cycle is closed and read-only.");
  }

  const isAuditor = item.cycle.auditors.some((a) => a.userId === actorId);
  if (!isAuditor && !can(role, "audit:manage")) {
    throw new AuditError("FORBIDDEN", "Only assigned auditors can mark this checklist.");
  }

  return prisma.auditItem.update({
    where: { id: itemId },
    data: { result, notes: notes ?? item.notes },
  });
}

/**
 * Close a cycle: apply consequences, lock it, generate the discrepancy report.
 * MISSING -> asset LOST · DAMAGED -> asset.condition = "Damaged".
 */
export async function closeCycle(cycleId: string, actorId: string) {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id: cycleId },
    include: {
      items: {
        include: { asset: { select: { id: true, tag: true, name: true } } },
      },
    },
  });
  if (!cycle) throw new AuditError("NOT_FOUND", "Audit cycle not found.");
  if (cycle.status !== "OPEN") {
    throw new AuditError("INVALID_STATE", "This audit cycle is already closed.");
  }

  const flagged = cycle.items.filter(
    (i) => i.result === "MISSING" || i.result === "DAMAGED",
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const it of cycle.items) {
      if (it.result === "MISSING") {
        // A lost asset can't stay "held": mark it LOST, clear the holder, and
        // close any active allocation so it doesn't linger (or show as overdue).
        await tx.asset.update({
          where: { id: it.assetId },
          data: { status: "LOST", currentHolderId: null, currentDeptId: null },
        });
        await tx.allocation.updateMany({
          where: { assetId: it.assetId, status: "ACTIVE" },
          data: { status: "RETURNED", returnedAt: now, returnCondition: "Lost (audit)" },
        });
      } else if (it.result === "DAMAGED") {
        await tx.asset.update({ where: { id: it.assetId }, data: { condition: "Damaged" } });
      }
    }
    await tx.auditCycle.update({
      where: { id: cycleId },
      data: { status: "CLOSED", closedAt: now },
    });
  });

  // Notify the cycle owner per flagged item, and log the closure.
  for (const it of flagged) {
    await notifySafe({
      userId: cycle.createdById,
      type: "AUDIT_DISCREPANCY",
      message: `${it.asset.tag} ${it.asset.name} flagged ${it.result} in audit "${cycle.name}"`,
      link: "/audit",
    });
  }
  await logSafe({
    actorId,
    action: "audit.close",
    entityType: "AuditCycle",
    entityId: cycleId,
    description: `Closed audit "${cycle.name}" — ${flagged.length} discrepanc${flagged.length === 1 ? "y" : "ies"} flagged`,
  });

  return { flaggedCount: flagged.length };
}

/** Live discrepancy report — items marked MISSING or DAMAGED (derived, not stored). */
export function listDiscrepancies(items: { result: AuditResult }[]) {
  return items.filter((i) => i.result === "MISSING" || i.result === "DAMAGED");
}
