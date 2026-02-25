import type { NextConfig } from "next";
import fs from "fs";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

// Read the build ID written by the build script (package.json "build" command).
// Both the client bundle and the custom Node server read from this same file,
// so they always agree on the current build's identity.
function readBuildId(): string {
  try {
    return fs.readFileSync(path.join(__dirname, "build-id.txt"), "utf8").trim();
  } catch {
    return String(Date.now());
  }
}

const BUILD_ID = readBuildId();

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.5.165"],
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
