import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Uses the edge-safe config; the `authorized` callback gates every route.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
