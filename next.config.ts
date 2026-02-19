import type { NextConfig } from "next";

// Bake the current build's identity into the client bundle.
// Railway sets RAILWAY_GIT_COMMIT_SHA automatically; fall back to a
// timestamp so local dev always gets a unique value too.
const BUILD_ID =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  String(Date.now());

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.5.165"],
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
