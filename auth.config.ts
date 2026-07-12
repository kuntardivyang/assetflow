import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no bcrypt / Prisma imports) so it can run in
 * middleware. The Credentials provider with its DB logic is added in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // real providers live in auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/signup";

      if (isAuthPage) {
        // Signed-in users shouldn't see login/signup.
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      // Everything else under the app requires a session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
