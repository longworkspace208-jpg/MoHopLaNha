import type { NextConfig } from "next";
// Enables isolated build output for CI or local verification when a dev server is running.
const nextConfig: NextConfig = { distDir: process.env.NEXT_DIST_DIR ?? ".next" };
export default nextConfig;
