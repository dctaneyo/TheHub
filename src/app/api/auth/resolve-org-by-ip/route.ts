import { NextRequest } from "next/server";
import { getClientIP } from "@/lib/rate-limiter";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);

    // Look up IP in org_ip_mappings
    const mapping = db
      .select({
        tenantId: schema.orgIpMappings.tenantId,
      })
      .from(schema.orgIpMappings)
      .where(eq(schema.orgIpMappings.ipAddress, ip))
      .get();

    if (!mapping) {
      return NextResponse.json({ ok: false });
    }

    // Fetch the tenant's branding info
    const tenant = db
      .select({
        id: schema.tenants.id,
        slug: schema.tenants.slug,
        name: schema.tenants.name,
        logoUrl: schema.tenants.logoUrl,
        primaryColor: schema.tenants.primaryColor,
        accentColor: schema.tenants.accentColor,
        faviconUrl: schema.tenants.faviconUrl,
        appTitle: schema.tenants.appTitle,
        isActive: schema.tenants.isActive,
      })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, mapping.tenantId))
      .get();

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({
      ok: true,
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
    console.error("Resolve org by IP error:", error);
    return NextResponse.json({ ok: false });
  }
}
