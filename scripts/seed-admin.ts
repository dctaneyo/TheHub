/**
 * Seeds the first platform admin account. The Admin Console has no
 * self-serve signup by design — every account after the first is created
 * from /admin/team, but the very first one needs a way in.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts <email> <name> <password> <6-digit-pin>
 */
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db, schema } from "../src/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const [email, name, password, pin] = process.argv.slice(2);

  if (!email || !name || !password || !pin) {
    console.error("Usage: npx tsx scripts/seed-admin.ts <email> <name> <password> <6-digit-pin>");
    process.exit(1);
  }
  if (!/^\d{6}$/.test(pin)) {
    console.error("PIN must be exactly 6 digits");
    process.exit(1);
  }

  const existing = db.select({ id: schema.platformAdmins.id }).from(schema.platformAdmins).where(eq(schema.platformAdmins.email, email)).get();
  if (existing) {
    console.error(`An admin with email ${email} already exists`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const id = uuid();
  db.insert(schema.platformAdmins).values({
    id, email, name,
    passwordHash: hashSync(password, 10),
    pinHash: hashSync(pin, 10),
    isActive: true,
    createdAt: now, updatedAt: now,
  }).run();

  console.log(`✅ Platform admin created: ${name} <${email}>`);
  console.log("Log in at nimda.meetthehub.com/admin/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
