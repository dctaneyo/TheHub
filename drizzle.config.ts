import { defineConfig } from "drizzle-kit";

const dbPath = process.env.DATABASE_PATH || "./data/hub.db";
const isRemote = dbPath.startsWith("libsql://") || dbPath.startsWith("https://");
const url = isRemote ? dbPath : (dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`);

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: isRemote ? "turso" : "sqlite",
  dbCredentials: {
    url,
    authToken: isRemote ? process.env.DATABASE_AUTH_TOKEN : undefined,
  },
});
