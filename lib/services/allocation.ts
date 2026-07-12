import { prisma } from "@/lib/db";
import { notify, logActivity } from "@/lib/services/notifications";

/**
 * Screen 5 business rules — the differentiators for AssetFlow.
 *
 * R1 (double-allocation block): an asset that is already ALLOCATED cannot be
 * re-allocated directly — the caller must go through a transfer request. The
 * check-and-create is race-safe via a conditional `updateMany` guard (see
 * `allocate`), not a bare findFirst+create.
 *
 * All mutations take an explicit `actorId` (the session user) — identity is
 * never trusted from the request body.
 */

export type AllocationErrorCode = "CONFLICT" | "NOT_FOUND" | "INVALID_STATE";

/** Typed error so thin route handlers can map to 409 / 404 / 400 without string-matching. */
export class AllocationError extends Error {
  code: AllocationErrorCode;
  constructor(code: AllocationErrorCode, message: string) {
    super(message);
    this.name = "AllocationError";
    this.code = code;
  }
}

const humanStatus = (s: string) => s.replaceAll("_", " ").toLowerCase();

export interface AllocateInput {
  assetId: string;
  toUserId?: string;
  toDeptId?: string;
  expectedReturnDate?: Date;
}

/**
 * Allocate an AVAILABLE asset to an employee (and/or department).
 * Enforces R1: throws CONFLICT if the asset is already allocated.
 */
export async function allocate(input: AllocateInput, actorId: string) {
  const { assetId, toUserId, toDeptId, expectedReturnDate } = input;
  if (!toUserId && !toDeptId) {
    throw new AllocationError("INVALID_STATE", "Choose an employee or department to allocate to.");
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, tag: true, name: true, status: true },
  });
  if (!asset) throw new AllocationError("NOT_FOUND", "Asset not found.");
  if (asset.status === "ALLOCATED") {
    throw new AllocationError(
      "CONFLICT",
      "Asset is already allocated — submit a transfer request instead.",
    );
  }
  if (asset.status !== "AVAILABLE") {
    throw new AllocationError(
      "INVALID_STATE",
      `Asset ${asset.tag} is ${humanStatus(asset.status)} and cannot be allocated.`,
    );
  }

  // Derive the holder's department when allocating to a user without an explicit dept.
  let deptId: string | null = toDeptId ?? null;
  if (!deptId && toUserId) {
    const u = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { departmentId: true },
    });
    deptId = u?.departmentId ?? null;
  }

  // Race-safe: only one concurrent transaction can flip AVAILABLE -> ALLOCATED.
  const allocation = await prisma.$transaction(async (tx) => {
    const flipped = await tx.asset.updateMany({
      where: { id: assetId, status: "AVAILABLE" },
      data: { status: "ALLOCATED", currentHolderId: toUserId ?? null, currentDeptId: deptId },
    });
    if (flipped.count === 0) {
      throw new AllocationError(
        "CONFLICT",
        "Asset is already allocated — submit a transfer request instead.",
      );
    }
    return tx.allocation.create({
      data: {
        assetId,
        toUserId: toUserId ?? null,
        toDeptId: deptId,
        allocatedById: actorId,
        expectedReturnDate: expectedReturnDate ?? null,
        status: "ACTIVE",
      },
    });
  });

  // Side effects after commit — a notification failure must not roll back the allocation.
  if (toUserId) {
    await notify({
      userId: toUserId,
      type: "ASSET_ASSIGNED",
      message: `${asset.tag} ${asset.name} assigned to you`,
      link: "/allocation",
    });
  }
  await logActivity({
    actorId,
    action: "asset.allocate",
    entityType: "Asset",
    entityId: assetId,
    description: `Allocated ${asset.tag} ${asset.name}`,
  });

  return allocation;
}

export interface RequestTransferInput {
  assetId: string;
  toUserId: string;
  reason: string;
}

/** File a transfer request — the escape hatch when direct allocation is blocked. Does NOT move the asset. */
export async function requestTransfer(input: RequestTransferInput, actorId: string) {
  const { assetId, toUserId, reason } = input;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, tag: true, name: true, currentHolderId: true },
  });
  if (!asset) throw new AllocationError("NOT_FOUND", "Asset not found.");

  const active = await prisma.allocation.findFirst({
    where: { assetId, status: "ACTIVE" },
    select: { toUserId: true },
  });
  const fromUserId = active?.toUserId ?? asset.currentHolderId ?? null;
  if (fromUserId && fromUserId === toUserId) {
    throw new AllocationError("INVALID_STATE", "Asset is already held by that person.");
  }

  const pending = await prisma.transferRequest.findFirst({
    where: { assetId, status: "REQUESTED" },
  });
  if (pending) {
    throw new AllocationError("CONFLICT", "A transfer request for this asset is already pending.");
  }

  const tr = await prisma.transferRequest.create({
    data: { assetId, fromUserId, toUserId, reason, requestedById: actorId, status: "REQUESTED" },
  });
  await logActivity({
    actorId,
    action: "transfer.request",
    entityType: "TransferRequest",
    entityId: tr.id,
    description: `Transfer requested for ${asset.tag} ${asset.name}`,
  });
  return tr;
}

/** Approve a transfer: close the old ACTIVE allocation, open a new one, move the asset. */
export async function approveTransfer(transferId: string, actorId: string) {
  const tr = await prisma.transferRequest.findUnique({ where: { id: transferId } });
  if (!tr) throw new AllocationError("NOT_FOUND", "Transfer request not found.");
  if (tr.status !== "REQUESTED") {
    throw new AllocationError("INVALID_STATE", "This transfer request has already been decided.");
  }

  const [asset, toUser, oldActive] = await Promise.all([
    prisma.asset.findUnique({ where: { id: tr.assetId }, select: { tag: true, name: true } }),
    prisma.user.findUnique({ where: { id: tr.toUserId }, select: { name: true, departmentId: true } }),
    prisma.allocation.findFirst({
      where: { assetId: tr.assetId, status: "ACTIVE" },
      select: { expectedReturnDate: true },
    }),
  ]);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.transferRequest.update({
      where: { id: transferId },
      data: { status: "APPROVED", approvedById: actorId, decidedAt: now },
    });
    // [B1] Auto-reject any other pending transfers for this asset so an approved
    // move can't be undone by a stale sibling request (also prevents a second ACTIVE).
    await tx.transferRequest.updateMany({
      where: { assetId: tr.assetId, status: "REQUESTED", id: { not: transferId } },
      data: { status: "REJECTED", approvedById: actorId, decidedAt: now },
    });
    // Close the current holder's allocation and open the new one (history preserved).
    await tx.allocation.updateMany({
      where: { assetId: tr.assetId, status: "ACTIVE" },
      data: { status: "RETURNED", returnedAt: now },
    });
    await tx.allocation.create({
      data: {
        assetId: tr.assetId,
        toUserId: tr.toUserId,
        toDeptId: toUser?.departmentId ?? null,
        allocatedById: actorId,
        // [B4] Carry over the return date so transferred assets can still go overdue.
        expectedReturnDate: oldActive?.expectedReturnDate ?? null,
        status: "ACTIVE",
      },
    });
    await tx.asset.update({
      where: { id: tr.assetId },
      data: { status: "ALLOCATED", currentHolderId: tr.toUserId, currentDeptId: toUser?.departmentId ?? null },
    });
  });

  await notify({
    userId: tr.toUserId,
    type: "TRANSFER_APPROVED",
    message: `${asset?.tag ?? "Asset"} transferred to you`,
    link: "/allocation",
  });
  await logActivity({
    actorId,
    action: "transfer.approve",
    entityType: "TransferRequest",
    entityId: transferId,
    description: `Transfer approved for ${asset?.tag} ${asset?.name} → ${toUser?.name}`,
  });
  return { ok: true };
}

/** Reject a transfer — asset stays with the current holder. */
export async function rejectTransfer(transferId: string, actorId: string) {
  const tr = await prisma.transferRequest.findUnique({ where: { id: transferId } });
  if (!tr) throw new AllocationError("NOT_FOUND", "Transfer request not found.");
  if (tr.status !== "REQUESTED") {
    throw new AllocationError("INVALID_STATE", "This transfer request has already been decided.");
  }
  await prisma.transferRequest.update({
    where: { id: transferId },
    data: { status: "REJECTED", approvedById: actorId, decidedAt: new Date() },
  });
  await logActivity({
    actorId,
    action: "transfer.reject",
    entityType: "TransferRequest",
    entityId: transferId,
    description: `Transfer rejected for asset ${tr.assetId}`,
  });
  return { ok: true };
}

export interface ReturnInput {
  allocationId?: string;
  assetId?: string;
  returnCondition?: string;
}

/** Return an asset: close the ACTIVE allocation, asset back to AVAILABLE. */
export async function returnAsset(input: ReturnInput, actorId: string) {
  const { allocationId, assetId, returnCondition } = input;
  if (!allocationId && !assetId) {
    throw new AllocationError("INVALID_STATE", "An allocation or asset is required to return.");
  }
  const active = await prisma.allocation.findFirst({
    where: {
      status: "ACTIVE",
      ...(allocationId ? { id: allocationId } : {}),
      ...(assetId ? { assetId } : {}),
    },
    include: { asset: { select: { tag: true, name: true } } },
  });
  if (!active) throw new AllocationError("NOT_FOUND", "No active allocation to return.");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.allocation.update({
      where: { id: active.id },
      data: { status: "RETURNED", returnedAt: now, returnCondition: returnCondition ?? null },
    });
    await tx.asset.update({
      where: { id: active.assetId },
      data: { status: "AVAILABLE", currentHolderId: null, currentDeptId: null },
    });
  });

  await logActivity({
    actorId,
    action: "asset.return",
    entityType: "Asset",
    entityId: active.assetId,
    description: `${active.asset.tag} ${active.asset.name} returned`,
  });
  return { ok: true };
}

/** Overdue = active allocation past its expected return date. Mirrors the dashboard query. */
export function isOverdue(a: { status: string; expectedReturnDate: Date | null }) {
  return a.status === "ACTIVE" && a.expectedReturnDate != null && a.expectedReturnDate < new Date();
}

/** Shared source for the dashboard banner + OVERDUE_RETURN notifications (Divyang). */
export function listOverdue() {
  return prisma.allocation.findMany({
    where: { status: "ACTIVE", expectedReturnDate: { lt: new Date() } },
    include: { asset: true, toUser: true },
  });
}
