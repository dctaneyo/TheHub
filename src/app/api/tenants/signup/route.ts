import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { createTenantWithFirstAdmin } from "@/lib/tenant-provisioning";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`signup:${ip}`, { maxAttempts: 3, windowMs: 60_000, lockoutMs: 10 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const body = await req.json();
    const { slug, name, appTitle, primaryColor, plan, adminName, adminUserId, adminPin } = body;

    const result = await createTenantWithFirstAdmin({
      slug, name, appTitle, primaryColor, plan, adminName, adminUserId, adminPin,
    });

    if (!result.ok) {
      return ApiErrors.badRequest(result.error);
    }

    return apiSuccess({
      success: true,
      tenant: {
        id: result.tenantId,
        slug: result.slug,
        name,
        // Tenants sign in at meetthehub.com/login and enter this as their
        // Organization ID — there is no per-tenant subdomain.
        organizationId: result.slug,
      },
      admin: {
        id: result.adminId,
        name: adminName,
        userId: adminUserId,
      },
    });
  } catch (error) {
    console.error("Tenant signup error:", error);
    return ApiErrors.internal();
  }
}

// GET — Check if a slug is available
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return ApiErrors.badRequest("Slug parameter required");
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const reserved = ["admin", "nimda", "www", "join", "api", "app", "hub", "mail", "ftp", "ns1", "ns2", "test", "staging", "dev"];

  if (reserved.includes(cleanSlug)) {
    return apiSuccess({ available: false, reason: "reserved" });
  }

  const existing = db.select().from(schema.tenants).where(eq(schema.tenants.slug, cleanSlug)).get();
  return apiSuccess({ available: !existing, slug: cleanSlug });
}
