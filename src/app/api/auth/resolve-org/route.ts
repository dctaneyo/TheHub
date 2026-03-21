import { NextRequest } from "next/server";
import { resolveTenantBySlug } from "@/lib/tenant";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Slug must be 2–10 alphanumeric characters
const SLUG_REGEX = /^[a-zA-Z0-9]{2,10}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`resolve-org:${ip}`, {
      maxAttempts: 10,
      windowMs: 60_000,
      lockoutMs: 60_000,
    });
    if (!rl.allowed) {
      return ApiErrors.tooManyRequests(60);
    }

    const body = await req.json();
    const { slug } = body;

    if (!slug || typeof slug !== "string" || !SLUG_REGEX.test(slug)) {
      return ApiErrors.badRequest(
        "Invalid Organization ID. Must be 2–10 alphanumeric characters."
      );
    }

    const tenant = resolveTenantBySlug(slug);
    if (!tenant) {
      return ApiErrors.notFound("Organization");
    }

    return apiSuccess({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
        faviconUrl: tenant.faviconUrl,
        appTitle: tenant.appTitle,
      },
    });
  } catch (error) {
    console.error("Resolve org error:", error);
    return ApiErrors.internal();
  }
}
