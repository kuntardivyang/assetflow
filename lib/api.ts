import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertCan, PermissionError, type Action } from "@/lib/rbac";
import type { Session } from "next-auth";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Auth + RBAC gate for API routes. Returns the session or throws;
 * pair with `apiError` in the route's catch so failures are legible
 * (401/403 JSON) instead of opaque 500s.
 */
export async function requireAction(action: Action): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  assertCan(session.user.role, action);
  return session;
}

/** Session-only gate for routes any signed-in user may call (e.g. picklists). */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  return session;
}

export function apiError(e: unknown, context?: string) {
  if (e instanceof UnauthenticatedError) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
  if (e instanceof PermissionError) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
  console.error(context ? `[${context}]` : "[api]", e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
