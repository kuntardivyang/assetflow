import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — there are unrelated lockfiles in the home dir.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
