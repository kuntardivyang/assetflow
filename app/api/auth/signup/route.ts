import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { signupSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Signup ALWAYS creates an EMPLOYEE. Roles are assigned later by an Admin
// in Organization Setup — no self-elevation. (Spec requirement.)
export async function POST(req: Request) {
  // Throttle signups per IP to blunt spam / enumeration probing.
  const limited = rateLimit(`signup:${clientIp(req)}`, 5, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // email is already trimmed + lowercased by the schema.
  const { name, email, password } = parsed.data;

  // Hash unconditionally (~250ms) BEFORE the existence check so an existing
  // email doesn't return measurably faster — closes the timing side channel.
  const passwordHash = await hashPassword(password);

  // Enumeration-safe: never reveal whether the email already exists. Create the
  // account only when it's new; either way return the same generic response.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!existing) {
    await prisma.user.create({
      data: { name, email, passwordHash, role: "EMPLOYEE" },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
