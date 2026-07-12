import { prisma } from "@/lib/db";
import { can, PermissionError } from "@/lib/rbac";
import { notify, logActivity } from "@/lib/services/notifications";
import type { MaintStatus, Role } from "@prisma/client";

/**
 * Maintenance state machine (Screen 7 Kanban).
 * PENDING → APPROVED → TECHNICIAN_ASSIGNED → IN_PROGRESS → RESOLVED, plus
 * PENDING → REJECTED. Moving a card automatically transitions the asset's
 * status — that coupling is the headline rule (R3), so it lives here, not in
 * the UI.
 */
export const MAINT_FLOW: Record<MaintStatus, MaintStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["TECHNICIAN_ASSIGNED"],
  TECHNICIAN_ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  REJECTED: [],
};

// Terminal asset states that a resolved maintenance must not overwrite.
const TERMINAL = ["RETIRED", "DISPOSED", "LOST"] as const;

export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaintenanceError";
  }
}

export async function moveMaintenance(params: {
  id: string;
  to: MaintStatus;
  actor: { id: string; role: Role };
  technicianName?: string;
}) {
  const { id, to, actor, technicianName } = params;

  const req = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: { asset: true },
  });
  if (!req) throw new MaintenanceError("Maintenance request not found");

  if (!MAINT_FLOW[req.status].includes(to)) {
    throw new MaintenanceError(`Cannot move from ${req.status} to ${to}`);
  }

  // The whole board is manager-operated — employees raise, Asset Managers
  // process. Every card move requires the approve permission.
  if (!can(actor.role, "maintenance:approve")) throw new PermissionError("maintenance:approve");

  if (to === "TECHNICIAN_ASSIGNED" && !technicianName?.trim()) {
    throw new MaintenanceError("A technician name is required");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.maintenanceRequest.update({
      where: { id },
      data: {
        status: to,
        ...(to === "TECHNICIAN_ASSIGNED" ? { technicianName: technicianName!.trim() } : {}),
        ...(to === "RESOLVED" ? { resolvedAt: new Date() } : {}),
      },
    });

    // Automatic asset-status coupling.
    if (to === "APPROVED") {
      await tx.asset.update({ where: { id: req.assetId }, data: { status: "UNDER_MAINTENANCE" } });
    } else if (to === "RESOLVED") {
      if (!TERMINAL.includes(req.asset.status as (typeof TERMINAL)[number])) {
        await tx.asset.update({ where: { id: req.assetId }, data: { status: "AVAILABLE" } });
      }
    }
    // APPROVED / RESOLVED / REJECTED all notify the person who raised it.
    const label = `${req.asset.name} (${req.asset.tag})`;
    if (to === "APPROVED") {
      await notify({ userId: req.raisedById, type: "MAINT_APPROVED", message: `Maintenance approved for ${label}`, link: "/maintenance" });
    } else if (to === "REJECTED") {
      await notify({ userId: req.raisedById, type: "MAINT_REJECTED", message: `Maintenance rejected for ${label}`, link: "/maintenance" });
    }

    await logActivity({
      actorId: actor.id,
      action: `maintenance:${to.toLowerCase()}`,
      entityType: "MaintenanceRequest",
      entityId: id,
      description: `Maintenance for ${req.asset.tag} moved to ${to.replaceAll("_", " ").toLowerCase()}`,
    });

    return updated;
  });
}

export async function raiseMaintenance(params: {
  assetId: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  actorId: string;
  photoUrl?: string;
}) {
  const asset = await prisma.asset.findUnique({ where: { id: params.assetId } });
  if (!asset) throw new MaintenanceError("Asset not found");

  const req = await prisma.maintenanceRequest.create({
    data: {
      assetId: params.assetId,
      raisedById: params.actorId,
      description: params.description,
      priority: params.priority,
      photoUrl: params.photoUrl,
    },
  });
  await logActivity({
    actorId: params.actorId,
    action: "maintenance:raise",
    entityType: "MaintenanceRequest",
    entityId: req.id,
    description: `Maintenance request raised for ${asset.tag}: ${params.description}`,
  });
  return req;
}
