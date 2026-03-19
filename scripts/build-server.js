/**
 * Compiles server.ts and startup.ts to plain JavaScript using esbuild.
 * This avoids needing tsx at runtime, which breaks Next.js's
 * AsyncLocalStorage detection on Node.js v24+.
 */
const { buildSync } = require("esbuild");
const path = require("path");

const common = {
  bundle: true,
  platform: "node",
  packages: "external",  // keep all node_modules as require() calls
  format: "cjs",
  target: "node20",
  alias: { "@": path.resolve(__dirname, "../src") },
  logLevel: "info",
};

// Compile server.ts → dist/server.js
buildSync({
  ...common,
  entryPoints: [path.resolve(__dirname, "../server.ts")],
  outfile: path.resolve(__dirname, "../dist/server.js"),
});

// Compile startup.ts → dist/startup.js
buildSync({
  ...common,
  entryPoints: [path.resolve(__dirname, "../src/lib/startup.ts")],
  outfile: path.resolve(__dirname, "../dist/startup.js"),
});

console.log("✅ Server files compiled to dist/");
