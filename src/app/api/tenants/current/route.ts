import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET() {
  try {
    const tenant = await getTenant();
    if (!tenant) {
      return ApiErrors.notFound("Tenant");
    }
    return apiSuccess({ tenant });
  } catch (error) {
    console.error("Get tenant error:", error);
    return ApiErrors.internal();
  }
}
