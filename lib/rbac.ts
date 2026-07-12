import type { Role } from "@prisma/client";

/**
 * Central permission map. Every API route should call `can(role, action)`
 * before mutating — RBAC is enforced server-side, not just hidden in the UI.
 */
export type Action =
  | "org:manage" //   departments, categories, employees, role assignment (Admin only)
  | "asset:manage" // register / edit assets
  | "asset:allocate" //   allocate assets
  | "transfer:approve" // approve transfers & returns
  | "maintenance:approve" // approve / reject maintenance
  | "maintenance:raise" //  raise a maintenance request
  | "booking:create" //  book a shared resource
  | "transfer:request" // initiate return / transfer request
  | "audit:manage" //  create / close audit cycles
  | "analytics:viewAll"; // org-wide analytics

const MATRIX: Record<Action, Role[]> = {
  "org:manage": ["ADMIN"],
  "asset:manage": ["ADMIN", "ASSET_MANAGER"],
  "asset:allocate": ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"],
  "transfer:approve": ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"],
  "maintenance:approve": ["ADMIN", "ASSET_MANAGER"],
  "maintenance:raise": ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  "booking:create": ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  "transfer:request": ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  "audit:manage": ["ADMIN", "ASSET_MANAGER"],
  "analytics:viewAll": ["ADMIN", "ASSET_MANAGER"],
};

export function can(role: Role | undefined, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}

/** Throwing guard for use inside API route handlers. */
export function assertCan(role: Role | undefined, action: Action) {
  if (!can(role, action)) {
    throw new PermissionError(action);
  }
}

export class PermissionError extends Error {
  constructor(action: string) {
    super(`Not authorized for: ${action}`);
    this.name = "PermissionError";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ASSET_MANAGER: "Asset Manager",
  DEPARTMENT_HEAD: "Department Head",
  EMPLOYEE: "Employee",
};
