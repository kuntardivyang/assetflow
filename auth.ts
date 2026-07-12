import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, DUMMY_HASH } from "@/lib/password";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { logActivity } from "@/lib/services/notifications";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Throttle by IP to blunt credential stuffing / brute force.
        const ip = request ? clientIp(request) : "unknown";
        if (!rateLimit(`login:${ip}`, 10, 5 * 60 * 1000).ok) {
          console.warn(`[auth] rate limit exceeded ip=${ip}`);
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always run a hash comparison — against a dummy when the user is
        // missing/inactive — so response time doesn't leak whether the email
        // exists (timing-based user enumeration).
        const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.active || !ok) {
          // Security log for failed attempts (no ActivityLog row — no user FK).
          console.warn(`[auth] failed login email=${email} ip=${ip}`);
          return null;
        }

        // Repudiation: record successful sign-ins in the activity log.
        await logActivity({
          actorId: user.id,
          action: "auth.login",
          entityType: "User",
          entityId: user.id,
          description: `${user.name} signed in`,
        }).catch((e) => console.error("[auth] login log failed", e));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // First call (sign-in): copy identity from the authorized user.
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.departmentId = user.departmentId;
        return token;
      }
      // Subsequent requests: re-read the user so role/department changes and
      // deactivations in Org Setup take effect immediately, not after the JWT
      // expires (~30 days). Returning null forces a sign-out.
      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { active: true, role: true, departmentId: true },
        });
        if (!fresh || !fresh.active) return null;
        token.role = fresh.role;
        token.departmentId = fresh.departmentId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.departmentId = (token.departmentId as string | null) ?? null;
      return session;
    },
  },
});
